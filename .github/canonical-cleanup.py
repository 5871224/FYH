from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text.replace("\r\n", "\n"), encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing marker: {label}")
    if text.count(old) != 1:
        raise RuntimeError(f"marker not unique: {label} ({text.count(old)})")
    return text.replace(old, new, 1)


def remove_function(text, name):
    pattern = re.compile(rf"\n?create\s+or\s+replace\s+function\s+public\.{re.escape(name)}\b[\s\S]*?\$\$;\s*", re.I)
    return pattern.sub("\n", text)


def remove_trigger_block(text, trigger_name):
    text = re.sub(rf"\n?drop\s+trigger\s+if\s+exists\s+{re.escape(trigger_name)}\s+on\s+public\.[a-z0-9_]+\s*;\s*", "\n", text, flags=re.I)
    text = re.sub(rf"\n?create\s+trigger\s+{re.escape(trigger_name)}\b[\s\S]*?;\s*", "\n", text, flags=re.I)
    return text


# -----------------------------------------------------------------------------
# Renderer: remove legacy role state, preserve canonical group metadata, remove
# guess-based fallbacks, and make the full multi-group cache explicit.
# -----------------------------------------------------------------------------
foundation = read("src/renderer/renderer-foundation.js")
foundation = foundation.replace('  role: "manager",\n', '')
foundation = re.sub(
    r"\nconst ROLE_OPTIONS = \[[\s\S]*?\n\];\n",
    "\n",
    foundation,
    count=1,
)
write("src/renderer/renderer-foundation.js", foundation)

normalization = read("src/renderer/renderer-state-normalization.js")
normalization = replace_once(
    normalization,
    '    attendanceEnabled: Boolean(department?.attendanceEnabled)\n',
    '    attendanceEnabled: Boolean(department?.attendanceEnabled),\n    groupId: department?.groupId || "",\n    deleted: Boolean(department?.deleted)\n',
    "department canonical metadata",
)
normalization = replace_once(
    normalization,
    '    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),\n    roleId: member?.roleId || ""\n',
    '    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),\n    roleId: member?.roleId || "",\n    groupId: member?.groupId || "",\n    deleted: Boolean(member?.deleted)\n',
    "member canonical metadata",
)
normalization = replace_once(
    normalization,
    '      positionRequirements: Array.isArray(shift?.positionRequirements)\n        ? shift.positionRequirements\n        .filter((item) => item && item.positionId)\n        .map((item) => ({ positionId: item.positionId, count: Math.max(0, Number(item.count) || 0) }))\n      : []\n',
    '      positionRequirements: Array.isArray(shift?.positionRequirements)\n        ? shift.positionRequirements\n        .filter((item) => item && item.positionId)\n        .map((item) => ({ positionId: item.positionId, count: Math.max(0, Number(item.count) || 0) }))\n      : [],\n      groupId: shift?.groupId || "",\n      deleted: Boolean(shift?.deleted)\n',
    "shift canonical metadata",
)
normalization = replace_once(
    normalization,
    '    hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),\n    requiresTime: Boolean(item?.requiresTime),\n    requiresReason: Boolean(item?.requiresReason)\n',
    '    hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),\n    requiresTime: Boolean(item?.requiresTime),\n    requiresReason: Boolean(item?.requiresReason),\n    deleted: Boolean(item?.deleted)\n',
    "leave deleted metadata",
)
normalization = replace_once(
    normalization,
    '      rest2EndTime: item?.rest2EndTime || ""\n',
    '      rest2EndTime: item?.rest2EndTime || "",\n      deleted: Boolean(item?.deleted)\n',
    "overtime deleted metadata",
)
normalization = normalization.replace('  const fallbackOvertimeId = merged.overtime[0]?.id || null;\n', '')
normalization = replace_once(
    normalization,
    '    const overtimeId = validOvertimeIds.has(slot?.overtime)\n      ? slot.overtime\n      : hasOvertimeMeta\n        ? fallbackOvertimeId\n        : null;\n',
    '    const overtimeId = validOvertimeIds.has(slot?.overtime) ? slot.overtime : null;\n',
    "overtime fallback removal",
)
normalization = normalization.replace('  merged.role = "manager";\n', '')
write("src/renderer/renderer-state-normalization.js", normalization)

# Explicit canonical multi-group cache. The visible `state` remains a page projection,
# but duplicate metadata is no longer reconstructed from entityMap.
groups = read("src/renderer/renderer-groups-permissions-archive.js")
groups = replace_once(
    groups,
    '  entityMap: { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] },\n  currentGroupId: "",\n  allDepartments: [],\n  allMembers: [],\n  allShifts: [],\n  allSchedule: {},\n',
    '  archiveRanges: [],\n  currentGroupId: "",\n  catalog: { departments: [], members: [], shifts: [], schedule: {} },\n',
    "group feature canonical cache",
)
groups = replace_once(
    groups,
    '''  groupFeatureState.entityMap = payload.entityMap && typeof payload.entityMap === "object"\n    ? payload.entityMap\n    : await window.schedulerApi.getGroupEntityMap();\n  return { bundle: groupFeatureState.bundle, entityMap: groupFeatureState.entityMap };\n''',
    '''  groupFeatureState.archiveRanges = Array.isArray(payload.archiveRanges)\n    ? payload.archiveRanges\n    : await window.schedulerApi.getScheduleArchiveRanges();\n  return { bundle: groupFeatureState.bundle, archiveRanges: groupFeatureState.archiveRanges };\n''',
    "group access data",
)
# Remove id-map reconstruction and replace enrich with direct canonical metadata handling.
groups = re.sub(r"\nfunction makeIdMap\([\s\S]*?\n}\n\nfunction appendDeletedLabel", "\nfunction appendDeletedLabel", groups, count=1)
enrich_pattern = re.compile(r"function enrichNormalizedState\(normalized\) \{[\s\S]*?\n  return normalized;\n}\n", re.M)
enrich_replacement = '''function enrichNormalizedState(normalized) {\n  normalized.departments = (normalized.departments || []).map((department) => ({\n    ...department,\n    name: appendDeletedLabel(department.name, department.deleted)\n  }));\n  normalized.members = (normalized.members || []).map((member) => ({\n    ...member,\n    name: appendDeletedLabel(member.name, member.deleted)\n  }));\n  normalized.shifts = (normalized.shifts || []).map((shift) => ({\n    ...shift,\n    name: appendDeletedLabel(shift.name, shift.deleted),\n    hiddenFromToolbar: Boolean(shift.deleted || shift.hiddenFromToolbar)\n  }));\n  normalized.leaves = (normalized.leaves || []).map((leave) => ({\n    ...leave,\n    name: appendDeletedLabel(leave.name, leave.deleted),\n    hiddenFromToolbar: Boolean(leave.deleted || leave.hiddenFromToolbar)\n  }));\n  normalized.overtime = (normalized.overtime || []).map((overtime) => ({\n    ...overtime,\n    name: appendDeletedLabel(overtime.name, overtime.deleted),\n    hiddenFromToolbar: Boolean(overtime.deleted || overtime.hiddenFromToolbar)\n  }));\n  normalized.groups = getAllGroups();\n  normalized.accessRoles = getAllRoles();\n  normalized.access = getAccessActor();\n  return normalized;\n}\n'''
if not enrich_pattern.search(groups):
    raise RuntimeError("enrichNormalizedState not found")
groups = enrich_pattern.sub(enrich_replacement, groups, count=1)
for old, new in [
    ("groupFeatureState.allDepartments", "groupFeatureState.catalog.departments"),
    ("groupFeatureState.allMembers", "groupFeatureState.catalog.members"),
    ("groupFeatureState.allShifts", "groupFeatureState.catalog.shifts"),
    ("groupFeatureState.allSchedule", "groupFeatureState.catalog.schedule"),
]:
    groups = groups.replace(old, new)
groups = groups.replace("function snapshotAllState(normalized)", "function snapshotCanonicalState(normalized)")
groups = groups.replace("snapshotAllState(", "snapshotCanonicalState(")
groups = groups.replace("function syncCurrentScopeIntoAll()", "function syncCurrentScopeIntoCatalog()")
groups = groups.replace("syncCurrentScopeIntoAll();", "syncCurrentScopeIntoCatalog();")
groups = groups.replace("groupFeatureState.entityMap.archiveRanges", "groupFeatureState.archiveRanges")
groups = replace_once(
    groups,
    'function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }\n',
    '''function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }\nfunction getDefaultAccessRoleId() {\n  return getAllRoles().find((role) => {\n    const permissions = Array.isArray(role.permissions) ? role.permissions : [];\n    return permissions.length <= 1 && permissions.every((permission) => permission === "schedule_view");\n  })?.id || getAllRoles()[0]?.id || "";\n}\n''',
    "default access role helper",
)
# Dead role renderer and duplicate default-role search.
groups = re.sub(r"\nfunction renderMemberRoleOptions\(member\) \{[\s\S]*?\n}\n", "\n", groups, count=1)
groups = re.sub(
    r"  const defaultAccessRole = getAllRoles\(\)\.find\(\(role\) => \{[\s\S]*?\n  \}\) \|\| getAllRoles\(\)\[0\] \|\| null;\n",
    '  const defaultAccessRoleId = getDefaultAccessRoleId();\n',
    groups,
    count=1,
)
groups = groups.replace('scheduleShiftIds: [], roleId: defaultAccessRole?.id || ""', 'scheduleShiftIds: [], roleId: defaultAccessRoleId')
# Unarchive only refreshes archive ranges, not a duplicate entity map.
groups = replace_once(
    groups,
    '  groupFeatureState.entityMap = await window.schedulerApi.getGroupEntityMap();\n',
    '  groupFeatureState.archiveRanges = await window.schedulerApi.getScheduleArchiveRanges();\n',
    "unarchive archive range refresh",
)
write("src/renderer/renderer-groups-permissions-archive.js", groups)

# Apply catalog renames and clearer permission terminology throughout renderer sources.
for path in (ROOT / "src/renderer").glob("*.js"):
    if path.name == "app.js":
        continue
    text = path.read_text(encoding="utf-8")
    for old, new in [
        ("groupFeatureState.allDepartments", "groupFeatureState.catalog.departments"),
        ("groupFeatureState.allMembers", "groupFeatureState.catalog.members"),
        ("groupFeatureState.allShifts", "groupFeatureState.catalog.shifts"),
        ("groupFeatureState.allSchedule", "groupFeatureState.catalog.schedule"),
        ("isAdmin()", "canManagePermissions()"),
        ("function isAdmin()", "function canManagePermissions()"),
        ("isManager()", "hasManagementAccess()"),
        ("function isManager()", "function hasManagementAccess()"),
    ]:
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")

members = read("src/renderer/renderer-settings-member.js")
members = re.sub(
    r"    const defaultAccessRoleId = getAllRoles\(\)\.find\(\(role\) => \{[\s\S]*?\n    \}\)\?\.id \|\| \"\";\n",
    '    const defaultAccessRoleId = getDefaultAccessRoleId();\n',
    members,
    count=1,
)
members = replace_once(
    members,
    '      const importedRoleId = accessRoleMap.get(importedRoleKey) || "";\n      const roleId = canManagePermissions()\n        ? (importedRoleId || existing?.roleId || defaultAccessRoleId)\n        : (existing?.roleId || defaultAccessRoleId);\n',
    '      const importedRoleId = accessRoleMap.get(importedRoleKey) || "";\n      if (canManagePermissions() && importedRoleKey && !importedRoleId) {\n        skipped += 1;\n        continue;\n      }\n      const roleId = canManagePermissions()\n        ? (importedRoleId || existing?.roleId || defaultAccessRoleId)\n        : (existing?.roleId || defaultAccessRoleId);\n',
    "unknown imported role guard",
)
members = replace_once(
    members,
    '        deptId,\n        scheduleShiftIds,\n',
    '        groupId: existing?.groupId || groupFeatureState.currentGroupId,\n        deptId,\n        scheduleShiftIds,\n',
    "member import group id",
)
write("src/renderer/renderer-settings-member.js", members)

# -----------------------------------------------------------------------------
# Exporter owns all XLSX formatting. web-api remains transport/orchestration only.
# -----------------------------------------------------------------------------
exporter = read("src/renderer/browser-exporter.js")
meal_exporter = r'''
  function buildMealEmployeeRows(report, details) {
    const companySubsidy = Number(report.companySubsidy || 55);
    const employees = new Map();
    details.forEach((row) => {
      const key = String(row.employeeId || row.employeeCode || row.employeeName || "");
      if (!key) return;
      const current = employees.get(key) || {
        employeeName: row.employeeName || "",
        employeeCode: row.employeeCode || "",
        dates: new Set(),
        amount: 0
      };
      const quantity = Number(row.quantity || 0);
      const amount = Number(row.amount ?? (quantity * Number(row.unitPrice || 0))) || 0;
      if (quantity > 0 && row.date) current.dates.add(row.date);
      current.amount += amount;
      if (!current.employeeName && row.employeeName) current.employeeName = row.employeeName;
      if (!current.employeeCode && row.employeeCode) current.employeeCode = row.employeeCode;
      employees.set(key, current);
    });
    return [...employees.values()].map((row) => ({
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      lunchAmount: row.amount - row.dates.size * companySubsidy,
      lunchCount: row.dates.size
    })).sort((a, b) => (
      String(a.employeeName).localeCompare(String(b.employeeName), "zh-Hant")
      || String(a.employeeCode).localeCompare(String(b.employeeCode))
    ));
  }

  function styleMealExportSheet(sheet) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
    sheet.columns = Array.from({ length: 10 }, (_, index) => ({ width: index === 0 ? 18 : index === 1 ? 16 : 14 }));
    sheet.getColumn(2).numFmt = "@";
    sheet.getColumn(10).numFmt = "@";
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
  }

  async function createMealReportWorkbook(report = {}) {
    const details = Array.isArray(report.exportDetails) ? report.exportDetails : [];
    if (!details.length) return null;
    const rows = buildMealEmployeeRows(report, details);
    if (!rows.length) return null;
    await ensureExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("訂餐統計");
    const reportDate = String(report.toDate || "").replace(/[^0-9]/g, "").slice(0, 8);
    sheet.addRow(["員工姓名", "員工編號", "早餐金額", "午餐金額", "晚餐金額", "早餐份數", "午餐份數", "晚餐份數", "總計", "日期"]);
    rows.forEach((row) => {
      sheet.addRow([row.employeeName, row.employeeCode, "", row.lunchAmount, "", "", row.lunchCount, "", "", reportDate]);
    });
    styleMealExportSheet(sheet);
    return workbook;
  }
'''
exporter = replace_once(exporter, "\n  async function workbookToBlob(workbook) {", meal_exporter + "\n  async function workbookToBlob(workbook) {", "meal exporter insertion")
exporter = replace_once(exporter, "    createOvertimeSettingsWorkbook,\n", "    createOvertimeSettingsWorkbook,\n    createMealReportWorkbook,\n", "meal exporter exposure")
write("src/renderer/browser-exporter.js", exporter)

webapi = read("src/renderer/web-api.js")
# Remove manager-id compatibility fallback: schedule state is UUID-canonical.
webapi = re.sub(r"\n  async function resolveManagerMemberProfileId\([\s\S]*?\n  }\n\n", "\n", webapi, count=1)
webapi = replace_once(
    webapi,
    '      const profileMemberId = await resolveManagerMemberProfileId(payload.memberId, payload.memberCode);\n      const workDate = nullableDate(payload.dateString || payload.workDate);\n      if (!profileMemberId || !workDate) throw new Error("schedule cell member and date are required");\n',
    '      const profileMemberId = String(payload.memberId || "").trim();\n      const workDate = nullableDate(payload.dateString || payload.workDate);\n      if (!isUuid(profileMemberId) || !workDate) throw new Error("schedule cell member UUID and date are required");\n',
    "schedule UUID canonical id",
)
# Remove meal XLSX helpers from transport layer and delegate to exporter.
webapi = re.sub(r"\n  function compactMealExportDate\([\s\S]*?\n  async function exportMealReport\(report = \{\}\) \{[\s\S]*?\n  }\n\n  async function exportAttendanceReview", "\n  async function exportMealReport(report = {}) {\n    const workbook = await exporter.createMealReportWorkbook(report);\n    if (!workbook) return { canceled: true, empty: true };\n    const reportDate = compactExportDate(report.toDate);\n    const blob = await exporter.workbookToBlob(workbook);\n    const fileName = `訂餐統計_${compactExportDate(report.fromDate)}-${reportDate}.xlsx`;\n    downloadBlob(blob, fileName);\n    return { canceled: false, filePath: fileName };\n  }\n\n  async function exportAttendanceReview", webapi, count=1)
# New profile and archive-range APIs.
webapi = webapi.replace('callRpc("get_my_profile_v2"', 'callRpc("get_my_profile_v3"')
webapi = webapi.replace('async function getGroupEntityMap() { return await callRpc("get_group_entity_map_v1", {}) || {}; }', 'async function getScheduleArchiveRanges() { return callRpc("get_schedule_archive_ranges_v1", {}) || []; }')
webapi = webapi.replace('async function getGroupEntityMap() { return callRpc("get_group_entity_map_v1", {}) || {}; }', 'async function getScheduleArchiveRanges() { return callRpc("get_schedule_archive_ranges_v1", {}) || []; }')
webapi = webapi.replace('      entityMap: bootstrap.entityMap || { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] }', '      archiveRanges: Array.isArray(bootstrap.archiveRanges) ? bootstrap.archiveRanges : []')
# Remove redundant return-await in direct RPC wrappers.
webapi = re.sub(r"return await callRpc\(", "return callRpc(", webapi)
webapi = webapi.replace("    getGroupEntityMap,\n", "    getScheduleArchiveRanges,\n")
write("src/renderer/web-api.js", webapi)

# Split the over-generic leave/overtime save function into clear domain paths.
catalog = read("src/renderer/renderer-settings-catalog.js")
start = catalog.find("async function saveNamedColorItem(category, mode) {")
end = catalog.find("\nasync function deleteListItem", start)
if start < 0 or end < 0:
    raise RuntimeError("saveNamedColorItem block not found")
replacement = r'''function readNamedColorPayloadBase(category, mode) {
  return {
    id: mode === "edit" ? modalContext.targetId : uid(category[0]),
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    hiddenFromToolbar: Boolean(document.getElementById(`${category}HiddenFromToolbar`)?.checked)
  };
}

async function persistNamedCatalogItem(category, mode, payload, returnTo) {
  const currentList = getItemList(category);
  const nextList = mode === "edit"
    ? currentList.map((item) => item.id === payload.id ? payload : item)
    : [...currentList, payload];
  const sortOrder = mode === "edit" ? currentList.findIndex((item) => item.id === payload.id) : currentList.length;
  try {
    await window.schedulerApi.saveCatalogItem(category, payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`${category === "leave" ? "假別" : "加班"}儲存失敗：${error.message}`);
    return false;
  }
  if (category === "leave") state.leaves = nextList;
  if (category === "overtime") state.overtime = nextList;
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: category, scrollTop: 0 });
  return true;
}

async function saveLeaveItem(mode) {
  const returnTo = modalContext.returnTo || null;
  const selectedLeave = LEAVE_CATALOG.find((entry) => entry.code === (document.getElementById("leaveCatalogCode")?.value || ""));
  const name = document.getElementById("leaveCatalogName")?.value.trim() || "";
  if (!name) {
    document.getElementById("leaveCatalogName")?.focus();
    return;
  }
  const payload = {
    ...readNamedColorPayloadBase("leave", mode),
    code: selectedLeave?.code,
    name,
    requiresTime: Boolean(document.getElementById("leaveRequiresTime")?.checked),
    requiresReason: Boolean(document.getElementById("leaveRequiresReason")?.checked)
  };
  await persistNamedCatalogItem("leave", mode, payload, returnTo);
}

async function saveOvertimeItem(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("namedItemName")?.value.trim() || "";
  if (!name) {
    document.getElementById("namedItemName")?.focus();
    return;
  }
  const startTime = readTimeInputValue("overtimeStartTime");
  const endTime = readTimeInputValue("overtimeEndTime");
  if (!isValidTimeRange(startTime, endTime)) return reportValidationError("上班時間必須早於下班時間");

  const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked) && useRest1;
  const rest1StartTime = useRest1 ? readTimeInputValue("overtimeRest1StartTime") : "";
  const rest1EndTime = useRest1 ? readTimeInputValue("overtimeRest1EndTime") : "";
  const rest2StartTime = useRest2 ? readTimeInputValue("overtimeRest2StartTime") : "";
  const rest2EndTime = useRest2 ? readTimeInputValue("overtimeRest2EndTime") : "";
  if (useRest1 && !isValidTimeRange(rest1StartTime, rest1EndTime)) return reportValidationError("休息1開始時間必須早於結束時間");
  if (useRest2 && !isValidTimeRange(rest2StartTime, rest2EndTime)) return reportValidationError("休息2開始時間必須早於結束時間");

  const payload = {
    ...readNamedColorPayloadBase("overtime", mode),
    name,
    startTime,
    endTime,
    useRest1,
    rest1StartTime,
    rest1EndTime,
    useRest2,
    rest2StartTime,
    rest2EndTime
  };
  await persistNamedCatalogItem("overtime", mode, payload, returnTo);
}

async function saveNamedColorItem(category, mode) {
  if (category === "shift") return saveShiftFromModal(mode);
  if (category === "leave") return saveLeaveItem(mode);
  if (category === "overtime") return saveOvertimeItem(mode);
  throw new Error(`unsupported catalog category: ${category}`);
}
'''
catalog = catalog[:start] + replacement + catalog[end:]
write("src/renderer/renderer-settings-catalog.js", catalog)

# -----------------------------------------------------------------------------
# Shared Edge runtime: one source of truth for Taipei date/effective-account and
# permission helpers.
# -----------------------------------------------------------------------------
shared_runtime = r'''export const TAIPEI_TIME_ZONE = "Asia/Taipei";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TAIPEI_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function taipeiDateString(date = new Date()) {
  return DATE_FORMATTER.format(date);
}

export function taipeiTimeString(date = new Date()) {
  return TIME_FORMATTER.format(date);
}

export function addDaysToDateString(value: string, count: number) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + count);
  return DATE_FORMATTER.format(date);
}

export function validDate(value: unknown, fallback: string) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

export function pageNumber(value: unknown) {
  const number = Number(value || 1);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

export function positiveInteger(value: unknown, fallback = 55) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

export function isProfileEffective(profile: any, today = taipeiDateString()) {
  if (!profile || profile.deleted_at) return false;
  const effectiveEndDate = profile.leave_date ? addDaysToDateString(profile.leave_date, 5) : "";
  return (!profile.hire_date || today >= profile.hire_date)
    && (!effectiveEndDate || today <= effectiveEndDate);
}

export function isProfileEmployedOn(profile: any, date: string) {
  return Boolean(profile
    && (!profile.hire_date || date >= profile.hire_date)
    && (!profile.leave_date || date <= profile.leave_date));
}

export function datesBetween(fromDate: string, toDate: string) {
  const dates: string[] = [];
  for (let date = fromDate; date && date <= toDate; date = addDaysToDateString(date, 1)) dates.push(date);
  return dates;
}

export function actorIdOf(ctx: any) {
  const actorId = String(ctx.userClaims?.sub || ctx.userClaims?.id || "").trim();
  if (!isUuid(actorId)) throw new Error("缺少有效登入身分");
  return actorId;
}

export async function rpcBoolean(ctx: any, name: string, payload: Record<string, unknown>) {
  const { data, error } = await ctx.supabaseAdmin.rpc(name, payload);
  if (error) throw error;
  return data === true;
}

export function hasPermission(ctx: any, actorId: string, permission: string) {
  return rpcBoolean(ctx, "has_access_permission", { p_user_id: actorId, p_permission: permission });
}

export function canAccessGroup(ctx: any, actorId: string, groupId: string, permission: string) {
  if (!isUuid(groupId)) return Promise.resolve(false);
  return rpcBoolean(ctx, "can_access_group", { p_user_id: actorId, p_group_id: groupId, p_permission: permission });
}
'''
shared_path = ROOT / "supabase/functions/_shared/runtime.ts"
shared_path.parent.mkdir(parents=True, exist_ok=True)
shared_path.write_text(shared_runtime, encoding="utf-8")

# Edge imports/removals. Keep domain-specific calculations local.
def add_import(path, import_line):
    text = read(path)
    if import_line not in text:
        text = text.replace('import { withSupabase } from "npm:@supabase/server@^1";\n', 'import { withSupabase } from "npm:@supabase/server@^1";\n' + import_line + '\n', 1)
    write(path, text)

add_import("supabase/functions/attendance-clock/index.ts", 'import { addDaysToDateString, isProfileEffective, taipeiDateString } from "../_shared/runtime.ts";')
edge = read("supabase/functions/attendance-clock/index.ts")
edge = re.sub(r"\nfunction taipeiDateString\([\s\S]*?\n}\n\nfunction addDaysToDateString[\s\S]*?\n}\n\nfunction isProfileEffective[\s\S]*?\n}\n", "\n", edge, count=1)
edge = edge.replace('if (!isProfileEffective(data)) throw new Error("帳號不在有效任職期間或尚未設定群組，無法打卡");', 'if (!isProfileEffective(data) || !data?.group_id) throw new Error("帳號不在有效任職期間或尚未設定群組，無法打卡");')
write("supabase/functions/attendance-clock/index.ts", edge)

for path, import_line in [
    ("supabase/functions/attendance-ledger/index.ts", 'import { addDaysToDateString as addDays, datesBetween, isProfileEffective as effective, isProfileEmployedOn as employedOn, pageNumber, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";'),
    ("supabase/functions/attendance-review-groups/index.ts", 'import { actorIdOf, addDaysToDateString as addDays, datesBetween, hasPermission, isProfileEffective as effective, isProfileEmployedOn as employedOn, pageNumber, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";'),
    ("supabase/functions/meal-report-v2/index.ts", 'import { actorIdOf, addDaysToDateString as addDays, hasPermission, isProfileEffective as effective, pageNumber, positiveInteger, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";'),
    ("supabase/functions/attendance-ledger-export/index.ts", 'import { actorIdOf, canAccessGroup, hasPermission, taipeiDateString as taipeiDate, validDate } from "../_shared/runtime.ts";'),
    ("supabase/functions/meal-order/index.ts", 'import { hasPermission, isProfileEffective, positiveInteger, taipeiDateString, taipeiTimeString } from "../_shared/runtime.ts";'),
    ("supabase/functions/member-auth-admin/index.ts", 'import { actorIdOf, addDaysToDateString, canAccessGroup, hasPermission, isProfileEffective, isUuid, rpcBoolean, taipeiDateString } from "../_shared/runtime.ts";'),
    ("supabase/functions/meal-cancel-v2/index.ts", 'import { actorIdOf, isProfileEffective, taipeiDateString, taipeiTimeString } from "../_shared/runtime.ts";'),
]:
    add_import(path, import_line)

# Remove duplicated runtime helpers by function name in specific Edge modules.
for path, names in {
    "supabase/functions/attendance-ledger/index.ts": ["taipeiDate", "addDays", "validDate", "pageNumber", "effective", "employedOn", "datesBetween"],
    "supabase/functions/attendance-review-groups/index.ts": ["taipeiDate", "addDays", "validDate", "pageNumber", "effective", "employedOn", "datesBetween"],
    "supabase/functions/meal-report-v2/index.ts": ["taipeiDate", "addDays", "effective", "validDate", "pageNumber", "positiveInteger"],
    "supabase/functions/attendance-ledger-export/index.ts": ["taipeiDate", "validDate", "actorIdOf", "rpcBoolean", "requireAttendanceReviewer"],
    "supabase/functions/meal-order/index.ts": ["taipeiDateString", "addDaysToDateString", "isProfileEffective", "taipeiTimeString", "positiveInteger", "hasPermission"],
    "supabase/functions/member-auth-admin/index.ts": ["taipeiDateString", "addDaysToDateString", "isProfileEffective", "isUuid", "actorIdOf", "rpcBoolean", "hasPermission", "canAccessGroup"],
    "supabase/functions/meal-cancel-v2/index.ts": ["localDate", "localTime"],
}.items():
    text = read(path)
    for name in names:
        # Handles ordinary JS/TS function declarations, including async functions.
        text = re.sub(rf"\n(?:async\s+)?function\s+{re.escape(name)}\([^)]*\)\s*\{{[\s\S]*?\n\}}\n", "\n", text, count=1)
    write(path, text)

edge = read("supabase/functions/attendance-review-groups/index.ts")
edge = edge.replace('  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";\n  if (!userId) throw new Error("請先登入");', '  const userId = actorIdOf(ctx);')
edge = re.sub(r"  const permission = await ctx\.supabaseAdmin\.rpc\(\"has_access_permission\", \{\s*p_user_id: userId, p_permission: \"attendance_review\"\s*\}\);\s*if \(permission\.error\) throw permission\.error;\s*if \(!permission\.data\) throw new Error\(\"沒有簽到審核權限\"\);", '  if (!await hasPermission(ctx, userId, "attendance_review")) throw new Error("沒有簽到審核權限");', edge)
write("supabase/functions/attendance-review-groups/index.ts", edge)

edge = read("supabase/functions/meal-report-v2/index.ts")
edge = edge.replace('  const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";\n  if (!userId) throw new Error("請先登入");', '  const userId = actorIdOf(ctx);')
edge = re.sub(r"  const permission = await ctx\.supabaseAdmin\.rpc\(\"has_access_permission\", \{[\s\S]*?\n  if \(!permission\.data\) throw new Error\(\"沒有訂餐管理權限\"\);", '  if (!await hasPermission(ctx, userId, "meal_admin")) throw new Error("沒有訂餐管理權限");', edge, count=1)
write("supabase/functions/meal-report-v2/index.ts", edge)

edge = read("supabase/functions/attendance-ledger-export/index.ts")
edge = edge.replace('      await requireAttendanceReviewer(ctx, actorId);', '      if (!await hasPermission(ctx, actorId, "attendance_review")) throw new Error("沒有簽到審核權限");')
edge = re.sub(r"await rpcBoolean\(ctx, \"can_access_group\", \{\s*p_user_id: actorId,\s*p_group_id: groupId,\s*p_permission: \"attendance_review\"\s*\}\)", 'await canAccessGroup(ctx, actorId, groupId, "attendance_review")', edge)
write("supabase/functions/attendance-ledger-export/index.ts", edge)

edge = read("supabase/functions/meal-order/index.ts")
edge = edge.replace('  if (!await hasPermission(ctx, profile.id, "meal_admin")) {', '  if (!await hasPermission(ctx, profile.id, "meal_admin")) {')
write("supabase/functions/meal-order/index.ts", edge)

edge = read("supabase/functions/meal-cancel-v2/index.ts")
edge = edge.replace('      const userId = ctx.userClaims?.sub || ctx.userClaims?.id || "";\n      if (!userId) throw new Error("請先登入");', '      const userId = actorIdOf(ctx);')
legacy_effective = '''      const today = localDate();\n      const leaveEnd = profile.data.leave_date\n        ? new Date(`${profile.data.leave_date}T00:00:00+08:00`)\n        : null;\n      if (leaveEnd) leaveEnd.setDate(leaveEnd.getDate() + 5);\n      const effectiveEnd = leaveEnd\n        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(leaveEnd)\n        : "";\n      if (profile.data.deleted_at\n        || (profile.data.hire_date && today < profile.data.hire_date)\n        || (effectiveEnd && today > effectiveEnd)) {\n        throw new Error("此帳號目前不在有效期間");\n      }\n'''
edge = replace_once(edge, legacy_effective, '      const today = taipeiDateString();\n      if (!isProfileEffective(profile.data, today)) throw new Error("此帳號目前不在有效期間");\n', "meal cancel effective rule")
edge = edge.replace('if (localTime() > cutoff)', 'if (taipeiTimeString() > cutoff)')
write("supabase/functions/meal-cancel-v2/index.ts", edge)

# AccessRole no longer contains legacy_role compatibility data.
edge = read("supabase/functions/member-auth-admin/index.ts")
edge = edge.replace('  legacy_role: string;\n', '')
write("supabase/functions/member-auth-admin/index.ts", edge)

# -----------------------------------------------------------------------------
# SQL canonicalization: final schema has no text-role compatibility layer.
# 001 is a base schema; 002 creates the permission model and final policies.
# -----------------------------------------------------------------------------
schema = read("supabase/001_current_schema.sql")
schema = re.sub(r"\n\s*role text not null default 'employee' check \(role in \('admin', 'manager', 'employee'\)\),", "", schema, count=1)
for name in ["is_manager", "is_admin", "protect_admin_member", "protect_department_attendance_fields", "get_my_profile_v2"]:
    schema = remove_function(schema, name)
for trigger in ["protect_admin_member_trigger", "trg_protect_department_attendance_fields"]:
    schema = remove_trigger_block(schema, trigger)
# 001 must not establish legacy direct-write policies; 002 owns final RLS.
def strip_base_policy(match):
    stmt = match.group(0)
    return stmt if re.search(r"create\s+policy\s+attendance_days_select_own\b", stmt, re.I) else ""
schema = re.sub(r"create\s+policy\s+[a-z0-9_]+\s+on\s+public\.[a-z0-9_]+[\s\S]*?;", strip_base_policy, schema, flags=re.I)
schema = re.sub(r"^.*(?:is_admin\(uuid\)|is_manager\(uuid\)|protect_admin_member|get_my_profile_v2|protect_department_attendance_fields).*$\n?", "", schema, flags=re.I | re.M)
write("supabase/001_current_schema.sql", schema)

updates = read("supabase/002_current_updates.sql")
updates = re.sub(r"\n\s*legacy_role text not null default 'employee' check \(legacy_role in \('admin','manager','employee'\)\),", "", updates, count=1)
updates = replace_once(
    updates,
    "insert into public.access_roles(code,name,permissions,legacy_role,is_system) values\n('admin','管理員',array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin'],'admin',true),\n('manager','主管',array['schedule_view','schedule_manage','department_settings','member_settings','leave_settings','attendance_review','meal_admin'],'manager',true),\n('employee','員工',array['schedule_view'],'employee',true)\n",
    "insert into public.access_roles(code,name,permissions,is_system) values\n('admin','管理員',array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin'],true),\n('manager','主管',array['schedule_view','schedule_manage','department_settings','member_settings','leave_settings','attendance_review','meal_admin'],true),\n('employee','員工',array['schedule_view'],true)\n",
    "access role seed",
)
updates = re.sub(
    r"update public\.set_employee employee\nset access_role_id=role\.id\nfrom public\.access_roles role\nwhere employee\.access_role_id is null and role\.code=case employee\.role when 'admin' then 'admin' when 'manager' then 'manager' else 'employee' end;",
    "update public.set_employee employee\nset access_role_id=role.id\nfrom public.access_roles role\nwhere employee.access_role_id is null and role.code='employee';",
    updates,
    count=1,
)
# Remove every legacy helper/compat definition. Canonical replacements are appended below.
for name in ["access_role_legacy_role", "is_admin", "is_manager", "protect_employee_role_changes", "protect_department_attendance_fields", "save_access_role_v1", "get_group_access_bundle_v1", "get_group_entity_map_v1"]:
    updates = remove_function(updates, name)
for trigger in ["protect_admin_member_trigger", "trg_protect_last_effective_admin_v2", "trg_protect_employee_role_changes", "trg_protect_department_attendance_fields"]:
    updates = remove_trigger_block(updates, trigger)
# Remove obsolete grants/revokes referencing removed APIs/helpers.
updates = re.sub(r"^.*(?:access_role_legacy_role|public\.is_admin\(uuid\)|public\.is_manager\(uuid\)|get_group_entity_map_v1|protect_employee_role_changes|protect_department_attendance_fields).*$\n?", "", updates, flags=re.I | re.M)
# Existing get_my_profile_v2 is retired in favor of role-free v3.
updates = re.sub(r"^.*get_my_profile_v2.*$\n?", "", updates, flags=re.I | re.M)
# Bootstrap no longer emits role or duplicate entity map.
updates = updates.replace(",\n    'sort_order',member.sort_order,'role',member.role,'deleted_at',member.deleted_at", ",\n    'sort_order',member.sort_order,'deleted_at',member.deleted_at")
updates = updates.replace("  'entityMap',public.get_group_entity_map_v1()", "  'archiveRanges',public.get_schedule_archive_ranges_v1()")
# Remove dynamic catalog-text policy rewriting; explicit canonical policies are emitted below.
updates = re.sub(r"\n-- Performance Advisor: remaining public RLS auth context uses init-plan evaluation\.[\s\S]*?\nend \$\$;\s*$", "\n", updates, count=1)

# Collect final RLS definitions, remove all historical policy DDL, then append each once.
policy_create_re = re.compile(r"create\s+policy\s+(?P<name>[a-z0-9_]+)\s+on\s+public\.(?P<table>[a-z0-9_]+)[\s\S]*?;", re.I)
policy_drop_re = re.compile(r"drop\s+policy\s+if\s+exists\s+(?P<name>[a-z0-9_]+)\s+on\s+public\.(?P<table>[a-z0-9_]+)\s*;", re.I)
last_policy = {}
for match in policy_create_re.finditer(updates):
    stmt = match.group(0)
    stmt = stmt.replace("auth.uid()", "(select auth.uid())").replace("auth.role()", "(select auth.role())")
    key = (match.group("table").lower(), match.group("name").lower())
    # Browser table writes are RPC-only. Keep only SELECT policies for authenticated.
    if re.search(r"\bfor\s+(insert|update|delete|all)\b", stmt, re.I) and re.search(r"\bto\s+authenticated\b", stmt, re.I):
        continue
    last_policy[key] = stmt
all_drop_keys = {(m.group("table").lower(), m.group("name").lower()) for m in policy_drop_re.finditer(updates)}
updates = policy_create_re.sub("", updates)
updates = policy_drop_re.sub("", updates)

canonical_sql = r'''

-- ============================================================================
-- Canonical permission model / APIs / RLS
-- ============================================================================
begin;

create or replace function public.get_my_profile_v3()
returns table (
  id uuid,
  employee_code text,
  full_name text,
  home_department_id uuid,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  created_at timestamptz,
  updated_at timestamptz,
  schedule_department_ids text[],
  monthly_rest_days integer,
  fixed_rest_weekday integer,
  schedule_shift_ids uuid[],
  sort_order integer,
  group_id uuid,
  access_role_id uuid,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select employee.id,employee.employee_code,employee.full_name,employee.home_department_id,
    employee.position_name,employee.hire_date,employee.leave_date,employee.pay_by_day,
    employee.created_at,employee.updated_at,employee.schedule_department_ids,employee.monthly_rest_days,
    employee.fixed_rest_weekday,employee.schedule_shift_ids,employee.sort_order,employee.group_id,
    employee.access_role_id,employee.deleted_at
  from public.set_employee employee
  where employee.id=(select auth.uid()) and employee.deleted_at is null
$$;

create or replace function public.get_schedule_archive_ranges_v1()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  with actor as (
    select employee.access_role_id
    from public.set_employee employee
    where employee.id=(select auth.uid())
      and employee.deleted_at is null
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  ), allowed_groups as (
    select role_group.group_id
    from actor
    join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'groupId',archive.group_id,'startDate',archive.start_date,'endDate',archive.end_date
  ) order by archive.start_date,archive.end_date,archive.id),'[]'::jsonb)
  from public.schedule_archives archive
  join allowed_groups allowed on allowed.group_id=archive.group_id
$$;

create or replace function public.get_group_access_bundle_v1()
returns jsonb language sql stable security definer set search_path=public,pg_catalog as $$
with actor as(
 select employee.id,employee.group_id,employee.access_role_id,role.name role_name,role.permissions
 from public.set_employee employee join public.access_roles role on role.id=employee.access_role_id
 where employee.id=(select auth.uid()) and employee.deleted_at is null
   and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
), actor_groups as(
 select role_group.group_id from actor join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
), visible_groups as(
 select grp.* from public.schedule_groups grp
 where grp.deleted_at is null and (public.has_access_permission((select auth.uid()),'permission_settings') or grp.id in(select group_id from actor_groups))
), role_rows as(
 select role.id,role.code,role.name,role.permissions,role.is_system,
   coalesce(array_agg(role_group.group_id order by grp.sort_order,grp.name) filter(where grp.id is not null),'{}') group_ids
 from public.access_roles role
 left join public.access_role_groups role_group on role_group.role_id=role.id
 left join public.schedule_groups grp on grp.id=role_group.group_id and grp.deleted_at is null
 where exists(select 1 from actor)
   and (public.has_access_permission((select auth.uid()),'permission_settings')
     or public.has_access_permission((select auth.uid()),'member_settings')
     or role.id=(select access_role_id from actor))
 group by role.id
)
select jsonb_build_object(
 'actor',coalesce((select jsonb_build_object(
   'groupId',group_id,'roleId',access_role_id,'roleName',role_name,'permissions',permissions,
   'applicableGroupIds',coalesce((select jsonb_agg(group_id) from actor_groups),'[]'::jsonb)
 ) from actor),'{}'::jsonb),
 'groups',coalesce((select jsonb_agg(jsonb_build_object(
   'id',grp.id,'code',grp.code,'name',grp.name,'mealEnabled',grp.meal_enabled,'status',grp.status,
   'sortOrder',grp.sort_order,'unitNames',coalesce((select jsonb_agg(department.name order by department.sort_order,department.name)
      from public.set_departments department where department.group_id=grp.id and department.deleted_at is null),'[]'::jsonb)
 ) order by grp.sort_order,grp.name) from visible_groups grp),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object(
   'id',id,'code',code,'name',name,'permissions',permissions,'isSystem',is_system,'groupIds',group_ids
 ) order by name) from role_rows),'[]'::jsonb)
)
$$;

create or replace function public.save_access_role_v1(p_role jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_id uuid; v_code text; v_name text; v_permissions text[]; v_group_ids uuid[]; v_role public.access_roles%rowtype;
begin
  if not public.has_access_permission((select auth.uid()),'permission_settings') then raise exception '沒有權限設定權限' using errcode='42501'; end if;
  begin v_id:=nullif(btrim(p_role->>'id'),'')::uuid; exception when invalid_text_representation then raise exception '角色識別碼格式錯誤'; end;
  v_name:=btrim(coalesce(p_role->>'name',''));
  v_code:=lower(regexp_replace(btrim(coalesce(p_role->>'code','')),'[^A-Za-z0-9_-]+','-','g'));
  if v_name='' then raise exception '角色名稱不可空白'; end if;
  if v_id is null then v_id:=gen_random_uuid(); end if;
  if v_code='' then v_code:='role-'||replace(v_id::text,'-',''); end if;
  select coalesce(array_agg(distinct value),'{}') into v_permissions
  from jsonb_array_elements_text(coalesce(p_role->'permissions','[]')) value
  where value=any(array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin']);
  if 'schedule_manage'=any(v_permissions) and not 'schedule_view'=any(v_permissions) then v_permissions:=array_append(v_permissions,'schedule_view'); end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_group_ids
  from jsonb_array_elements_text(coalesce(p_role->'groupIds','[]')) value
  join public.schedule_groups grp on grp.id=value::uuid and grp.deleted_at is null;
  if v_permissions && array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','attendance_review','meal_admin']::text[]
     and cardinality(v_group_ids)=0 then raise exception '請至少選擇一個適用群組'; end if;
  insert into public.access_roles(id,code,name,permissions,is_system)
  values(v_id,v_code,v_name,v_permissions,false)
  on conflict(id) do update set name=excluded.name,permissions=excluded.permissions,updated_at=now()
  returning * into v_role;
  delete from public.access_role_groups where role_id=v_id and group_id in(select id from public.schedule_groups where deleted_at is null);
  insert into public.access_role_groups(role_id,group_id) select v_id,unnest(v_group_ids) on conflict do nothing;
  return jsonb_build_object('ok',true,'role',jsonb_build_object(
    'id',v_role.id,'code',v_role.code,'name',v_role.name,'permissions',v_role.permissions,
    'isSystem',v_role.is_system,'groupIds',v_group_ids));
end $$;

create or replace function public.protect_employee_role_changes()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_new_role public.access_roles%rowtype;
  v_old_role public.access_roles%rowtype;
  v_actor_can_permissions boolean:=false;
  v_today date:=(timezone('Asia/Taipei',now()))::date;
  v_old_privileged boolean:=false;
  v_new_privileged boolean:=false;
begin
  select * into v_new_role from public.access_roles where id=new.access_role_id;
  if not found then raise exception '找不到權限角色'; end if;
  if tg_op='UPDATE' then
    select * into v_old_role from public.access_roles where id=old.access_role_id;
    v_old_privileged:=old.deleted_at is null and v_old_role.id is not null
      and 'permission_settings'=any(coalesce(v_old_role.permissions,'{}'::text[]))
      and public.is_employee_account_effective(old.hire_date,old.leave_date,v_today);
    v_new_privileged:=new.deleted_at is null
      and 'permission_settings'=any(coalesce(v_new_role.permissions,'{}'::text[]))
      and public.is_employee_account_effective(new.hire_date,new.leave_date,v_today);
    if v_old_privileged and not v_new_privileged and not exists(
      select 1 from public.set_employee other_employee
      join public.access_roles other_role on other_role.id=other_employee.access_role_id
      where other_employee.id<>old.id and other_employee.deleted_at is null
        and 'permission_settings'=any(coalesce(other_role.permissions,'{}'::text[]))
        and public.is_employee_account_effective(other_employee.hire_date,other_employee.leave_date,v_today)
    ) then raise exception '系統必須保留至少一個有效的權限管理帳號' using errcode='23514'; end if;
  end if;
  if (select auth.uid()) is not null and (select auth.role())<>'service_role' and current_setting('fyh.group_delete',true)<>'on' then
    if not public.has_access_permission((select auth.uid()),'member_settings') then raise exception '沒有人員設定權限' using errcode='42501'; end if;
    if tg_op='UPDATE' and old.group_id is not null and not public.role_applies_to_group((select auth.uid()),old.group_id) then raise exception '此角色不可管理人員原群組' using errcode='42501'; end if;
    if new.group_id is null or not public.role_applies_to_group((select auth.uid()),new.group_id) then raise exception '此角色不可管理人員所屬群組' using errcode='42501'; end if;
    if new.home_department_id is null or not exists(select 1 from public.set_departments department where department.id=new.home_department_id and department.group_id=new.group_id and department.deleted_at is null) then raise exception '所屬單位不在所選群組'; end if;
    if exists(select 1 from unnest(coalesce(new.schedule_shift_ids,'{}'::uuid[])) shift_id where not exists(select 1 from public.set_shift shift where shift.id=shift_id and shift.group_id=new.group_id and shift.deleted_at is null)) then raise exception '排班班別不在人員所屬群組'; end if;
    if tg_op='UPDATE' and new.group_id is distinct from old.group_id then perform public.validate_member_group_change_v1(old.employee_code,new.group_id); end if;
    v_actor_can_permissions:=public.has_access_permission((select auth.uid()),'permission_settings');
    if not v_actor_can_permissions then
      if tg_op='UPDATE' and new.access_role_id is distinct from old.access_role_id then raise exception '沒有變更權限角色的權限' using errcode='42501'; end if;
      if tg_op='INSERT' and not (coalesce(v_new_role.permissions,'{}'::text[]) <@ array['schedule_view']::text[]) then
        raise exception '沒有指派管理權限角色的權限' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.protect_department_attendance_fields()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group_id uuid; v_sensitive_changed boolean:=false;
begin
  if (select auth.uid()) is null or (select auth.role())='service_role' then return new; end if;
  v_group_id:=coalesce(new.group_id,old.group_id);
  if tg_op='INSERT' then
    v_sensitive_changed:=new.address is not null or new.latitude is not null or new.longitude is not null
      or new.public_ip is not null or new.attendance_enabled is true
      or new.attendance_settings_updated_at is not null or new.attendance_settings_updated_by is not null;
  else
    v_sensitive_changed:=new.address is distinct from old.address or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude or new.public_ip is distinct from old.public_ip
      or new.attendance_enabled is distinct from old.attendance_enabled
      or new.attendance_settings_updated_at is distinct from old.attendance_settings_updated_at
      or new.attendance_settings_updated_by is distinct from old.attendance_settings_updated_by;
  end if;
  if v_sensitive_changed and (
    not public.has_access_permission((select auth.uid()),'permission_settings')
    or not public.can_access_group((select auth.uid()),v_group_id,'department_settings')
  ) then raise exception '沒有修改打卡設定的權限' using errcode='42501'; end if;
  return new;
end $$;

drop trigger if exists trg_protect_employee_role_changes on public.set_employee;
create trigger trg_protect_employee_role_changes before insert or update on public.set_employee
for each row execute function public.protect_employee_role_changes();
drop trigger if exists trg_protect_department_attendance_fields on public.set_departments;
create trigger trg_protect_department_attendance_fields before insert or update on public.set_departments
for each row execute function public.protect_department_attendance_fields();

drop function if exists public.get_my_profile_v2();
drop function if exists public.get_group_entity_map_v1();
drop function if exists public.access_role_legacy_role(text[]);
drop function if exists public.is_admin(uuid);
drop function if exists public.is_manager(uuid);

alter table public.set_employee drop column if exists role;
alter table public.access_roles drop column if exists legacy_role;

revoke all on function public.get_my_profile_v3() from public,anon;
revoke all on function public.get_schedule_archive_ranges_v1() from public,anon;
revoke all on function public.get_group_access_bundle_v1() from public,anon;
revoke all on function public.save_access_role_v1(jsonb) from public,anon;
revoke all on function public.protect_employee_role_changes() from public,anon,authenticated;
revoke all on function public.protect_department_attendance_fields() from public,anon,authenticated;
grant execute on function public.get_my_profile_v3(),public.get_schedule_archive_ranges_v1(),public.get_group_access_bundle_v1(),public.save_access_role_v1(jsonb) to authenticated,service_role;
grant execute on function public.protect_employee_role_changes(),public.protect_department_attendance_fields() to service_role;
commit;
'''
updates = updates.rstrip() + canonical_sql

# Canonical RLS: every historical policy is represented once, with write policies removed.
policy_keys = sorted(set(all_drop_keys) | set(last_policy.keys()))
policy_lines = ["\n\nbegin;", "-- Canonical RLS: browser writes are named RPC/Edge only."]
for table, name in policy_keys:
    policy_lines.append(f"drop policy if exists {name} on public.{table};")
    stmt = last_policy.get((table, name))
    if stmt:
        policy_lines.append(stmt)
policy_lines.append("commit;\n")
updates += "\n".join(policy_lines)

# Bootstrap may have been defined before the canonical archive-range function; SQL function
# resolution happens at create time, so move/redefine it after the canonical APIs by appending
# its final definition only if present, with archiveRanges already substituted.
bootstrap_matches = list(re.finditer(r"create or replace function public\.get_scheduler_bootstrap_v3\b[\s\S]*?\$\$;", updates, re.I))
if bootstrap_matches:
    bootstrap = bootstrap_matches[-1].group(0)
    for match in reversed(bootstrap_matches):
        updates = updates[:match.start()] + updates[match.end():]
    updates += "\n\n" + bootstrap + "\n"

# No compatibility grant or source-level text-role authorization may remain.
write("supabase/002_current_updates.sql", updates)

# -----------------------------------------------------------------------------
# Tests and documentation.
# -----------------------------------------------------------------------------
test = r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("canonical renderer has no legacy role state or guessed schedule ids", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const normalization = read("src/renderer/renderer-state-normalization.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotMatch(foundation, /ROLE_OPTIONS|role:\s*"manager"/);
  assert.doesNotMatch(normalization, /merged\.role|fallbackOvertimeId/);
  assert.doesNotMatch(webApi, /resolveManagerMemberProfileId/);
  assert.match(webApi, /isUuid\(profileMemberId\)/);
});

test("group state keeps canonical metadata directly and archive ranges separately", () => {
  const groups = read("src/renderer/renderer-groups-permissions-archive.js");
  assert.doesNotMatch(groups, /entityMap|makeIdMap|allDepartments|allMembers|allShifts|allSchedule/);
  assert.match(groups, /catalog:\s*\{ departments: \[\], members: \[\], shifts: \[\], schedule: \{\} \}/);
  assert.match(groups, /archiveRanges/);
  assert.match(groups, /getDefaultAccessRoleId/);
});

test("Edge Functions share Taipei/effective-account and permission primitives", () => {
  const shared = read("supabase/functions/_shared/runtime.ts");
  for (const token of ["taipeiDateString", "isProfileEffective", "actorIdOf", "hasPermission", "canAccessGroup"]) {
    assert.match(shared, new RegExp(`function ${token}|export function ${token}`));
  }
  for (const path of [
    "supabase/functions/attendance-clock/index.ts",
    "supabase/functions/attendance-ledger/index.ts",
    "supabase/functions/attendance-review-groups/index.ts",
    "supabase/functions/attendance-ledger-export/index.ts",
    "supabase/functions/meal-order/index.ts",
    "supabase/functions/meal-report-v2/index.ts",
    "supabase/functions/meal-cancel-v2/index.ts",
    "supabase/functions/member-auth-admin/index.ts"
  ]) assert.match(read(path), /\.\.\/_shared\/runtime\.ts/);
});

test("XLSX meal formatting belongs to exporter, not transport API", () => {
  const exporter = read("src/renderer/browser-exporter.js");
  const webApi = read("src/renderer/web-api.js");
  assert.match(exporter, /async function createMealReportWorkbook/);
  assert.doesNotMatch(webApi, /function buildMealEmployeeRows|function styleMealExportSheet|compactMealExportDate/);
  assert.match(webApi, /exporter\.createMealReportWorkbook/);
});

test("leave and overtime saves use explicit domain paths", () => {
  const catalog = read("src/renderer/renderer-settings-catalog.js");
  assert.match(catalog, /async function saveLeaveItem/);
  assert.match(catalog, /async function saveOvertimeItem/);
  assert.match(catalog, /async function persistNamedCatalogItem/);
});

test("SQL canonical source has no text-role compatibility model or dynamic policy rewriting", () => {
  const schema = read("supabase/001_current_schema.sql");
  const updates = read("supabase/002_current_updates.sql");
  const combined = `${schema}\n${updates}`;
  assert.doesNotMatch(combined, /legacy_role|access_role_legacy_role|employee\.role|new\.role|ROLE_OPTIONS/);
  assert.doesNotMatch(schema, /\brole text not null default 'employee'/);
  assert.doesNotMatch(updates, /Performance Advisor: remaining public RLS auth context uses init-plan evaluation/);
  assert.match(updates, /get_my_profile_v3/);
  assert.match(updates, /get_schedule_archive_ranges_v1/);
  assert.doesNotMatch(updates, /get_group_entity_map_v1\(\)/);
});

test("each final RLS policy is created once and authenticated has no direct write policy", () => {
  const sql = read("supabase/002_current_updates.sql");
  const names = [...sql.matchAll(/create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/gi)].map((match) => `${match[2]}.${match[1]}`);
  assert.equal(new Set(names).size, names.length);
  for (const statement of sql.match(/create\s+policy[\s\S]*?;/gi) || []) {
    if (/to\s+authenticated/i.test(statement)) assert.doesNotMatch(statement, /for\s+(insert|update|delete|all)\b/i);
  }
});
'''
write("tests/canonical-cleanup.test.js", test)

# Update older tests to the new profile/archive API and clear role helper names.
for path in (ROOT / "tests").glob("*.test.js"):
    text = path.read_text(encoding="utf-8")
    text = text.replace("get_my_profile_v2", "get_my_profile_v3")
    text = text.replace("get_group_entity_map_v1", "get_schedule_archive_ranges_v1")
    text = text.replace("getGroupEntityMap", "getScheduleArchiveRanges")
    text = text.replace("function isAdmin", "function canManagePermissions")
    text = text.replace("isAdmin()", "canManagePermissions()")
    text = text.replace("function isManager", "function hasManagementAccess")
    text = text.replace("isManager()", "hasManagementAccess()")
    path.write_text(text, encoding="utf-8")

# Documentation: add durable canonical-cleanup rules.
sections = {
    "README.md": '''\n## Canonical 程式簡化原則\n\n- 正式狀態只保存目前功能真正需要的欄位；群組／角色／刪除狀態由 canonical API 直接提供，不再透過第二份 entity map 補值。\n- 前端排班人員主鍵一律為 UUID；不得以工號或臨時字串 ID 猜測／二次查詢主鍵。\n- 已刪除的歷史班別、假別、加班由後端明確回傳歷史項目；不存在的 ID 不得自動替換成第一個可用項目。\n- Edge Functions 的台北日期、帳號有效期間、UUID 與權限 helper 統一放在 `supabase/functions/_shared/`。\n- XLSX 建立與格式由 `browser-exporter.js` 負責；`web-api.js` 僅處理 transport、RPC／Edge 呼叫與下載協調。\n- SQL 正式來源不保留文字角色相容欄位、動態文字改寫 policy、重複 policy 定義或瀏覽器直接寫入 policy。\n''',
    "AGENTS.md": '''\n### Canonical Cleanup 守門規則\n\n- 不得重新加入 `set_employee.role`、`access_roles.legacy_role`、固定 `admin/manager/employee` 授權判斷或角色相容 helper。\n- 不得建立 entityMap 來重複保存已存在於正式 DTO 的 groupId／roleId／deleted；封存範圍使用獨立 archiveRanges。\n- 排班寫入只接受 UUID memberId；不得再以工號查回 UUID 作為相容 fallback。\n- 無效 catalog ID 不可猜測替代值。歷史軟刪除項目必須由正式資料契約保留。\n- 共用 Edge 日期／帳號有效性／權限邏輯只能維護在 `_shared`，不得複製到各 Function。\n- SQL 每個最終 RLS policy 只建立一次；authenticated 不得有核心表 INSERT/UPDATE/DELETE/FOR ALL policy。\n''',
    "規格書.md": '''\n### Canonical 程式與資料模型簡化規範（2026-08-08）\n\n1. 權限模型唯一來源為 `access_role_id + permissions + access_role_groups`；資料庫與前端不得保留文字角色相容欄位作為授權或顯示來源。\n2. 班表 bootstrap 直接提供 `groupId`、`roleId`、`deleted` 等正式欄位；封存日期範圍以 `archiveRanges` 獨立提供，不建立重複 entity map。\n3. 前端正式排班資料的人員主鍵必須為 UUID；遇到非 UUID 視為資料錯誤，不再以工號反查或猜測主鍵。\n4. 被軟刪除但仍由未封存班表引用的主檔，後端必須明確回傳該歷史項目；若 ID 真正不存在，前端不得改套其他假別／加班／班別。\n5. Edge Function 的台北日期、離職後五日帳號有效期、UUID 與權限判斷採單一 `_shared` 實作，避免各功能規則漂移。\n6. Excel／XLSX 的建立與格式全部由 exporter 管理；API transport 不直接操作 ExcelJS workbook。\n7. SQL 正式來源只保留最後有效的 RLS policy；核心表 browser 寫入只走具名 RPC／Edge Function。\n'''
}
for path, section in sections.items():
    text = read(path)
    heading = section.strip().splitlines()[0]
    if heading not in text:
        text = text.rstrip() + "\n" + section
    write(path, text)

# Final source assertions before build.
assert 'ROLE_OPTIONS' not in read("src/renderer/renderer-foundation.js")
assert 'fallbackOvertimeId' not in read("src/renderer/renderer-state-normalization.js")
assert 'entityMap' not in read("src/renderer/renderer-groups-permissions-archive.js")
assert 'resolveManagerMemberProfileId' not in read("src/renderer/web-api.js")
assert 'legacy_role' not in read("supabase/002_current_updates.sql")
assert 'employee.role' not in read("supabase/002_current_updates.sql")
print("Canonical cleanup source transformation completed")
