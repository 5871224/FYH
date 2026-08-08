from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


# Frontend authorization model: access_role_id + permissions + access_role_groups only.
replace_once(
    "src/renderer/renderer-auth-context.js",
    'function normalizeRole(role) {\n  return role === "admin" || role === "manager" ? role : "employee";\n}\n\n',
    "",
)
replace_once(
    "src/renderer/renderer-auth-context.js",
    'function getRoleLabel(role) {\n  return getRoleById(role)?.name || getRoleByLegacyRole(role)?.name || "員工";\n}\n',
    'function getRoleLabel(roleId) {\n  return getRoleById(roleId)?.name || "未指定";\n}\n',
)
replace_once(
    "src/renderer/renderer-state-normalization.js",
    '    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),\n    role: normalizeRole(member?.role)\n',
    '    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),\n    roleId: member?.roleId || ""\n',
)
replace_once(
    "src/renderer/web-api.js",
    '  function normalizeRole(role) {\n    return role === "admin" || role === "manager" ? role : "employee";\n  }\n\n',
    "",
)
replace_once(
    "src/renderer/web-api.js",
    '        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),\n        role: normalizeRole(row.role),\n        roleId: row.access_role_id || "",\n',
    '        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),\n        roleId: row.access_role_id || "",\n',
)
replace_once(
    "src/renderer/web-api.js",
    '        accessRoleId: member?.roleId || member?.role || "",\n',
    '        accessRoleId: member?.roleId || "",\n',
)

replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    'function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }\nfunction normalizeLegacyRoleValue(role) { return role === "admin" || role === "manager" ? role : "employee"; }\nfunction getRoleByLegacyRole(legacyRole) { return getAllRoles().find((role) => role.legacyRole === normalizeLegacyRoleValue(legacyRole)) || null; }\n',
    'function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }\n',
)
replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    '  normalized.members = (normalized.members || []).map((member) => {\n    const roleId = memberRoles.get(member.id) || getRoleByLegacyRole(member.role)?.id || "";\n    const deleted = Boolean(member.deleted || memberDeleted.get(member.id));\n    return { ...member, name: appendDeletedLabel(member.name, deleted), groupId: memberGroups.get(member.id) || "", roleId, role: roleId || member.role, deleted };\n  });',
    '  normalized.members = (normalized.members || []).map((member) => {\n    const roleId = memberRoles.get(member.id) || member.roleId || "";\n    const deleted = Boolean(member.deleted || memberDeleted.get(member.id));\n    return { ...member, name: appendDeletedLabel(member.name, deleted), groupId: memberGroups.get(member.id) || "", roleId, deleted };\n  });',
)
replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    '  const selectedRoleId = member?.roleId || getRoleById(member?.role)?.id || getRoleByLegacyRole(member?.role)?.id || "";\n',
    '  const selectedRoleId = member?.roleId || "";\n',
)
replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    '  const employeeRole = getAllRoles().find((role) => role.code === "employee") || getAllRoles()[0] || null;\n',
    '  const defaultAccessRole = getAllRoles().find((role) => {\n    const permissions = Array.isArray(role.permissions) ? role.permissions : [];\n    return permissions.length === 1 && permissions.includes("schedule_view");\n  }) || getAllRoles()[0] || null;\n',
)
replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    '    scheduleShiftIds: [], roleId: employeeRole?.id || "", role: employeeRole?.id || ""\n',
    '    scheduleShiftIds: [], roleId: defaultAccessRole?.id || ""\n',
)
replace_once(
    "src/renderer/renderer-groups-permissions-archive.js",
    '    monthlyRestDays: Math.max(0, Number(previousMember?.monthlyRestDays) || 0), roleId, role: roleId\n',
    '    monthlyRestDays: Math.max(0, Number(previousMember?.monthlyRestDays) || 0), roleId\n',
)

replace_once(
    "src/renderer/renderer-settings-member.js",
    '    const matchesRole = memberSettingsFilters.role === "all"\n      ? true\n      : normalizeRole(member.role) === memberSettingsFilters.role;\n',
    '    const matchesRole = memberSettingsFilters.role === "all"\n      ? true\n      : member.roleId === memberSettingsFilters.role;\n',
)
replace_once(
    "src/renderer/renderer-settings-member.js",
    '                <div>${getRoleLabel(member.role)}</div>\n',
    '                <div>${getRoleLabel(member.roleId)}</div>\n',
)
replace_once(
    "src/renderer/renderer-settings-member.js",
    '            <option value="admin" ${memberSettingsFilters.role === "admin" ? "selected" : ""}>管理員</option>\n            <option value="manager" ${memberSettingsFilters.role === "manager" ? "selected" : ""}>主管</option>\n            <option value="employee" ${memberSettingsFilters.role === "employee" ? "selected" : ""}>員工</option>\n',
    '            ${getAllRoles().map((role) => `<option value="${escapeHtml(role.id)}" ${memberSettingsFilters.role === role.id ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}\n',
)
replace_once(
    "src/renderer/renderer-settings-member.js",
    '    const shiftMap = new Map(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id]));\n',
    '    const shiftMap = new Map(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id]));\n    const accessRoleMap = new Map();\n    getAllRoles().forEach((role) => {\n      accessRoleMap.set(String(role.id || "").trim().toLowerCase(), role.id);\n      accessRoleMap.set(String(role.code || "").trim().toLowerCase(), role.id);\n      accessRoleMap.set(String(role.name || "").trim().toLowerCase(), role.id);\n    });\n    const defaultAccessRoleId = getAllRoles().find((role) => {\n      const permissions = Array.isArray(role.permissions) ? role.permissions : [];\n      return permissions.length === 1 && permissions.includes("schedule_view");\n    })?.id || "";\n',
)
replace_once(
    "src/renderer/renderer-settings-member.js",
    '      const existing = state.members.find((member) => member.code === code) || null;\n      const payload = {\n',
    '      const existing = state.members.find((member) => member.code === code) || null;\n      const importedRoleKey = String(row.roleName || "").trim().toLowerCase();\n      const importedRoleId = accessRoleMap.get(importedRoleKey) || "";\n      const roleId = isAdmin()\n        ? (importedRoleId || existing?.roleId || defaultAccessRoleId)\n        : (existing?.roleId || defaultAccessRoleId);\n      if (!roleId) {\n        skipped += 1;\n        continue;\n      }\n      const payload = {\n',
)
replace_once(
    "src/renderer/renderer-settings-member.js",
    '        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),\n        role: isAdmin() ? normalizeRole(row.role) : normalizeRole(existing?.role)\n',
    '        monthlyRestDays: Math.max(0, Number(row.monthlyRestDays) || 0),\n        roleId\n',
)

replace_once(
    "src/renderer/browser-exporter.js",
    '  function normalizeRole(role) {\n    return role === "admin" || role === "manager" ? role : "employee";\n  }\n\n  function getRoleLabel(role) {\n    const normalizedRole = normalizeRole(role);\n    if (normalizedRole === "admin") return "管理員";\n    if (normalizedRole === "manager") return "主管";\n    return "員工";\n  }\n\n  function parseRoleLabel(label) {\n    const text = String(label || "").trim();\n    if (text === "管理員" || /^admin$/i.test(text)) return "admin";\n    if (text === "主管" || /^manager$/i.test(text)) return "manager";\n    return "employee";\n  }\n\n',
    "",
)
replace_once(
    "src/renderer/browser-exporter.js",
    '    const departments = payload.state?.departments || [];\n    const shifts = payload.state?.shifts || [];\n',
    '    const departments = payload.state?.departments || [];\n    const shifts = payload.state?.shifts || [];\n    const roleNameById = new Map((payload.state?.accessRoles || []).map((role) => [role.id, role.name]));\n',
)
replace_once(
    "src/renderer/browser-exporter.js",
    '        getRoleLabel(member.role),\n',
    '        roleNameById.get(member.roleId || "") || "",\n',
)
replace_once(
    "src/renderer/browser-exporter.js",
    '        role: parseRoleLabel(roleText),\n',
    '        roleName: roleText,\n',
)

# Tests must validate the canonical model instead of the removed compatibility layer.
path = "tests/access-architecture.test.js"
text = read(path)
text = text.replace(
    "  assert.match(finalSecurity, /has_access_permission\\(auth\\.uid\\(\\),'meal_admin'\\)/);\n  assert.match(finalSecurity, /has_access_permission\\(auth\\.uid\\(\\),'leave_settings'\\)/);",
    "  assert.match(finalSecurity, /'meal_admin'/);\n  assert.match(finalSecurity, /'leave_settings'/);\n  assert.match(finalSecurity, /has_access_permission/);",
)
text = text.replace(
    "  assert.match(finalSecurity, /has_access_permission\\((?:auth\\.uid\\(\\)|\\(select auth\\.uid\\(\\)\\)),'meal_admin'\\)/);\n  assert.match(finalSecurity, /has_access_permission\\((?:auth\\.uid\\(\\)|\\(select auth\\.uid\\(\\)\\)),'leave_settings'\\)/);",
    "  assert.match(finalSecurity, /'meal_admin'/);\n  assert.match(finalSecurity, /'leave_settings'/);\n  assert.match(finalSecurity, /has_access_permission/);",
)
frontend_guard = r'''

test("前端角色只使用 access_role_id 與權限資料，不保留文字角色相容層", () => {
  const auth = read("src/renderer/renderer-auth-context.js");
  const groups = read("src/renderer/renderer-groups-permissions-archive.js");
  const members = read("src/renderer/renderer-settings-member.js");
  const normalization = read("src/renderer/renderer-state-normalization.js");
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  for (const source of [auth, groups, members, normalization, webApi, exporter]) {
    assert.doesNotMatch(source, /function normalizeRole\(/);
    assert.doesNotMatch(source, /getRoleByLegacyRole/);
  }
  assert.doesNotMatch(groups, /role\.code === "employee"/);
  assert.doesNotMatch(groups, /role:\s*roleId/);
  assert.doesNotMatch(members, /<option value=\"(?:admin|manager|employee)\"/);
  assert.doesNotMatch(exporter, /parseRoleLabel/);
  assert.match(members, /member\.roleId/);
  assert.match(webApi, /accessRoleId: member\?\.roleId/);
});
'''
if "前端角色只使用 access_role_id 與權限資料" not in text:
    text = text.rstrip() + frontend_guard
write(path, text)

path = "tests/canonical-schema.test.js"
text = read(path)
old = '    /create policy read_schedule_entries[\\s\\S]*schedule_view/,\n    /create policy update_schedule_entries[\\s\\S]*schedule_manage/\n'
new = '    /create policy read_schedule_entries[\\s\\S]*schedule_view/,\n    /create or replace function public\\.save_schedule_entries_v3[\\s\\S]*schedule_manage/\n'
if old in text:
    text = text.replace(old, new, 1)
needle = '  ]) {\n    assert.match(combined, pattern);\n  }\n});\n'
replacement = '  ]) {\n    assert.match(combined, pattern);\n  }\n  assert.doesNotMatch(combined, /create policy update_schedule_entries/);\n  assert.match(combined, /drop policy if exists update_schedule_entries on public\\.schedule_entries/);\n});\n'
if "assert.doesNotMatch(combined, /create policy update_schedule_entries/);" not in text:
    if needle not in text:
        raise SystemExit("tests/canonical-schema.test.js: loop terminator not found")
    text = text.replace(needle, replacement, 1)
write(path, text)

replace_once(
    "tests/renderer-admin-data-contracts.test.js",
    "  assert.equal(webApi.includes('accessRoleId: member?.roleId || member?.role || \"\"'), true);\n",
    "  assert.equal(webApi.includes('accessRoleId: member?.roleId || \"\"'), true);\n",
)

path = "tests/renderer-auth-context.test.js"
text = read(path)
text = text.replace(
    '  const end = authContext.indexOf("function normalizeRole", start);',
    '  const end = authContext.indexOf("function isAdmin", start);',
    1,
)
old = '''test("管理能力應完全由權限項目與適用群組決定", () => {
  const start = authContext.indexOf("function normalizeRole");
  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);
  let permissions = [];
  const context = {
    currentProfile: { role: "employee" },
    currentSession: { user: { id: "U1" } },
    groupFeatureState: { currentGroupId: "G1" },
    getAccessPermissions: () => permissions,
    hasPermission: (permission) => permissions.includes(permission),
    roleAppliesToGroup: (groupId) => groupId === "G1",
    getRoleById: () => null,
    getRoleByLegacyRole: () => null
  };
  const api = vm.runInNewContext(authContext.slice(start, end) + "\\n;({ normalizeRole, isAdmin, isManager, canEditSchedule })", context);
'''
new = '''test("管理能力應完全由權限項目與適用群組決定", () => {
  const start = authContext.indexOf("function isAdmin");
  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);
  let permissions = [];
  const context = {
    currentSession: { user: { id: "U1" } },
    groupFeatureState: { currentGroupId: "G1" },
    getAccessPermissions: () => permissions,
    hasPermission: (permission) => permissions.includes(permission),
    roleAppliesToGroup: (groupId) => groupId === "G1"
  };
  const api = vm.runInNewContext(authContext.slice(start, end) + "\\n;({ isAdmin, isManager, canEditSchedule })", context);
'''
if old not in text:
    raise SystemExit("tests/renderer-auth-context.test.js: legacy manager test block not found")
text = text.replace(old, new, 1)
write(path, text)

path = "tests/renderer-settings.test.js"
text = read(path)
old = '''    state: { members: [
      { id: "1", name: "王小明", deptId: "D1", role: "employee", payByDay: false, active: true },
      { id: "2", name: "王小華", deptId: "D1", role: "manager", payByDay: true, active: true },
      { id: "3", name: "李小明", deptId: "D2", role: "employee", payByDay: false, active: false }
    ] },
    memberSettingsFilters: { name: "王", department: "D1", role: "employee", employment: "active", salaryType: "monthly" },
    getMemberHomeDeptId: (member) => member.deptId,
    normalizeRole: (role) => role,
    isMemberCurrentlyActive: (member) => member.active
'''
new = '''    state: { members: [
      { id: "1", name: "王小明", deptId: "D1", roleId: "ROLE-A", payByDay: false, active: true },
      { id: "2", name: "王小華", deptId: "D1", roleId: "ROLE-B", payByDay: true, active: true },
      { id: "3", name: "李小明", deptId: "D2", roleId: "ROLE-A", payByDay: false, active: false }
    ] },
    memberSettingsFilters: { name: "王", department: "D1", role: "ROLE-A", employment: "active", salaryType: "monthly" },
    getMemberHomeDeptId: (member) => member.deptId,
    isMemberCurrentlyActive: (member) => member.active
'''
if old not in text:
    raise SystemExit("tests/renderer-settings.test.js: legacy role fixture not found")
text = text.replace(old, new, 1)
write(path, text)
