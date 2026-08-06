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
  return Boolean(
    profile
    && !profile.deleted_at
    && (!profile.hire_date || today >= profile.hire_date)
    && (!end || today <= end)
  );
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

async function hasPermission(ctx: any, userId: string, permission: string) {
  const result = await ctx.supabaseAdmin.rpc("has_access_permission", {
    p_user_id: userId,
    p_permission: permission
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function canAccessGroup(ctx: any, userId: string, groupId: string, permission: string) {
  if (!groupId) return false;
  const result = await ctx.supabaseAdmin.rpc("can_access_group", {
    p_user_id: userId,
    p_group_id: groupId,
    p_permission: permission
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

async function actorProfile(ctx: any) {
  const actorId = ctx.userClaims?.sub || ctx.userClaims?.id || "";
  if (!actorId) throw new Error("請先登入");
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,group_id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", actorId)
    .is("deleted_at", null)
    .single();
  if (result.error) throw result.error;
  if (!effective(result.data)) throw new Error("此帳號目前不在有效期間");
  if (!await hasPermission(ctx, actorId, "member_settings")) {
    throw new Error("沒有刪除人員的權限");
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

async function effectivePermissionAdminCount(ctx: any) {
  const [employeesResult, rolesResult] = await Promise.all([
    ctx.supabaseAdmin.from("set_employee")
      .select("id,access_role_id,hire_date,leave_date,deleted_at")
      .is("deleted_at", null),
    ctx.supabaseAdmin.from("access_roles").select("id,permissions")
  ]);
  if (employeesResult.error) throw employeesResult.error;
  if (rolesResult.error) throw rolesResult.error;
  const permissionRoleIds = new Set(
    (rolesResult.data || [])
      .filter((role: any) => Array.isArray(role.permissions) && role.permissions.includes("permission_settings"))
      .map((role: any) => role.id)
  );
  return (employeesResult.data || []).filter((row: any) => (
    permissionRoleIds.has(row.access_role_id) && effective(row)
  )).length;
}

async function findTarget(ctx: any, employeeCode: string) {
  const key = normalizeCode(employeeCode);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,role,group_id,access_role_id,hire_date,leave_date,deleted_at")
    .is("deleted_at", null);
  if (result.error) throw result.error;
  return (result.data || []).find((row: any) => normalizeCode(row.employee_code) === key) || null;
}

async function roleHasPermission(ctx: any, roleId: string, permission: string) {
  if (!roleId) return false;
  const result = await ctx.supabaseAdmin.from("access_roles")
    .select("permissions")
    .eq("id", roleId)
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(Array.isArray(result.data?.permissions) && result.data.permissions.includes(permission));
}

async function removeMember(ctx: any, body: any) {
  const actor = await actorProfile(ctx);
  const employeeCode = String(body?.employeeCode || "").trim();
  if (!employeeCode) throw new Error("請提供人員工號");

  const target = await findTarget(ctx, employeeCode);
  if (!target) return { ok: true, deleted: false, softDeleted: false };
  if (!target.group_id || !await canAccessGroup(ctx, actor.id, target.group_id, "member_settings")) {
    throw new Error("此角色不可管理該人員所屬群組");
  }

  const selfDelete = target.id === actor.id;
  if (selfDelete) await verifyPassword(target.employee_code, String(body?.currentPassword || ""));

  const targetCanManagePermissions = await roleHasPermission(
    ctx,
    target.access_role_id,
    "permission_settings"
  );
  if (targetCanManagePermissions && await effectivePermissionAdminCount(ctx) <= 1) {
    throw new Error("系統必須保留至少一個具有權限設定能力的有效帳號");
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
