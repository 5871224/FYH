from pathlib import Path
import re

ROOT = Path('.')
R = ROOT / 'src' / 'renderer'


def replace_function(text, name, new_source=None):
    marker = f'async function {name}('
    start = text.find(marker)
    if start < 0:
        marker = f'function {name}('
        start = text.find(marker)
    if start < 0:
        raise RuntimeError(f'function not found: {name}')
    brace = text.find('{', start)
    if brace < 0:
        raise RuntimeError(f'function body not found: {name}')
    depth = 0
    quote = None
    escape = False
    template_depth = 0
    i = brace
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            quote = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                while end < len(text) and text[end] in ' \t':
                    end += 1
                if end < len(text) and text[end] == ';':
                    end += 1
                if end < len(text) and text[end] == '\n':
                    end += 1
                replacement = '' if new_source is None else new_source.rstrip() + '\n\n'
                return text[:start] + replacement + text[end:]
        i += 1
    raise RuntimeError(f'unclosed function: {name}')


def replace_between(text, start_marker, end_marker, replacement):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f'markers not found: {start_marker} / {end_marker}')
    return text[:start] + replacement.rstrip() + '\n\n' + text[end:]


# ---------------------------------------------------------------------------
# Canonical browser API: auth + explicit RPC/Edge endpoints only.
# ---------------------------------------------------------------------------
path = R / 'web-api.js'
text = path.read_text(encoding='utf-8')

transport = r'''  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  async function callRpc(functionName, payload = {}, options = {}) {
    const { prefer = "return=representation" } = options;
    return requestJson(`/rest/v1/rpc/${functionName}`, {
      method: "POST",
      auth: true,
      headers: {
        Accept: "application/json",
        Prefer: prefer
      },
      body: JSON.stringify(payload || {})
    });
  }'''
text = replace_between(text, '  function buildQuery(params = {}) {', '  async function getMyProfileRow() {', transport)
text = text.replace('restRpc(', 'callRpc(')

# directory/profile endpoints remain explicit RPCs
text = replace_function(text, 'getEmployeeAdminDirectoryRows', r'''  async function getEmployeeAdminDirectoryRows() {
    ensureSignedIn();
    return await callRpc("get_employee_admin_directory_v3", {}) || [];
  }''')
text = replace_function(text, 'getDepartmentDirectoryRows', None)

# dead generic-table helpers removed
for fn in [
    'fetchExistingScheduleRowsForRanges', 'deleteRowsNotIn', 'fetchRowsById', 'fetchRowById',
    'getRemovedRowIds', 'clearScheduleEntriesByForeignIds', 'syncLeaveAndOvertimeCatalogs',
    'ensureMemberProfiles', 'saveDepartmentAttendanceSettings', 'saveDepartmentGeneralSettings'
]:
    if f'function {fn}(' in text:
        text = replace_function(text, fn, None)

# bootstrap: one explicit RPC for settings/directories/catalogs/access + one explicit schedule read RPC
text = replace_function(text, 'loadState', r'''  async function loadState() {
    ensureSignedIn();
    const bootstrap = await callRpc("get_scheduler_bootstrap_v3", { p_document_id: documentId });
    if (!bootstrap || typeof bootstrap !== "object") {
      throw new Error("無法載入班表基礎資料");
    }
    const settings = bootstrap.settings || {};
    const scheduleRange = getScheduleLoadRange(settings);
    const visibleStartDate = addDaysToDateString(scheduleRange.startDate, 7) || taipeiDateString();
    const visibleStart = toDateObject(visibleStartDate);
    const scheduleEntryRows = await callRpc("get_schedule_entries_v3", {
      p_start_date: scheduleRange.startDate,
      p_end_date: scheduleRange.endDate
    }) || [];

    const departments = mapDepartmentRows(bootstrap.departments || []);
    const members = mapMemberDirectoryRows(bootstrap.members || []);
    return {
      year: visibleStart?.getFullYear() || new Date().getFullYear(),
      month: visibleStart?.getMonth() ?? new Date().getMonth(),
      selected: { type: null, id: null },
      deptFilter: "all",
      tableView: settings.table_view === "shift" ? "shift" : "member",
      tableDeptScopeFilter: "all",
      tableStatsVisible: settings.table_stats_visible !== false,
      scheduleStartDate: visibleStartDate,
      departments,
      members,
      shifts: mapShiftRows(bootstrap.shifts || []),
      leaves: mapLeaveRows(bootstrap.leaves || []),
      overtime: mapOvertimeRows(bootstrap.overtime || []),
      holidays: mapHolidayRows(bootstrap.holidays || []),
      rules: {
        weekStart: clampInteger(settings.week_start, 0, 6, 0),
        monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
        eightWeekStartDate: settings.eight_week_start_date || ""
      },
      schedule: mapScheduleRows(scheduleEntryRows, members),
      scheduleLoadedRanges: [scheduleRange],
      accessBundle: bootstrap.accessBundle || { actor: {}, groups: [], roles: [] },
      entityMap: bootstrap.entityMap || { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] }
    };
  }''')

text = replace_function(text, 'loadScheduleEntries', r'''  async function loadScheduleEntries(range = {}) {
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
  }''')

# Full-state synchronization is intentionally removed. Preferences/order are explicit domain operations.
text = replace_function(text, 'saveState', None)
text = replace_function(text, 'syncCatalogs', None)

text = replace_function(text, 'saveDepartmentItem', r'''  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureSignedIn();
    return await callRpc("save_department_v3", {
      p_department: { ...department, sortOrder }
    });
  }''')
text = replace_function(text, 'deleteDepartmentItem', r'''  async function deleteDepartmentItem(departmentId) {
    ensureSignedIn();
    return await callRpc("delete_department_v3", {
      p_department_id: String(departmentId || "").trim()
    });
  }''')
text = replace_function(text, 'saveShiftItem', r'''  async function saveShiftItem(shift, sortOrder = 0) {
    ensureSignedIn();
    return await callRpc("save_shift_v3", {
      p_shift: { ...shift, sortOrder }
    });
  }''')
text = replace_function(text, 'saveCatalogItem', r'''  async function saveCatalogItem(category, item, sortOrder = 0) {
    ensureSignedIn();
    return await callRpc("save_catalog_item_v3", {
      p_category: String(category || ""),
      p_item: { ...item, sortOrder }
    });
  }''')
text = replace_function(text, 'deleteCatalogItem', r'''  async function deleteCatalogItem(category, itemId) {
    ensureSignedIn();
    return await callRpc("delete_catalog_item_v3", {
      p_category: String(category || ""),
      p_item_id: String(itemId || "")
    });
  }''')

# Catalog IDs already come from canonical bootstrap. Server validates IDs and deleted/history rules.
text = replace_function(text, 'saveScheduleEntryRows', r'''  async function saveScheduleEntryRows(rows) {
    const entries = (Array.isArray(rows) ? rows : []).filter((row) => row?.member_id && row?.work_date);
    if (!entries.length) return [];
    return await callRpc("save_schedule_entries_v3", { entries }) || [];
  }''')
text = replace_function(text, 'saveScheduleCells', r'''  async function saveScheduleCells(payloads) {
    ensureSignedIn();
    const rows = [];
    for (const payload of Array.isArray(payloads) ? payloads : []) {
      const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);
      const workDate = nullableDate(payload.dateString || payload.workDate);
      if (!profileMemberId || !workDate) throw new Error("schedule cell member and date are required");
      const slot = payload.slot || {};
      const shiftId = isUuid(slot.shift) ? slot.shift : null;
      const leaveId = isUuid(slot.leave) ? slot.leave : null;
      const overtimeId = isUuid(slot.overtime) ? slot.overtime : null;
      if (!shiftId && !leaveId && !overtimeId) {
        rows.push({ member_id: profileMemberId, work_date: workDate, delete_entry: true });
        continue;
      }
      const leaveAllDay = slot.leaveMeta?.allDay !== false;
      rows.push({
        member_id: profileMemberId,
        work_date: workDate,
        shift_type_id: shiftId,
        leave_type_id: leaveId,
        leave_all_day: leaveAllDay,
        leave_start_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.startTime) : null,
        leave_end_time: leaveId && !leaveAllDay ? nullableTime(slot.leaveMeta?.endTime) : null,
        leave_reason: leaveId ? slot.leaveMeta?.reason || null : null,
        overtime_type_id: overtimeId,
        overtime_start_time: overtimeId ? nullableTime(slot.overtimeMeta?.startTime) : null,
        overtime_end_time: overtimeId ? nullableTime(slot.overtimeMeta?.endTime) : null,
        overtime_use_rest_1: overtimeId ? Boolean(slot.overtimeMeta?.useRest1) : false,
        overtime_rest_1_start_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1StartTime) : null,
        overtime_rest_1_end_time: overtimeId && slot.overtimeMeta?.useRest1 ? nullableTime(slot.overtimeMeta?.rest1EndTime) : null,
        overtime_use_rest_2: overtimeId ? Boolean(slot.overtimeMeta?.useRest2) : false,
        overtime_rest_2_start_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2StartTime) : null,
        overtime_rest_2_end_time: overtimeId && slot.overtimeMeta?.useRest2 ? nullableTime(slot.overtimeMeta?.rest2EndTime) : null,
        overtime_reason: overtimeId ? slot.overtimeMeta?.reason || null : null
      });
    }
    const savedRows = await saveScheduleEntryRows(rows);
    return { ok: true, rows: savedRows };
  }''')

# Explicit configuration operations used by sorting/rule controls.
insert_marker = '  async function saveScheduleCell(payload) {'
idx = text.find(insert_marker)
if idx < 0:
    raise RuntimeError('saveScheduleCell marker missing')
explicit_ops = r'''  async function reorderSettings(category, ids = []) {
    ensureSignedIn();
    return await callRpc("reorder_settings_v3", {
      p_category: String(category || ""),
      p_ids: (Array.isArray(ids) ? ids : []).filter(isUuid)
    });
  }

  async function saveSchedulerPreferences(state) {
    ensureSignedIn();
    return await callRpc("save_scheduler_preferences_v3", {
      p_document_id: documentId,
      p_settings: {
        currentYear: Number(state?.year) || new Date().getFullYear(),
        currentMonth: clampInteger(state?.month, 0, 11, new Date().getMonth()),
        deptFilter: state?.deptFilter || "all",
        tableView: state?.tableView === "shift" ? "shift" : "member",
        tableDeptScopeFilter: state?.tableDeptScopeFilter || "all",
        tableStatsVisible: state?.tableStatsVisible !== false,
        scheduleStartDate: nullableDate(state?.scheduleStartDate),
        weekStart: clampInteger(state?.rules?.weekStart, 0, 6, 0),
        monthStartDay: clampInteger(state?.rules?.monthStartDay, 1, 31, 1),
        eightWeekStartDate: nullableDate(state?.rules?.eightWeekStartDate)
      }
    });
  }

  async function saveHolidays(holidays = []) {
    ensureSignedIn();
    return await callRpc("save_holidays_v3", {
      p_holidays: (Array.isArray(holidays) ? holidays : []).map((holiday) => ({
        id: holiday.id,
        date: holiday.date,
        name: holiday.name || "假日"
      }))
    });
  }

'''
text = text[:idx] + explicit_ops + text[idx:]

# Group/permission/archive endpoints are explicit schedulerApi methods; UI has no transport code.
group_ops_marker = '  async function exportSapCsv(payload) {'
idx = text.find(group_ops_marker)
if idx < 0:
    raise RuntimeError('export marker missing')
group_ops = r'''  async function getGroupAccessBundle() { return await callRpc("get_group_access_bundle_v1", {}) || {}; }
  async function getGroupEntityMap() { return await callRpc("get_group_entity_map_v1", {}) || {}; }
  async function saveScheduleGroup(group) { return callRpc("save_schedule_group_v1", { p_group: group }); }
  async function deleteScheduleGroup(groupId, confirmName) { return callRpc("delete_schedule_group_v1", { p_group_id: groupId, p_confirm_name: confirmName }); }
  async function reorderScheduleGroups(groupIds) { return callRpc("reorder_schedule_groups_v1", { p_group_ids: groupIds }); }
  async function saveAccessRole(role) { return callRpc("save_access_role_v1", { p_role: role }); }
  async function deleteAccessRole(roleId) { return callRpc("delete_access_role_v1", { p_role_id: roleId }); }
  async function validateMemberGroupChange(employeeCode, groupId) { return callRpc("validate_member_group_change_v1", { p_employee_code: employeeCode, p_new_group_id: groupId }); }
  async function getScheduleArchives(groupId = null) { return callRpc("get_schedule_archives_v1", { p_group_id: groupId }); }
  async function archiveSchedule(groupId, startDate, endDate) { return callRpc("archive_schedule_v1", { p_group_id: groupId, p_start_date: startDate, p_end_date: endDate }); }
  async function unarchiveSchedule(archiveId) { return callRpc("unarchive_schedule_v1", { p_archive_id: archiveId }); }
  async function getScheduleArchiveDetail(archiveId) { return callRpc("get_schedule_archive_detail_v1", { p_archive_id: archiveId }); }

'''
text = text[:idx] + group_ops + text[idx:]

# Member Auth admin receives canonical access identifiers in the same operation; no second assignment RPC.
text = replace_function(text, 'syncMemberProfile', r'''  async function syncMemberProfile(member, previousEmployeeCode = "") {
    ensureSignedIn();
    return requestFunction("member-auth-admin", {
      action: "upsert_member",
      member: {
        employeeCode: String(member?.code || "").trim(),
        fullName: member?.name || "",
        groupId: member?.groupId || "",
        accessRoleId: member?.roleId || member?.role || "",
        hireDate: member?.hireDate || null,
        leaveDate: member?.leaveDate || null,
        payByDay: Boolean(member?.payByDay),
        fixedRestWeekday: clampInteger(member?.fixedRestWeekday, 0, 6, 0),
        homeDepartmentId: member?.deptId || "",
        scheduleShiftIds: Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [],
        monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0)
      },
      previousEmployeeCode: String(previousEmployeeCode || "").trim(),
      defaultPassword: "0000"
    });
  }''')

# Map canonical group/access columns directly.
text = text.replace('        attendanceEnabled: Boolean(row.attendance_enabled),\n        deleted: Boolean(row.deleted_at)', '        attendanceEnabled: Boolean(row.attendance_enabled),\n        groupId: row.group_id || "",\n        deleted: Boolean(row.deleted_at)')
text = text.replace('        positionRequirements: []\n      }));\n  }\n\n  function mapLeaveRows', '        positionRequirements: [],\n        groupId: row.group_id || ""\n      }));\n  }\n\n  function mapLeaveRows')
text = text.replace('        role: normalizeRole(row.role),\n        deleted: Boolean(row.deleted_at)', '        role: normalizeRole(row.role),\n        roleId: row.access_role_id || "",\n        groupId: row.group_id || "",\n        deleted: Boolean(row.deleted_at)')

# schedulerApi export: remove old generic sync API, expose explicit domain operations.
text = text.replace('    saveState,\n    syncCatalogs,\n', '')
text = text.replace('    saveScheduleCell,\n', '    saveScheduleCell,\n    reorderSettings,\n    saveSchedulerPreferences,\n    saveHolidays,\n    getGroupAccessBundle,\n    getGroupEntityMap,\n    saveScheduleGroup,\n    deleteScheduleGroup,\n    reorderScheduleGroups,\n    saveAccessRole,\n    deleteAccessRole,\n    validateMemberGroupChange,\n    getScheduleArchives,\n    archiveSchedule,\n    unarchiveSchedule,\n    getScheduleArchiveDetail,\n')

# Architecture guard: no generic core table REST helpers may remain.
for forbidden in ['restSelect(', 'restInsert(', 'restUpdate(', 'restDelete(', '/rest/v1/${table}', 'saveState,', 'syncCatalogs,']:
    if forbidden in text:
        raise RuntimeError(f'legacy browser data access remains in web-api.js: {forbidden}')
path.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# Persistence: explicit preferences only; ordering is persisted at its source.
# ---------------------------------------------------------------------------
path = R / 'renderer-persistence.js'
text = path.read_text(encoding='utf-8')
text = replace_function(text, 'buildPersistedState', None)
text = replace_function(text, 'forceSave', r'''async function forceSave() {
  if (!canEditSchedule()) return false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await window.schedulerApi.saveSchedulerPreferences(state);
    return true;
  } catch (error) {
    setSaveStatus(`儲存失敗：${error.message}`);
    return false;
  }
}''')
path.write_text(text, encoding='utf-8')

# Sorting persists exactly the reordered category through one permission-aware RPC.
path = R / 'renderer-settings-ordering.js'
text = path.read_text(encoding='utf-8')
text = text.replace('  renderAll();\n  reopenSortedSettings(category, returnTo);\n  queueSave();\n  return true;', '  renderAll();\n  reopenSortedSettings(category, returnTo);\n  void window.schedulerApi.reorderSettings(category, orderedIds).catch((error) => setSaveStatus(`排序儲存失敗：${error.message}`));\n  return true;')
text = text.replace('  renderAll();\n  void reopenSettingsModalPreservingScroll(returnTo);\n  queueSave();\n  return true;', '  renderAll();\n  void reopenSettingsModalPreservingScroll(returnTo);\n  void window.schedulerApi.reorderSettings("member", nextMembers.filter((member) => !member.deleted).map((member) => member.id)).catch((error) => setSaveStatus(`人員排序儲存失敗：${error.message}`));\n  return true;')
path.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# Access/group module becomes a normal build module: no backend transport and no schedulerApi monkey patches.
# ---------------------------------------------------------------------------
old_path = R / 'renderer-groups-permissions-archive.mjs'
text = old_path.read_text(encoding='utf-8')
text = text.replace('/* 群組、角色權限與班表封存擴充。\n * 置於 renderer.js 後載入，延伸既有全域班表模組。\n */', '/* 群組、角色權限與班表封存。\n * 權限狀態由 canonical schedulerApi 載入；本模組只負責領域狀態與介面。\n */')
text = replace_function(text, 'groupApiConfig', None)
text = replace_function(text, 'groupRpc', None)
text = replace_function(text, 'loadGroupAccessData', r'''async function loadGroupAccessData(payload = {}) {
  groupFeatureState.bundle = payload.accessBundle && typeof payload.accessBundle === "object"
    ? payload.accessBundle
    : await window.schedulerApi.getGroupAccessBundle();
  groupFeatureState.entityMap = payload.entityMap && typeof payload.entityMap === "object"
    ? payload.entityMap
    : await window.schedulerApi.getGroupEntityMap();
  return { bundle: groupFeatureState.bundle, entityMap: groupFeatureState.entityMap };
}''')
# All UI backend calls are named schedulerApi operations.
text = text.replace('await groupRpc("save_schedule_group_v1", { p_group: ', 'await window.schedulerApi.saveScheduleGroup(')
# fix closing introduced by simple replacement for two call sites
text = text.replace(' } });\n  await reloadGroupApplicationState();\n  openGroupSettings();', ');\n  await reloadGroupApplicationState();\n  openGroupSettings();')
text = text.replace('await groupRpc("delete_schedule_group_v1", { p_group_id: group.id, p_confirm_name: typed });', 'await window.schedulerApi.deleteScheduleGroup(group.id, typed);')
text = text.replace('await groupRpc("reorder_schedule_groups_v1", { p_group_ids: ids });', 'await window.schedulerApi.reorderScheduleGroups(ids);')
text = text.replace('await groupRpc("save_access_role_v1", { p_role: { id: existing?.id || "", code: existing?.code || "", name, permissions, groupIds } });', 'await window.schedulerApi.saveAccessRole({ id: existing?.id || "", code: existing?.code || "", name, permissions, groupIds });')
text = text.replace('await groupRpc("delete_access_role_v1", { p_role_id: roleId });', 'await window.schedulerApi.deleteAccessRole(roleId);')
text = text.replace('async function loadArchiveList(groupId = null) { return await groupRpc("get_schedule_archives_v1", { p_group_id: groupId }); }', 'async function loadArchiveList(groupId = null) { return await window.schedulerApi.getScheduleArchives(groupId); }')
text = text.replace('await groupRpc("archive_schedule_v1", { p_group_id: group.id, p_start_date: startDate, p_end_date: endDate });', 'await window.schedulerApi.archiveSchedule(group.id, startDate, endDate);')
text = text.replace('groupFeatureState.entityMap = await groupRpc("get_group_entity_map_v1");', 'groupFeatureState.entityMap = await window.schedulerApi.getGroupEntityMap();')
text = text.replace('await groupRpc("unarchive_schedule_v1", { p_archive_id: archiveId });', 'await window.schedulerApi.unarchiveSchedule(archiveId);')
text = text.replace('const result = await groupRpc("get_schedule_archive_detail_v1", { p_archive_id: archiveId });', 'const result = await window.schedulerApi.getScheduleArchiveDetail(archiveId);')
text = text.replace('await groupRpc("validate_member_group_change_v1", { p_employee_code: previousMember.code, p_new_group_id: payload.groupId });', 'await window.schedulerApi.validateMemberGroupChange(previousMember.code, payload.groupId);')

# Strip the runtime monkey-patch installer entirely.
install_marker = '(function installGroupPermissionArchiveFeature() {'
start = text.find(install_marker)
if start < 0:
    raise RuntimeError('group feature installer not found')
text = text[:start].rstrip() + '\n\n'

# Native initialization helpers used by renderer.js/base modules.
text += r'''
function initializeGroupPermissionState(payload) {
  const normalized = enrichNormalizedState(normalizeState(payload));
  if (!groupFeatureState.currentGroupId || !getSelectableGroups().some((group) => group.id === groupFeatureState.currentGroupId)) {
    groupFeatureState.currentGroupId = chooseCurrentGroupId();
  }
  snapshotAllState(normalized);
  groupFeatureState.initialized = true;
  return applyCurrentGroupScope(normalized);
}

function refreshGroupEntityMap(entityMap) {
  groupFeatureState.entityMap = entityMap && typeof entityMap === "object"
    ? entityMap
    : { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] };
}
'''
new_path = R / 'renderer-groups-permissions-archive.js'
new_path.write_text(text, encoding='utf-8')
old_path.unlink()

# Remove deferred runtime injection; the group module now belongs to the canonical bundle.
path = R / 'app-config.js'
text = path.read_text(encoding='utf-8')
text = re.sub(r'\s*document\.write\(\'<script defer src="\.\/renderer-groups-permissions-archive\.mjs[^\n]+\n', '\n', text)
text = re.sub(r'\s*document\.write\(\'<script defer src="\.\/renderer-group-backend-bridges\.mjs[^\n]+\n', '\n', text)
path.write_text(text, encoding='utf-8')

# Build group module before auth/page logic and before renderer.js startup.
path = ROOT / 'scripts' / 'build-js.js'
text = path.read_text(encoding='utf-8')
needle = '  "renderer-settings-member.js",\n  "renderer-auth-context.js",'
if needle not in text:
    raise RuntimeError('build manifest insertion point missing')
text = text.replace(needle, '  "renderer-settings-member.js",\n  "renderer-groups-permissions-archive.js",\n  "renderer-auth-context.js",')
path.write_text(text, encoding='utf-8')

# Backend attendance bridge removed; canonical web-api directly uses the group-aware Edge endpoint below.
bridge_path = R / 'renderer-group-backend-bridges.mjs'
if bridge_path.exists():
    bridge_path.unlink()

# ---------------------------------------------------------------------------
# Native app startup and permission functions (no runtime function replacement).
# ---------------------------------------------------------------------------
path = R / 'renderer.js'
text = path.read_text(encoding='utf-8')
text = text.replace('  bindEvents();\n  pushAppBackHistoryGuard();', '  bindEvents();\n  bindGroupFeatureEvents();\n  pushAppBackHistoryGuard();')
text = text.replace('    const payload = await window.schedulerApi.loadState();\n    state = normalizeState(payload);', '    const payload = await window.schedulerApi.loadState();\n    await loadGroupAccessData(payload);\n    state = initializeGroupPermissionState(payload);')
text = re.sub(r'\n  void refreshScheduleCatalogsAfterInitialRender\(\);', '', text)
text = replace_function(text, 'refreshScheduleCatalogsAfterInitialRender', None)
path.write_text(text, encoding='utf-8')

path = R / 'renderer-auth-context.js'
text = path.read_text(encoding='utf-8')
text = replace_function(text, 'resolveCurrentMember', r'''function resolveCurrentMember() {
  if (currentProfile?.id) {
    const byId = (groupFeatureState.allMembers || []).find((member) => member.id === currentProfile.id)
      || state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return (groupFeatureState.allMembers || []).find((member) => member.code === currentProfile.employee_code)
    || state.members.find((member) => member.code === currentProfile.employee_code)
    || null;
}''')
text = replace_function(text, 'isAdmin', r'''function isAdmin() {
  return hasPermission("permission_settings");
}''')
text = replace_function(text, 'isManager', r'''function isManager() {
  return getAccessPermissions().some((permission) => permission !== "schedule_view");
}''')
text = replace_function(text, 'canEditSchedule', r'''function canEditSchedule() {
  return hasPermission("schedule_manage") && roleAppliesToGroup(groupFeatureState.currentGroupId);
}''')
text = replace_function(text, 'getRoleLabel', r'''function getRoleLabel(role) {
  return getRoleById(role)?.name || getRoleByLegacyRole(role)?.name || "員工";
}''')
text = replace_function(text, 'canEditMemberAccount', r'''function canEditMemberAccount(_member) {
  return hasPermission("member_settings");
}''')
# Permission UI is now called directly from canonical role sync.
old = '  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {\n'
if old not in text:
    raise RuntimeError('syncRoleUi marker missing')
# append syncPermissionUi before function closes by targeted trailing block
text = text.replace('  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {\n    const element = document.getElementById(id);\n    if (!element) {\n      return;\n    }\n    element.classList.toggle("chips-readonly", !canEditSchedule());\n  });\n\n}', '  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {\n    const element = document.getElementById(id);\n    if (!element) return;\n    element.classList.toggle("chips-readonly", !canEditSchedule());\n  });\n  syncPermissionUi();\n}')
path.write_text(text, encoding='utf-8')

# Group-aware member form/save are canonical: remove old definitions, rename group versions.
member_path = R / 'renderer-settings-member.js'
member_text = member_path.read_text(encoding='utf-8')
for fn in ['renderMemberRoleOptions', 'openMemberForm', 'saveMember']:
    if f'function {fn}(' in member_text:
        member_text = replace_function(member_text, fn, None)
member_path.write_text(member_text, encoding='utf-8')

group_path = R / 'renderer-groups-permissions-archive.js'
group_text = group_path.read_text(encoding='utf-8')
group_text = group_text.replace('function renderMemberCustomRoleOptions(member)', 'function renderMemberRoleOptions(member)')
group_text = group_text.replace('function openMemberFormWithGroups(mode, memberId = "")', 'function openMemberForm(mode, memberId = "")')
group_text = group_text.replace('function saveMemberWithGroups(mode)', 'function saveMember(mode)')
group_path.write_text(group_text, encoding='utf-8')

# Canonical schedule-cell guards live at the actual mutation points.
for filename, fn_name, guard in [
    ('renderer-schedule-selection-actions.js', 'applySelectionToCell', '  const dateString = normalizeScheduleDateInput(day);\n  if (isArchivedDate(dateString) || isDeletedScheduleMember(memberId)) return;\n'),
    ('renderer-schedule-selection-actions.js', 'applyClipboardSlotToScheduleCell', '  if (isArchivedDate(dateString) || isDeletedScheduleMember(memberId)) return false;\n')
]:
    p = R / filename
    t = p.read_text(encoding='utf-8')
    marker = f'async function {fn_name}('
    start = t.find(marker)
    if start >= 0:
        brace = t.find('{', start)
        if guard.strip() not in t[brace:brace+500]:
            t = t[:brace+1] + '\n' + guard + t[brace+1:]
    p.write_text(t, encoding='utf-8')

# render hooks are direct calls, not function replacement.
for filename, fn_name, call in [
    ('renderer-schedule-table.js', 'renderTable', '  markArchivedScheduleCells();\n'),
]:
    p = R / filename
    t = p.read_text(encoding='utf-8')
    # insert just before final return/closing is hard; append call near beginning is safe after DOM exists later in function? use queueMicrotask.
    marker = f'function {fn_name}('
    start = t.find(marker)
    if start >= 0:
        brace = t.find('{', start)
        insert = '  queueMicrotask(markArchivedScheduleCells);\n'
        if insert.strip() not in t[brace:brace+200]:
            t = t[:brace+1] + '\n' + insert + t[brace+1:]
    p.write_text(t, encoding='utf-8')

# Group-aware records permissions/filters are native in base records page.
path = R / 'renderer-records-page.js'
text = path.read_text(encoding='utf-8')
text = text.replace('      issueType: filters.issueType || ""', '      issueType: filters.issueType || "",\n      groupId: filters.groupId || ""')
text = text.replace('    if (isAdmin()) await loadAttendanceReview(false);', '    if (hasPermission("attendance_review")) await loadAttendanceReview(false);')
text = text.replace('  if (!isAdmin()) return;', '  if (!hasPermission("attendance_review")) return;')
path.write_text(text, encoding='utf-8')

# web-api attendance review uses the canonical group-aware Edge API directly.
path = R / 'web-api.js'
text = path.read_text(encoding='utf-8')
text = replace_function(text, 'getAttendanceReviewList', r'''  async function getAttendanceReviewList(filters = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_list", ...filters });
  }''')
text = replace_function(text, 'saveAttendanceReviewRecord', r'''  async function saveAttendanceReviewRecord(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_save", ...payload });
  }''')
text = replace_function(text, 'setAttendanceReviewed', r'''  async function setAttendanceReviewed(payload = {}) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "review_set", ...payload });
  }''')
text = replace_function(text, 'getAttendanceHistory', r'''  async function getAttendanceHistory(recordId) {
    ensureSignedIn();
    return requestFunction("attendance-review-groups", { action: "history", recordId });
  }''')
path.write_text(text, encoding='utf-8')

# Remove obsolete public runtime references from publish list if present is handled by publisher copying mjs; source files no longer exist.

print('access architecture source refactor complete')
