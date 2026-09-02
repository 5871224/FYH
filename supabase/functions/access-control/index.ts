import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, isProfileEffective, isUuid } from "../_shared/runtime.ts";

const COMMON_PERMISSIONS = new Set(["settings", "export", "leave_settings"]);
const GROUP_PERMISSIONS = new Set(["schedule_view", "schedule_manage", "department_settings", "attendance_review", "meal_admin"]);
const SETTINGS_PERMISSION = "settings";

function uniqueAllowed(values: unknown, allowed: Set<string>) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter((value) => allowed.has(value)))];
}

function normalizeGroupRows(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const byGroup = new Map<string, string[]>();
  for (const row of rows) {
    const groupId = String(row?.groupId || "").trim();
    if (!isUuid(groupId)) continue;
    const permissions = uniqueAllowed(row?.permissions, GROUP_PERMISSIONS);
    if (permissions.includes("schedule_manage") && !permissions.includes("schedule_view")) permissions.unshift("schedule_view");
    if (permissions.length) byGroup.set(groupId, permissions);
  }
  return [...byGroup.entries()].map(([groupId, permissions]) => ({ groupId, permissions }));
}

async function getActor(ctx: any) {
  const actorId = actorIdOf(ctx);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,group_id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", actorId).is("deleted_at", null).single();
  if (result.error) throw result.error;
  if (!isProfileEffective(result.data)) throw new Error("此帳號目前不在有效期間");
  const roleResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,name_vi,common_permissions,is_system,sort_order")
    .eq("id", result.data.access_role_id).single();
  if (roleResult.error) throw roleResult.error;
  return { profile: result.data, role: roleResult.data };
}

async function getGroupPermissionRows(ctx: any, roleIds: string[]) {
  if (!roleIds.length) return [];
  const result = await ctx.supabaseAdmin.from("access_role_group_permissions")
    .select("role_id,group_id,permissions").in("role_id", roleIds);
  if (result.error) throw result.error;
  return result.data || [];
}

function roleDto(role: any, rows: any[]) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    nameVi: role.name_vi || "",
    commonPermissions: Array.isArray(role.common_permissions) ? role.common_permissions : [],
    groupPermissions: rows.filter((row) => row.role_id === role.id).map((row) => ({
      groupId: row.group_id,
      permissions: Array.isArray(row.permissions) ? row.permissions : []
    })),
    isSystem: Boolean(role.is_system),
    sortOrder: Number(role.sort_order || 0)
  };
}

async function bundle(ctx: any) {
  const actor = await getActor(ctx);
  const actorRows = await getGroupPermissionRows(ctx, [actor.role.id]);
  const actorGroupPermissions = Object.fromEntries(actorRows.map((row: any) => [row.group_id, Array.isArray(row.permissions) ? row.permissions : []]));
  const commonPermissions = Array.isArray(actor.role.common_permissions) ? actor.role.common_permissions : [];
  const canSettings = commonPermissions.includes(SETTINGS_PERMISSION);
  const managedGroupIds = actorRows.filter((row: any) => (row.permissions || []).includes("schedule_manage")).map((row: any) => row.group_id);
  const visibleGroupIds = new Set(actorRows.filter((row: any) => (row.permissions || []).length).map((row: any) => row.group_id));

  const groupResult = await ctx.supabaseAdmin.from("schedule_groups")
    .select("id,code,name,name_vi,meal_enabled,status,sort_order,deleted_at")
    .is("deleted_at", null).order("sort_order").order("name");
  if (groupResult.error) throw groupResult.error;
  const allGroups = groupResult.data || [];
  const groups = canSettings ? allGroups : allGroups.filter((group: any) => visibleGroupIds.has(group.id));

  const roleResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,name_vi,common_permissions,is_system,sort_order").order("sort_order").order("name");
  if (roleResult.error) throw roleResult.error;
  let roles = roleResult.data || [];
  const allRoleRows = await getGroupPermissionRows(ctx, roles.map((role: any) => role.id));
  if (!canSettings) {
    const visibleRoleIds = new Set([actor.role.id]);
    for (const row of allRoleRows) if (managedGroupIds.includes(row.group_id)) visibleRoleIds.add(row.role_id);
    roles = roles.filter((role: any) => visibleRoleIds.has(role.id));
  }

  const departmentResult = await ctx.supabaseAdmin.from("set_departments")
    .select("group_id,name,sort_order,deleted_at").is("deleted_at", null);
  if (departmentResult.error) throw departmentResult.error;
  const unitNames = new Map<string, string[]>();
  for (const department of departmentResult.data || []) {
    const list = unitNames.get(department.group_id) || [];
    list.push(department.name);
    unitNames.set(department.group_id, list);
  }

  return {
    actor: {
      groupId: actor.profile.group_id,
      roleId: actor.role.id,
      roleName: actor.role.name,
      commonPermissions,
      groupPermissions: actorGroupPermissions
    },
    groups: groups.map((group: any) => ({
      id: group.id, code: group.code, name: group.name, nameVi: group.name_vi || "",
      mealEnabled: Boolean(group.meal_enabled), status: group.status, sortOrder: Number(group.sort_order || 0),
      unitNames: unitNames.get(group.id) || []
    })),
    roles: roles.map((role: any) => roleDto(role, allRoleRows))
  };
}

async function countEffectiveSettingsAccounts(ctx: any, excludingRoleId = "") {
  const roleResult = await ctx.supabaseAdmin.from("access_roles").select("id,common_permissions");
  if (roleResult.error) throw roleResult.error;
  const roleIds = (roleResult.data || [])
    .filter((role: any) => role.id !== excludingRoleId && (role.common_permissions || []).includes(SETTINGS_PERMISSION))
    .map((role: any) => role.id);
  if (!roleIds.length) return 0;
  const employeeResult = await ctx.supabaseAdmin.from("set_employee")
    .select("id,access_role_id,hire_date,leave_date,deleted_at").in("access_role_id", roleIds).is("deleted_at", null);
  if (employeeResult.error) throw employeeResult.error;
  return (employeeResult.data || []).filter((profile: any) => isProfileEffective(profile)).length;
}

async function assertSettings(actor: any) {
  if (!(actor.role.common_permissions || []).includes(SETTINGS_PERMISSION)) throw new Error("沒有設定權限");
}

async function saveRole(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const input = body?.role || {};
  const requestedId = String(input.id || "").trim();
  const id = requestedId && isUuid(requestedId) ? requestedId : crypto.randomUUID();
  const name = String(input.name || "").trim();
  const nameVi = String(input.nameVi || "").trim();
  if (!name) throw new Error("角色名稱不可空白");
  const commonPermissions = uniqueAllowed(input.commonPermissions, COMMON_PERMISSIONS);
  const groupPermissions = normalizeGroupRows(input.groupPermissions);

  const groupIds = groupPermissions.map((row) => row.groupId);
  if (groupIds.length) {
    const groupResult = await ctx.supabaseAdmin.from("schedule_groups").select("id").in("id", groupIds).is("deleted_at", null);
    if (groupResult.error) throw groupResult.error;
    const valid = new Set((groupResult.data || []).map((row: any) => row.id));
    if (groupIds.some((groupId) => !valid.has(groupId))) throw new Error("群組權限包含不存在的群組");
  }

  const existingResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,common_permissions,is_system,sort_order").eq("id", id).maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data || null;
  if (existing && (existing.common_permissions || []).includes(SETTINGS_PERMISSION)
      && !commonPermissions.includes(SETTINGS_PERMISSION)) {
    const usersResult = await ctx.supabaseAdmin.from("set_employee")
      .select("id,hire_date,leave_date,deleted_at").eq("access_role_id", id).is("deleted_at", null);
    if (usersResult.error) throw usersResult.error;
    const hasEffectiveUser = (usersResult.data || []).some((profile: any) => isProfileEffective(profile));
    if (hasEffectiveUser && await countEffectiveSettingsAccounts(ctx, id) === 0) {
      throw new Error("系統必須保留至少一個有效的權限管理帳號");
    }
  }

  const code = existing?.code || `role-${id.replaceAll("-", "")}`;
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : Number(existing?.sort_order ?? 1000000);
  const upsertResult = await ctx.supabaseAdmin.from("access_roles").upsert({
    id, code, name, name_vi: nameVi || null, common_permissions: commonPermissions,
    is_system: Boolean(existing?.is_system), sort_order: sortOrder, updated_at: new Date().toISOString()
  }).select("id,code,name,name_vi,common_permissions,is_system,sort_order").single();
  if (upsertResult.error) throw upsertResult.error;

  const deleteResult = await ctx.supabaseAdmin.from("access_role_group_permissions").delete().eq("role_id", id);
  if (deleteResult.error) throw deleteResult.error;
  if (groupPermissions.length) {
    const insertResult = await ctx.supabaseAdmin.from("access_role_group_permissions").insert(
      groupPermissions.map((row) => ({ role_id: id, group_id: row.groupId, permissions: row.permissions }))
    );
    if (insertResult.error) throw insertResult.error;
  }
  const rows = await getGroupPermissionRows(ctx, [id]);
  return { ok: true, role: roleDto(upsertResult.data, rows) };
}

async function deleteRole(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const roleId = String(body?.roleId || "").trim();
  if (!isUuid(roleId)) throw new Error("角色識別碼格式錯誤");
  const usedResult = await ctx.supabaseAdmin.from("set_employee").select("id").eq("access_role_id", roleId).is("deleted_at", null).limit(1);
  if (usedResult.error) throw usedResult.error;
  if ((usedResult.data || []).length) throw new Error("此角色仍有人員使用，請先改用其他角色");
  const result = await ctx.supabaseAdmin.from("access_roles").delete().eq("id", roleId);
  if (result.error) throw result.error;
  return { ok: true };
}

async function reorderRoles(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const ids = [...new Set((Array.isArray(body?.roleIds) ? body.roleIds : []).map((id: any) => String(id || "").trim()).filter(isUuid))];
  for (let index = 0; index < ids.length; index += 1) {
    const result = await ctx.supabaseAdmin.from("access_roles").update({ sort_order: index, updated_at: new Date().toISOString() }).eq("id", ids[index]);
    if (result.error) throw result.error;
  }
  return { ok: true, count: ids.length };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actor = await getActor(ctx);
      const body = await req.json();
      const action = String(body?.action || "bundle");
      if (action === "bundle") return Response.json(await bundle(ctx));
      if (action === "saveRole") return Response.json(await saveRole(ctx, actor, body));
      if (action === "deleteRole") return Response.json(await deleteRole(ctx, actor, body));
      if (action === "reorderRoles") return Response.json(await reorderRoles(ctx, actor, body));
      throw new Error("不支援的權限操作");
    } catch (error) {
      const message = error instanceof Error ? error.message : "權限操作失敗";
      return Response.json({ message }, { status: /權限/.test(message) ? 403 : 400 });
    }
  })
};
