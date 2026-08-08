import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, addDaysToDateString, canAccessGroup, hasPermission, isProfileEffective, isUuid, rpcBoolean, taipeiDateString } from "../_shared/runtime.ts";

type MemberPayload = {
  employeeCode?: string;
  fullName?: string;
  groupId?: string;
  accessRoleId?: string;
  hireDate?: string | null;
  leaveDate?: string | null;
  payByDay?: boolean;
  fixedRestWeekday?: number;
  homeDepartmentId?: string;
  scheduleShiftIds?: string[];
  monthlyRestDays?: number;
};

type AccessRole = {
  id: string;
  code: string;
  name: string;
  permissions: string[];
};

const DEFAULT_PASSWORD = "0000";
const MEMBER_PERMISSION = "member_settings";
const PRIVILEGED_PERMISSION = "permission_settings";

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}


function isProfileEffective(profile: any, today = taipeiDateString()) {
  const effectiveEndDate = profile?.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return Boolean(
    !profile?.deleted_at
      && (!profile?.hire_date || today >= profile.hire_date)
      && (!effectiveEndDate || today <= effectiveEndDate)
  );
}


function normalizeCodeKey(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function buildLoginEmail(employeeCode: string) {
  const normalized = String(employeeCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("工號無法建立登入帳號");
  return `${normalized}@local.invalid`;
}





async function requireMemberManager(ctx: any) {
  const actorId = actorIdOf(ctx);
  if (!await hasPermission(ctx, actorId, MEMBER_PERMISSION)) {
    throw new Error("沒有管理人員的權限");
  }
  return {
    actorId,
    canManagePermissions: await hasPermission(ctx, actorId, PRIVILEGED_PERMISSION)
  };
}

function normalizeMember(member: MemberPayload) {
  const employeeCode = String(member?.employeeCode || "").trim();
  const fullName = String(member?.fullName || "").trim();
  const groupId = String(member?.groupId || "").trim();
  const accessRoleId = String(member?.accessRoleId || "").trim();
  if (!employeeCode || !fullName) throw new Error("缺少工號或姓名");
  if (!isUuid(groupId)) throw new Error("請指定有效群組");
  if (!isUuid(accessRoleId)) throw new Error("請指定有效權限角色");

  const scheduleShiftIds = Array.isArray(member?.scheduleShiftIds)
    ? [...new Set(member.scheduleShiftIds.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];
  if (scheduleShiftIds.some((id) => !isUuid(id))) throw new Error("排班班別資料格式錯誤");

  return {
    employeeCode,
    fullName,
    groupId,
    accessRoleId,
    hireDate: member?.hireDate || null,
    leaveDate: member?.leaveDate || null,
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: Math.min(6, Math.max(0, Number(member?.fixedRestWeekday) || 0)),
    homeDepartmentId: String(member?.homeDepartmentId || "").trim(),
    scheduleShiftIds,
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    authEmail: buildLoginEmail(employeeCode)
  };
}

async function findProfileByCode(ctx: any, employeeCode: string) {
  const key = normalizeCodeKey(employeeCode);
  if (!key) return null;
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,employee_code,full_name,role,access_role_id,group_id,hire_date,leave_date,deleted_at")
    .ilike("employee_code", employeeCode.trim())
    .limit(10);
  if (error) throw error;
  return (data || []).find((row: any) => normalizeCodeKey(row.employee_code) === key) || null;
}

async function getAccessRole(ctx: any, roleId: string): Promise<AccessRole> {
  const { data, error } = await ctx.supabaseAdmin
    .from("access_roles")
    .select("id,code,name,permissions,legacy_role")
    .eq("id", roleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("找不到權限角色");
  return {
    ...data,
    permissions: Array.isArray(data.permissions) ? data.permissions : []
  } as AccessRole;
}

async function roleAppliesToGroup(ctx: any, roleId: string, groupId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("access_role_groups")
    .select("group_id")
    .eq("role_id", roleId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.group_id);
}

async function validateGroup(ctx: any, groupId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from("schedule_groups")
    .select("id,status,deleted_at")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at || data.status !== "active") throw new Error("找不到可使用的群組");
}

async function resolveDepartment(ctx: any, departmentId: string, groupId: string) {
  const itemId = String(departmentId || "").trim();
  if (!itemId) return null;
  if (!isUuid(itemId)) throw new Error("所屬單位格式錯誤");
  const { data, error } = await ctx.supabaseAdmin
    .from("set_departments")
    .select("id,group_id,deleted_at")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at || data.group_id !== groupId) throw new Error("所屬單位不在指定群組或已刪除");
  return data.id;
}

async function validateScheduleShifts(ctx: any, shiftIds: string[], groupId: string) {
  if (!shiftIds.length) return;
  const { data, error } = await ctx.supabaseAdmin
    .from("set_shift")
    .select("id,group_id,deleted_at")
    .in("id", shiftIds);
  if (error) throw error;
  const valid = new Set((data || [])
    .filter((row: any) => !row.deleted_at && row.group_id === groupId)
    .map((row: any) => row.id));
  if (shiftIds.some((id) => !valid.has(id))) throw new Error("排班班別不在指定群組或已刪除");
}

async function roleHasPrivilegedPermission(ctx: any, roleId: string | null | undefined) {
  if (!roleId || !isUuid(roleId)) return false;
  const role = await getAccessRole(ctx, roleId);
  return role.permissions.includes(PRIVILEGED_PERMISSION);
}

async function countEffectivePrivilegedAccounts(ctx: any) {
  const { data: roles, error: roleError } = await ctx.supabaseAdmin
    .from("access_roles")
    .select("id,permissions");
  if (roleError) throw roleError;
  const privilegedRoleIds = (roles || [])
    .filter((role: any) => Array.isArray(role.permissions) && role.permissions.includes(PRIVILEGED_PERMISSION))
    .map((role: any) => role.id);
  if (!privilegedRoleIds.length) return 0;
  const { data, error } = await ctx.supabaseAdmin
    .from("set_employee")
    .select("id,access_role_id,hire_date,leave_date,deleted_at")
    .in("access_role_id", privilegedRoleIds);
  if (error) throw error;
  return (data || []).filter((profile: any) => isProfileEffective(profile)).length;
}

async function assertLastPrivilegedAccountProtected(ctx: any, existingProfile: any, nextRole: AccessRole, nextMember: any) {
  const wasPrivileged = await roleHasPrivilegedPermission(ctx, existingProfile?.access_role_id);
  if (!wasPrivileged) return;
  const remainsPrivileged = nextRole.permissions.includes(PRIVILEGED_PERMISSION)
    && isProfileEffective({
      ...existingProfile,
      deleted_at: null,
      hire_date: nextMember.hireDate,
      leave_date: nextMember.leaveDate
    });
  if (!remainsPrivileged && await countEffectivePrivilegedAccounts(ctx) <= 1) {
    throw new Error("系統必須保留至少一個有效的權限管理帳號");
  }
}

async function assertActorMayManageTarget(ctx: any, actor: { actorId: string; canManagePermissions: boolean }, profile: any) {
  if (!profile) return;
  if (!profile.group_id || !await canAccessGroup(ctx, actor.actorId, profile.group_id)) {
    throw new Error("沒有管理此人員所屬群組的權限");
  }
  if (await roleHasPrivilegedPermission(ctx, profile.access_role_id) && !actor.canManagePermissions) {
    throw new Error("只有權限管理者可以修改此帳號");
  }
}

async function upsertMember(ctx: any, body: any) {
  const actor = await requireMemberManager(ctx);
  const member = normalizeMember(body?.member || {});
  const previousEmployeeCode = String(body?.previousEmployeeCode || "").trim();
  const targetProfile = await findProfileByCode(ctx, member.employeeCode);
  let profile = null;

  if (!await canAccessGroup(ctx, actor.actorId, member.groupId)) {
    throw new Error("沒有管理指定群組人員的權限");
  }
  await validateGroup(ctx, member.groupId);

  if (previousEmployeeCode) {
    profile = await findProfileByCode(ctx, previousEmployeeCode);
    if (!profile || profile.deleted_at) throw new Error("找不到原人員資料，請重新整理後再試");
    if (targetProfile && targetProfile.id !== profile.id) throw new Error(`工號 ${member.employeeCode} 已存在，不能重複使用`);
  } else if (targetProfile) {
    throw new Error(`工號 ${member.employeeCode} 已存在，不能重複使用`);
  }

  await assertActorMayManageTarget(ctx, actor, profile);
  const accessRole = await getAccessRole(ctx, member.accessRoleId);
  if (!await roleAppliesToGroup(ctx, accessRole.id, member.groupId)) {
    throw new Error("此權限角色不適用指定群組");
  }
  if (accessRole.permissions.includes(PRIVILEGED_PERMISSION) && !actor.canManagePermissions) {
    throw new Error("只有權限管理者可以指定此權限角色");
  }
  if (profile) await assertLastPrivilegedAccountProtected(ctx, profile, accessRole, member);

  const homeDepartmentId = await resolveDepartment(ctx, member.homeDepartmentId, member.groupId);
  await validateScheduleShifts(ctx, member.scheduleShiftIds, member.groupId);

  const profileValues = {
    employee_code: member.employeeCode,
    full_name: member.fullName,
    role: accessRole.legacy_role || "employee",
    access_role_id: accessRole.id,
    group_id: member.groupId,
    hire_date: member.hireDate,
    leave_date: member.leaveDate,
    pay_by_day: member.payByDay,
    fixed_rest_weekday: member.fixedRestWeekday,
    home_department_id: homeDepartmentId,
    schedule_shift_ids: member.scheduleShiftIds,
    monthly_rest_days: member.monthlyRestDays,
    deleted_at: null
  };

  if (!profile) {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: member.authEmail,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { employee_code: member.employeeCode, full_name: member.fullName }
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("建立登入帳號失敗");

    const { error: insertError } = await ctx.supabaseAdmin
      .from("set_employee")
      .insert({ id: userId, ...profileValues });
    if (insertError) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw insertError;
    }
    return { ok: true, created: true, employeeCode: member.employeeCode, authEmail: member.authEmail };
  }

  const oldAuthEmail = buildLoginEmail(profile.employee_code);
  const { error: updateAuthError } = await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, {
    email: member.authEmail,
    email_confirm: true,
    user_metadata: { employee_code: member.employeeCode, full_name: member.fullName }
  });
  if (updateAuthError && !/not found/i.test(String(updateAuthError.message || updateAuthError))) throw updateAuthError;

  const { error: updateProfileError } = await ctx.supabaseAdmin
    .from("set_employee")
    .update(profileValues)
    .eq("id", profile.id)
    .is("deleted_at", null);
  if (updateProfileError) {
    if (!updateAuthError) {
      await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, {
        email: oldAuthEmail,
        email_confirm: true,
        user_metadata: { employee_code: profile.employee_code, full_name: profile.full_name || "" }
      }).catch(() => undefined);
    }
    throw updateProfileError;
  }

  return { ok: true, created: false, employeeCode: member.employeeCode, authEmail: member.authEmail };
}

async function resetPassword(ctx: any, body: any) {
  const actor = await requireMemberManager(ctx);
  const employeeCode = String(body?.employeeCode || "").trim();
  const password = String(body?.password || DEFAULT_PASSWORD);
  if (!employeeCode) throw new Error("缺少工號");
  if (!password) throw new Error("密碼不可空白");
  const profile = await findProfileByCode(ctx, employeeCode);
  if (!profile?.id || profile.deleted_at) {
    return new Response(JSON.stringify({ message: "找不到這位人員的登入帳號" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  await assertActorMayManageTarget(ctx, actor, profile);
  const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(profile.id, { password });
  if (error) throw error;
  return { ok: true, employeeCode };
}

async function verifyCurrentPassword(employeeCode: string, password: string) {
  if (!password) throw new Error("刪除自己的帳號前，請輸入目前密碼");
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anonKey) throw new Error("伺服器缺少登入驗證設定");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: buildLoginEmail(employeeCode), password })
  });
  if (!response.ok) throw new Error("目前密碼不正確");
}

async function deleteMember(ctx: any, body: any) {
  const actor = await requireMemberManager(ctx);
  const employeeCode = String(body?.employeeCode || "").trim();
  if (!employeeCode) throw new Error("請提供人員工號");

  const profile = await findProfileByCode(ctx, employeeCode);
  if (!profile?.id || profile.deleted_at) return { ok: true, deleted: false, softDeleted: false };
  await assertActorMayManageTarget(ctx, actor, profile);
  const selfDelete = profile.id === actor.actorId;
  if (selfDelete) await verifyCurrentPassword(profile.employee_code, String(body?.currentPassword || ""));
  if (await roleHasPrivilegedPermission(ctx, profile.access_role_id) && await countEffectivePrivilegedAccounts(ctx) <= 1) {
    throw new Error("系統必須保留至少一個有效的權限管理帳號");
  }

  const { data, error } = await ctx.supabaseAdmin.rpc("delete_member_account_v4", { p_target_id: profile.id });
  if (error) throw error;
  const result = data || { ok: true, deleted: false, softDeleted: false };
  if (result?.blocked) {
    return new Response(JSON.stringify(result), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }
  return { ...result, selfDelete, employeeCode };
}

console.assert(buildLoginEmail("SELF_CHECK") === "self_check@local.invalid", "member-auth-admin buildLoginEmail failed");

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const body = await req.json();
      if (body?.action === "upsert_member") return Response.json(await upsertMember(ctx, body));
      if (body?.action === "reset_password") {
        const result = await resetPassword(ctx, body);
        return result instanceof Response ? result : Response.json(result);
      }
      if (body?.action === "delete_member") {
        const result = await deleteMember(ctx, body);
        return result instanceof Response ? result : Response.json(result);
      }
      return new Response(JSON.stringify({ message: "不支援的操作" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "系統錯誤";
      const forbidden = /沒有|只有權限管理者|權限/.test(message);
      return new Response(JSON.stringify({ message }), {
        status: forbidden ? 403 : 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
};
