from pathlib import Path
import re

root = Path('.')
r = root / 'src' / 'renderer'

# web-api: replace the whole schedule-load region so no orphaned old function body remains.
p = r / 'web-api.js'
t = p.read_text(encoding='utf-8')
start = t.index('async function loadScheduleEntries')
end = t.index('async function saveDepartmentItem', start)
canonical = '''async function loadScheduleEntries(range = {}) {
    ensureSignedIn();
    const startDate = toDateObject(range.startDate) ? range.startDate : "";
    const endDate = toDateObject(range.endDate) ? range.endDate : "";
    if (!startDate || !endDate) throw new Error("schedule range is required");
    const rows = await callRpc("get_schedule_entries_v3", {
      p_start_date: startDate,
      p_end_date: endDate
    }) || [];
    const members = Array.isArray(range.members) ? range.members : [];
    return {
      schedule: mapScheduleRows(rows, members),
      scheduleLoadedRanges: [{ startDate, endDate }]
    };
  }

  '''
t = t[:start] + canonical + t[end:]
for token in ['restSelect(', 'restInsert(', 'restUpdate(', 'restDelete(', '/rest/v1/${table}']:
    if token in t:
        raise RuntimeError(f'legacy browser data access remains: {token}')
p.write_text(t, encoding='utf-8')

# group module: remove orphaned transport function left by the first mechanical rewrite.
p = r / 'renderer-groups-permissions-archive.js'
t = p.read_text(encoding='utf-8')
state_start = t.index('const groupFeatureState =')
state_end = t.index('};', state_start) + 2
load_start = t.index('async function loadGroupAccessData', state_end)
t = t[:state_end] + '\n\n' + t[load_start:]
# Full state generic save composition is no longer part of the architecture.
merge_start = t.find('function mergeFullStateForSave(')
if merge_start >= 0:
    next_start = t.find('async function reloadGroupApplicationState', merge_start)
    t = t[:merge_start] + t[next_start:]
# Reload through the canonical bootstrap and permission state initializer.
reload_start = t.index('async function reloadGroupApplicationState')
reload_end = t.index('function isArchivedDate', reload_start)
t = t[:reload_start] + '''async function reloadGroupApplicationState() {
  const previousGroupId = groupFeatureState.currentGroupId;
  const payload = await window.schedulerApi.loadState();
  await loadGroupAccessData(payload);
  state = initializeGroupPermissionState(payload);
  if (previousGroupId && getSelectableGroups().some((group) => group.id === previousGroupId)) {
    groupFeatureState.currentGroupId = previousGroupId;
    applyCurrentGroupScope(state);
  }
  currentMember = resolveCurrentMember();
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
  renderAll();
}

''' + t[reload_end:]
if 'groupRpc(' in t or 'groupApiConfig' in t or 'installGroupPermissionArchiveFeature' in t:
    raise RuntimeError('group module still contains legacy transport/installer')
p.write_text(t, encoding='utf-8')

# Core-source manifest must match the canonical bundle manifest.
p = root / 'scripts' / 'renderer-core-source.js'
t = p.read_text(encoding='utf-8')
needle = '  "renderer-settings-member.js",\n  "renderer-auth-context.js",'
if needle in t:
    t = t.replace(needle, '  "renderer-settings-member.js",\n  "renderer-groups-permissions-archive.js",\n  "renderer-auth-context.js",')
p.write_text(t, encoding='utf-8')

# Auth helper stays independently testable while permission functions are supplied by the canonical group module.
p = r / 'renderer-auth-context.js'
t = p.read_text(encoding='utf-8')
start = t.index('function resolveCurrentMember()')
end = t.index('function normalizeRole', start)
t = t[:start] + '''function resolveCurrentMember() {
  const allMembers = typeof groupFeatureState !== "undefined" && Array.isArray(groupFeatureState.allMembers)
    ? groupFeatureState.allMembers
    : state.members;
  if (currentProfile?.id) {
    const byId = allMembers.find((member) => member.id === currentProfile.id)
      || state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return allMembers.find((member) => member.code === currentProfile.employee_code)
    || state.members.find((member) => member.code === currentProfile.employee_code)
    || null;
}

''' + t[end:]
p.write_text(t, encoding='utf-8')

# Tests: update contracts to the new canonical module/API architecture.
for filename in ['group-settings-unit-tags.test.js', 'permission-settings-loading-ui.test.js']:
    p = root / 'tests' / filename
    t = p.read_text(encoding='utf-8').replace('renderer-groups-permissions-archive.mjs', 'renderer-groups-permissions-archive.js')
    p.write_text(t, encoding='utf-8')

p = root / 'tests' / 'lazy-page-data-loading.test.js'
t = p.read_text(encoding='utf-8')
old = '''test("簽到簿只讀目前頁籤，不再先載簽到審核", () => {
  const bridge = read("src/renderer/renderer-group-backend-bridges.mjs");
  const docsBridge = read("docs/renderer-group-backend-bridges.mjs");

  assert.equal(bridge, docsBridge);
  assert.doesNotMatch(bridge, /loadRecordsPageWithReview/);
  assert.match(bridge, /loadVisibleRecordsTab/);
  assert.match(bridge, /recordsState\\.activeTab === "review"/);
  assert.match(bridge, /await loadAttendanceReview\\(shouldRender\\)/);
  assert.match(bridge, /await loadPersonalRecordsOnly\\(shouldRender\\)/);
  assert.match(bridge, /button\\[data-records-tab\\]/);
});'''
new = '''test("簽到簿只讀目前頁籤，群組審核 API 由正式模組直接提供", () => {
  const records = read("src/renderer/renderer-records-page.js");
  const webApi = read("src/renderer/web-api.js");
  const docsApi = read("docs/web-api.js");

  assert.equal(webApi, docsApi);
  assert.doesNotMatch(records, /loadRecordsPageWithReview/);
  assert.match(records, /recordsState\\.activeTab === "review"/);
  assert.match(webApi, /requestFunction\\("attendance-review-groups"/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});'''
if old not in t:
    raise RuntimeError('lazy-page test block not found')
t = t.replace(old, new)
p.write_text(t, encoding='utf-8')

p = root / 'tests' / 'renderer-admin-data-contracts.test.js'
t = p.read_text(encoding='utf-8')
old = '''  assert.equal(webApi.includes('async function deleteCatalogItem(category, itemId)'), true);
  assert.equal(webApi.includes('requestFunction("catalog-admin"'), true);
  assert.equal(webApi.includes('itemId: String(itemId || "")'), true);
  assert.equal(webApi.includes("    deleteCatalogItem,"), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || "").trim()'), true);'''
new = '''  assert.equal(webApi.includes('async function deleteCatalogItem(category, itemId)'), true);
  assert.equal(webApi.includes('callRpc("delete_catalog_item_v3"'), true);
  assert.equal(webApi.includes('p_item_id: String(itemId || "")'), true);
  assert.equal(webApi.includes('requestFunction("catalog-admin"'), false);
  assert.equal(webApi.includes("    deleteCatalogItem,"), true);
  assert.equal(webApi.includes('previousEmployeeCode: String(previousEmployeeCode || "").trim()'), true);
  assert.equal(webApi.includes('groupId: member?.groupId || ""'), true);
  assert.equal(webApi.includes('accessRoleId: member?.roleId || member?.role || ""'), true);'''
if old not in t:
    raise RuntimeError('admin data test assertions not found')
t = t.replace(old, new)
p.write_text(t, encoding='utf-8')

p = root / 'tests' / 'renderer-auth-context.test.js'
t = p.read_text(encoding='utf-8')
start = t.index('test("管理權限應只允許管理員與主管"')
end = t.index('test("假別明細與設定輔助', start)
block = '''test("管理能力應完全由權限項目與適用群組決定", () => {
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
  assert.equal(api.isManager(), false);
  permissions = ["schedule_view", "schedule_manage"];
  assert.equal(api.isManager(), true);
  assert.equal(api.isAdmin(), false);
  assert.equal(api.canEditSchedule(), true);
  permissions.push("permission_settings");
  assert.equal(api.isAdmin(), true);
});

'''
t = t[:start] + block + t[end:]
p.write_text(t, encoding='utf-8')

p = root / 'tests' / 'renderer-module-boundaries.test.js'
t = p.read_text(encoding='utf-8').replace('assert.deepEqual(topLevelFunctions, ["loadApp", "refreshScheduleCatalogsAfterInitialRender"]);', 'assert.deepEqual(topLevelFunctions, ["loadApp"]);')
p.write_text(t, encoding='utf-8')

p = root / 'tests' / 'settings-width-and-catalog-delete.test.js'
t = p.read_text(encoding='utf-8')
start = t.index('test("班別假別加班刪除的前後端參數名稱一致"')
end = t.index('test("設定刪除失敗時', start)
block = '''test("班別假別加班刪除只走明確 RPC 契約", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function resolveManagerMemberProfileId", start);
  const block = webApi.slice(start, end);
  assert.equal(block.includes('callRpc("delete_catalog_item_v3"'), true);
  assert.equal(block.includes('p_category: String(category || "")'), true);
  assert.equal(block.includes('p_item_id: String(itemId || "")'), true);
  assert.equal(block.includes('requestFunction("catalog-admin"'), false);
});

'''
t = t[:start] + block + t[end:]
p.write_text(t, encoding='utf-8')

# VM ordering test now mocks the explicit persistence API rather than the deleted generic queue-save path.
p = root / 'tests' / 'member-order-and-department-width.test.js'
t = p.read_text(encoding='utf-8')
needle = '    queueSave: () => calls.push("save"),'
if needle in t:
    t = t.replace(needle, '    queueSave: () => calls.push("save"),\n    window: { schedulerApi: { reorderSettings: async () => calls.push("reorder") } },')
p.write_text(t, encoding='utf-8')

print('access cleanup applied')
