import { withSupabase } from "npm:@supabase/server@^1";

function dateText(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + count);
  return dateText(date);
}

function effective(profile: any, today = dateText()) {
  const end = profile?.leave_date ? addDays(profile.leave_date, 5) : "";
  return Boolean(profile?.is_active
    && (!profile.hire_date || today >= profile.hire_date)
    && (!end || today <= end));
}

function loginEmail(employeeCode: string) {
  const normalized = String(employeeCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("工號無法建立登入帳號");
  return `${normalized}@local.invalid`;
}

async function actorProfile(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,is_active,hire_date,leave_date")
    .eq("id", actorId).single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  if (!["manager", "admin"].includes(result.data.role)) {
    throw new Error("員工沒有刪除帳號權限");
  }
  return result.data;
}

async function verifyPassword(employeeCode: string, password: string) {
  if (!password) throw new Error("刪除自己的帳號前，請輸入目前密碼");
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anonKey) throw new Error("伺服器缺少登入驗證設定");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail(employeeCode), password })
  });
  if (!response.ok) throw new Error("目前密碼不正確");
}

async function countRows(ctx: any, table: string, column: string, value: string) {
  const result = await ctx.supabaseAdmin.from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (result.error) throw result.error;
  return result.count || 0;
}

async function effectiveAdminCount(ctx: any) {
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role,is_active,hire_date,leave_date").eq("role", "admin");
  if (result.error) throw result.error;
  return (result.data || []).filter((row: any) => effective(row)).length;
}

async function assertSynchronizedDeleteReady(ctx: any) {
  const result = await ctx.supabaseAdmin.rpc("has_synchronized_member_delete_v2");
  if (result.error || result.data !== true) {
    throw new Error("尚未套用 036_v2_synchronized_member_delete.sql，為避免帳號資料不同步，已取消刪除");
  }
}

async function removeMember(ctx: any, body: any) {
  const actor = await actorProfile(ctx);
  const employeeCode = String(body?.employeeCode || "").trim();
  if (!employeeCode) throw new Error("請提供人員工號");

  const targetResult = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,is_active,hire_date,leave_date")
    .eq("employee_code", employeeCode).maybeSingle();
  if (targetResult.error) throw targetResult.error;
  const target = targetResult.data;
  if (!target) return { ok: true, deleted: false };

  const selfDelete = target.id === actor.id;
  if (actor.role === "manager" && target.role === "admin") {
    throw new Error("主管不可刪除管理員帳號");
  }
  if (selfDelete) await verifyPassword(target.employee_code, String(body?.currentPassword || ""));
  if (target.role === "admin" && await effectiveAdminCount(ctx) <= 1) {
    throw new Error("系統必須保留至少一個有效管理員");
  }

  const counts = await Promise.all([
    countRows(ctx, "schedule_entries", "member_id", target.id),
    countRows(ctx, "attendance_records", "user_id", target.id),
    countRows(ctx, "attendance_action_logs", "operator_user_id", target.id),
    countRows(ctx, "attendance_overtime_requests", "user_id", target.id),
    countRows(ctx, "overtime_review_logs", "operator_user_id", target.id),
    countRows(ctx, "meal_orders", "user_id", target.id)
  ]);
  if (counts.some((count) => count > 0)) {
    throw new Error("此人員已有班表、打卡、稽核、加班審核或訂餐資料，為保留歷史紀錄，無法刪除。");
  }

  await assertSynchronizedDeleteReady(ctx);

  // set_employee.id is linked to auth.users.id with ON DELETE CASCADE.
  // The Auth deletion and employee-profile deletion therefore commit or roll back together.
  const authDelete = await ctx.supabaseAdmin.auth.admin.deleteUser(target.id);
  if (authDelete.error && !/not found/i.test(String(authDelete.error.message || authDelete.error))) {
    throw authDelete.error;
  }

  const remaining = await ctx.supabaseAdmin.from("set_employee")
    .select("id", { count: "exact", head: true }).eq("id", target.id);
  if (remaining.error) throw remaining.error;
  if ((remaining.count || 0) > 0) {
    throw new Error("登入帳號已刪除，但人員資料未同步刪除；請立即停止操作並檢查 036 migration");
  }

  return { ok: true, deleted: true, selfDelete, employeeCode };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      return Response.json(await removeMember(ctx, await req.json()));
    } catch (error) {
      return Response.json({
        message: error instanceof Error ? error.message : "刪除人員失敗"
      }, { status: 400 });
    }
  })
};
