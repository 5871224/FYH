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

function normalizeCode(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
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

async function effectiveAdminCount(ctx: any) {
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,role,is_active,hire_date,leave_date").eq("role", "admin");
  if (result.error) throw result.error;
  return (result.data || []).filter((row: any) => effective(row)).length;
}

async function findTarget(ctx: any, employeeCode: string) {
  const key = normalizeCode(employeeCode);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,is_active,hire_date,leave_date");
  if (result.error) throw result.error;
  return (result.data || []).find((row: any) => normalizeCode(row.employee_code) === key) || null;
}

async function removeMember(ctx: any, body: any) {
  const actor = await actorProfile(ctx);
  const employeeCode = String(body?.employeeCode || "").trim();
  if (!employeeCode) throw new Error("請提供人員工號");

  const target = await findTarget(ctx, employeeCode);
  if (!target) return { ok: true, deleted: false, softDeleted: false };

  const selfDelete = target.id === actor.id;
  if (actor.role === "manager" && target.role === "admin") {
    throw new Error("主管不可刪除管理員帳號");
  }
  if (selfDelete) await verifyPassword(target.employee_code, String(body?.currentPassword || ""));
  if (target.role === "admin" && await effectiveAdminCount(ctx) <= 1) {
    throw new Error("系統必須保留至少一個有效管理員");
  }

  const result = await ctx.supabaseAdmin.rpc("delete_member_account_v4", {
    p_target_id: target.id
  });
  if (result.error) throw result.error;

  const payload = result.data || { ok: true, deleted: false, softDeleted: false };
  if (payload?.blocked) {
    return new Response(JSON.stringify(payload), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }

  return {
    ...payload,
    selfDelete,
    employeeCode: target.employee_code
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const result = await removeMember(ctx, await req.json());
      return result instanceof Response ? result : Response.json(result);
    } catch (error) {
      return Response.json({
        message: error instanceof Error ? error.message : "刪除人員失敗"
      }, { status: 400 });
    }
  })
};
