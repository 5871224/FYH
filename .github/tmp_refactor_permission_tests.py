from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    write(path, text.replace(old, new, 1))

# Old surface test expected the generic hasManagementAccess helper. The new
# contract explicitly forbids it and verifies each function-menu category uses
# its own canonical permission.
path = 'tests/permission-surface-alignment.test.js'
text = read(path)
text = text.replace(
    'const auth = fs.readFileSync("src/renderer/renderer-auth-context.js", "utf8");\n',
    'const auth = fs.readFileSync("src/renderer/renderer-auth-context.js", "utf8");\nconst groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");\n',
    1
)
old = '''test("簽到審核與訂餐管理不會被視為班表管理功能", () => {\n  const helper = auth.match(/function hasManagementAccess\\(\\) \\{[\\s\\S]*?\\n\\}/)?.[0] || "";\n  assert.ok(helper.includes('permission === "schedule_manage"'));\n  assert.ok(helper.includes('permission === "department_settings"'));\n  assert.ok(!helper.includes('permission !== "schedule_view"'));\n  assert.ok(!helper.includes('attendance_review'));\n  assert.ok(!helper.includes('meal_admin'));\n});'''
new = '''test("簽到審核與訂餐管理不會被視為班表管理功能", () => {\n  const menuModel = groups.match(/function getFunctionMenuSections\\(\\) \\{[\\s\\S]*?(?=function hasFunctionMenuAccess)/)?.[0] || "";\n  assert.ok(menuModel.includes('hasGroupPermission(groupId, "schedule_manage")'));\n  assert.ok(menuModel.includes('hasCommonPermission("settings")'));\n  assert.ok(menuModel.includes('hasCommonPermission("export")'));\n  assert.ok(!menuModel.includes('attendance_review'));\n  assert.ok(!menuModel.includes('meal_admin'));\n  assert.ok(!auth.includes('hasManagementAccess'));\n  assert.ok(!auth.includes('promptManagerAccess'));\n});'''
if old not in text:
    raise SystemExit('permission surface old generic test not found')
write(path, text.replace(old, new, 1))

# Auth-context unit test now verifies exact capabilities rather than a single
# generic manager boolean.
path = 'tests/renderer-auth-context.test.js'
text = read(path)
old = '''test("管理能力應完全由共用權限與群組權限決定", () => {\n  const start = authContext.indexOf("function canManagePermissions");\n  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);\n  let commonPermissions = [];\n  const actor = { groupPermissions: { G1: [] } };\n  const context = {\n    authenticated: true,\n    currentUser: { id: "U1" },\n    groupFeatureState: { currentGroupId: "G1" },\n    getCommonPermissions: () => commonPermissions,\n    getAccessActor: () => actor,\n    hasCommonPermission: (permission) => commonPermissions.includes(permission),\n    hasGroupPermission: (groupId, permission) => (actor.groupPermissions[groupId] || []).includes(permission)\n  };\n  const api = vm.runInNewContext(authContext.slice(start, end) + "\\n;({ canManagePermissions, hasManagementAccess, canEditSchedule })", context);\n  assert.equal(api.hasManagementAccess(), false);\n  actor.groupPermissions.G1 = ["schedule_view", "schedule_manage"];\n  assert.equal(api.hasManagementAccess(), true);\n  assert.equal(api.canManagePermissions(), false);\n  assert.equal(api.canEditSchedule(), true);\n  commonPermissions.push("settings");\n  assert.equal(api.canManagePermissions(), true);\n});'''
new = '''test("各管理介面應由自己的共用或群組權限決定", () => {\n  const start = authContext.indexOf("function canManagePermissions");\n  const end = authContext.indexOf("async function ensureManagerDirectoryLoaded", start);\n  let commonPermissions = [];\n  const actor = { groupPermissions: { G1: [] } };\n  const context = {\n    authenticated: true,\n    currentUser: { id: "U1" },\n    groupFeatureState: { currentGroupId: "G1" },\n    hasCommonPermission: (permission) => commonPermissions.includes(permission),\n    hasGroupPermission: (groupId, permission) => (actor.groupPermissions[groupId] || []).includes(permission)\n  };\n  const api = vm.runInNewContext(authContext.slice(start, end) + "\\n;({ canManagePermissions, canEditSchedule, canUseScheduleToolbar })", context);\n  assert.equal(api.canManagePermissions(), false);\n  assert.equal(api.canEditSchedule(), false);\n  assert.equal(api.canUseScheduleToolbar(), false);\n\n  actor.groupPermissions.G1 = ["schedule_view", "schedule_manage"];\n  assert.equal(api.canEditSchedule(), true);\n  assert.equal(api.canUseScheduleToolbar(), true);\n\n  actor.groupPermissions.G1 = ["schedule_view"];\n  commonPermissions = ["export"];\n  assert.equal(api.canUseScheduleToolbar(), false, "匯出權限不可開啟排班工具列");\n\n  commonPermissions = ["settings"];\n  assert.equal(api.canManagePermissions(), true);\n  assert.equal(api.canUseScheduleToolbar(), false, "設定權限不可開啟排班工具列");\n\n  commonPermissions = ["leave_settings"];\n  assert.equal(api.canUseScheduleToolbar(), true, "假別設定需能使用對應工具列");\n});'''
if old not in text:
    raise SystemExit('renderer auth old generic capability test not found')
write(path, text.replace(old, new, 1))

# Isolated auto-fill unit test supplies the new exact permission guard.
path = 'tests/renderer-auto-fill-schedule.test.js'
text = read(path)
text = text.replace('// 固定補丁整併前實際使用的自動補班預覽、套用與共用按鈕分流行為。', '// 固定正式自動補班預覽、套用與共用按鈕分流行為。', 1)
old = '    promptManagerAccess: () => true,\n'
new = '    requireCurrentGroupUiPermission: () => true,\n'
if old not in text:
    raise SystemExit('auto fill old permission stub not found')
write(path, text.replace(old, new, 1))
