const { randomUUID } = require("crypto");
const { BackendError } = require("../errors");
const {
  ALLOWED_PERMISSIONS,
  GROUP_SCOPED_PERMISSIONS
} = require("../repositories/native-group-role-repository");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value, label) {
  const text = String(value || "").trim();
  if (!UUID_PATTERN.test(text)) {
    throw new BackendError(400, "UUID_INVALID", `${label}格式錯誤`);
  }
  return text;
}

function optionalUuid(value, label) {
  const text = String(value || "").trim();
  return text ? requireUuid(text, label) : "";
}

function normalizeGroup(group = {}) {
  const id = optionalUuid(group.id, "群組識別碼") || randomUUID();
  const code = String(group.code || "")
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "")
    .toUpperCase();
  const name = String(group.name || "").trim();
  if (!code || !name) {
    throw new BackendError(400, "GROUP_REQUIRED_FIELDS", "群組代碼與群組名稱不可空白");
  }
  return {
    id,
    code,
    name,
    mealEnabled: Boolean(group.mealEnabled),
    status: group.status === "inactive" ? "inactive" : "active",
    sortOrder: Math.max(0, Math.trunc(Number(group.sortOrder) || 0)),
    suppliedId: Boolean(String(group.id || "").trim())
  };
}

function normalizePermissions(value) {
  const allowed = new Set(ALLOWED_PERMISSIONS);
  const permissions = [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter((item) => allowed.has(item)))];
  if (permissions.includes("schedule_manage") && !permissions.includes("schedule_view")) {
    permissions.push("schedule_view");
  }
  return permissions;
}

function normalizeRole(role = {}) {
  const suppliedId = optionalUuid(role.id, "角色識別碼");
  const id = suppliedId || randomUUID();
  const name = String(role.name || "").trim();
  if (!name) throw new BackendError(400, "ACCESS_ROLE_NAME_REQUIRED", "角色名稱不可空白");
  let code = String(role.code || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .toLowerCase();
  if (!code) code = `role-${id.replace(/-/g, "")}`;

  const permissions = normalizePermissions(role.permissions);
  const groupIds = [...new Set((Array.isArray(role.groupIds) ? role.groupIds : [])
    .map((value) => requireUuid(value, "適用群組識別碼")))];
  const needsGroup = permissions.some((permission) => GROUP_SCOPED_PERMISSIONS.includes(permission));
  if (needsGroup && groupIds.length === 0) {
    throw new BackendError(400, "ACCESS_ROLE_GROUP_REQUIRED", "請至少選擇一個適用群組");
  }

  return {
    id,
    suppliedId: Boolean(suppliedId),
    code,
    name,
    permissions,
    groupIds,
    sortOrder: Math.max(0, Math.trunc(Number(role.sortOrder) || 0))
  };
}

function createNativeGroupRoleService(groupRoleRepository, accessRepository) {
  if (!groupRoleRepository
    || typeof groupRoleRepository.saveGroup !== "function"
    || typeof groupRoleRepository.deleteGroup !== "function"
    || typeof groupRoleRepository.reorderGroups !== "function"
    || typeof groupRoleRepository.saveRole !== "function"
    || typeof groupRoleRepository.deleteRole !== "function") {
    throw new BackendError(500, "GROUP_ROLE_REPOSITORY_REQUIRED", "群組與角色服務尚未設定資料層");
  }
  if (!accessRepository || typeof accessRepository.getAccessBundle !== "function") {
    throw new BackendError(500, "ACCESS_REPOSITORY_REQUIRED", "群組與角色服務尚未設定權限資料層");
  }

  async function getAccessBundle(employeeId) {
    return accessRepository.getAccessBundle(requireUuid(employeeId, "登入人員識別碼"));
  }

  async function saveGroup(employeeId, group) {
    const normalized = normalizeGroup(group);
    return groupRoleRepository.saveGroup(
      requireUuid(employeeId, "登入人員識別碼"),
      normalized
    );
  }

  async function deleteGroup(employeeId, groupId, confirmName) {
    return groupRoleRepository.deleteGroup(
      requireUuid(employeeId, "登入人員識別碼"),
      requireUuid(groupId, "群組識別碼"),
      String(confirmName || "").trim()
    );
  }

  async function reorderGroups(employeeId, groupIds = []) {
    const ids = [...new Set((Array.isArray(groupIds) ? groupIds : [])
      .map((value) => requireUuid(value, "群組識別碼")))];
    return groupRoleRepository.reorderGroups(
      requireUuid(employeeId, "登入人員識別碼"),
      ids
    );
  }

  async function saveRole(employeeId, role) {
    const actorId = requireUuid(employeeId, "登入人員識別碼");
    const normalized = normalizeRole(role);
    const bundle = await accessRepository.getAccessBundle(actorId);
    const activeIds = new Set((Array.isArray(bundle?.groups) ? bundle.groups : []).map((group) => String(group.id)));
    normalized.groupIds = normalized.groupIds.filter((groupId) => activeIds.has(groupId));
    const needsGroup = normalized.permissions.some((permission) => GROUP_SCOPED_PERMISSIONS.includes(permission));
    if (needsGroup && normalized.groupIds.length === 0) {
      throw new BackendError(400, "ACCESS_ROLE_GROUP_REQUIRED", "請至少選擇一個適用群組");
    }
    return groupRoleRepository.saveRole(actorId, normalized);
  }

  async function deleteRole(employeeId, roleId) {
    return groupRoleRepository.deleteRole(
      requireUuid(employeeId, "登入人員識別碼"),
      requireUuid(roleId, "角色識別碼")
    );
  }

  return Object.freeze({
    getAccessBundle,
    saveGroup,
    deleteGroup,
    reorderGroups,
    saveRole,
    deleteRole
  });
}

module.exports = {
  normalizeGroup,
  normalizePermissions,
  normalizeRole,
  createNativeGroupRoleService
};
