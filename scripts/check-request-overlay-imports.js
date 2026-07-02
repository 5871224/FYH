const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const exporter = fs.readFileSync(path.join(rootDir, "src", "renderer", "browser-exporter.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");

assert(
  !renderer.includes('data-open-leave-request="true"') &&
    !renderer.includes('data-open-overtime-request="true"') &&
    !renderer.includes("openLeaveRequestModal") &&
    !renderer.includes("openOvertimeRequestModal") &&
    !renderer.includes("openLeaveApprovalModal") &&
    !renderer.includes("openOvertimeApprovalModal"),
  "employee request and review UI should be removed"
);
assert(
  !renderer.includes("getRequestStatusLabel") &&
    !renderer.includes("function isManagerRequestSource") &&
    !renderer.includes("function isEffectiveRequestStatus") &&
    !renderer.includes("const onlyManagerRecords") &&
    !renderer.includes("record.source") &&
    !renderer.includes("record.status"),
  "renderer should not depend on request approval/source fields"
);
assert(
  !renderer.includes("refreshScheduleRequestsAfterInitialRender") &&
    !renderer.includes("syncManagerEntriesToSchedule") &&
    !renderer.includes("syncApprovedRequestsToSchedule"),
  "schedule should not run removed request overlay sync"
);
assert(
  renderer.includes("const canEditScheduleOrder = canEditSchedule();") &&
    renderer.includes('data-table-member-id="${escapeHtml(member.id)}"') &&
    renderer.includes('if (!canEditSchedule()) return;') &&
    renderer.includes("const canDragScheduleOrder = canEditSchedule() && state.tableView !== \"shift\";"),
  "schedule table drag and double-click edit paths should require manager edit permission"
);
assert(
  !webApi.includes("async function createLeaveRequest") &&
    !webApi.includes("async function createOvertimeRequest") &&
    !webApi.includes("async function updateLeaveRequest") &&
    !webApi.includes("async function updateOvertimeRequest(payload)") &&
    !webApi.includes("async function deleteLeaveRequest") &&
    !webApi.includes("async function deleteOvertimeRequest") &&
    !webApi.includes("async function createManagerLeaveRequest") &&
    !webApi.includes("async function updateManagerLeaveRequest") &&
    !webApi.includes("async function deleteManagerLeaveRequest") &&
    !webApi.includes("async function createManagerOvertimeRequest") &&
    !webApi.includes("async function updateManagerOvertimeRequest") &&
    !webApi.includes("async function deleteManagerOvertimeRequest") &&
    !webApi.includes("async function listLeaveRequests") &&
    !webApi.includes("async function listOvertimeRequests") &&
    !webApi.includes("async function listPublicScheduleRequests") &&
    !webApi.includes("status: \"approved\"") &&
    !webApi.includes("source: \"manager\"") &&
    !webApi.includes("manager_note") &&
    !webApi.includes("approved_by") &&
    !webApi.includes("approved_at"),
  "web api should not expose employee request, approval, or source helpers"
);
assert(
  !renderer.includes("leaveRequestId") &&
    !renderer.includes("overtimeRequestId") &&
    !renderer.includes("leaveRequestRecords") &&
    !renderer.includes("overtimeRequestRecords"),
  "renderer should not keep legacy request ids or record caches"
);
assert(
  renderer.includes("function findDirectLeaveScheduleConflict(") &&
    renderer.includes("function hasDirectOvertimeScheduleConflict("),
  "renderer should keep direct schedule conflict guards"
);
assert(
  !renderer.includes("function clearManagerEntriesFromSlot") &&
    !renderer.includes("function deleteManagerScheduleEntry") &&
    renderer.includes("async function clearSelectedScheduleCells()") &&
    renderer.includes("async function pasteScheduleClipboard()") &&
    renderer.includes("await persistScheduleCells(changedCells);"),
  "keyboard delete and paste should use bulk schedule cell persistence without legacy manager entry deletes"
);
assert(
  !renderer.includes("request-leave-") &&
    !renderer.includes("getAllowedLeaveRequestItems") &&
    !renderer.includes("getLeaveRequestCatalogId") &&
    !renderer.includes("getLeaveRequestDisplayName") &&
    !renderer.includes("requestStyles") &&
    !renderer.includes("請假申請") &&
    !renderer.includes("加班申請"),
  "renderer should not keep removed employee request catalog or wording"
);
assert(
  renderer.includes('data-export-departments="true"') && renderer.includes('data-import-departments="true"'),
  "department settings should expose export and import actions"
);
assert(
  renderer.includes('data-export-settings="${category}"') && renderer.includes('data-import-settings="${category}"'),
  "catalog settings should expose export and import actions"
);
assert(
  webApi.includes("async function exportDepartments(payload)") &&
    webApi.includes("async function importDepartments()") &&
    webApi.includes("async function exportShifts(payload)") &&
    webApi.includes("async function importShifts()") &&
    webApi.includes("async function exportLeaveSettings(payload)") &&
    webApi.includes("async function importLeaveSettings()") &&
    webApi.includes("async function exportOvertimeSettings(payload)") &&
    webApi.includes("async function importOvertimeSettings()"),
  "web api should expose import and export helpers for all settings screens"
);
assert(
  exporter.includes("createDepartmentWorkbook") &&
    exporter.includes("parseDepartmentWorkbook") &&
    exporter.includes("createShiftWorkbook") &&
    exporter.includes("parseShiftWorkbook") &&
    exporter.includes("createLeaveSettingsWorkbook") &&
    exporter.includes("parseLeaveSettingsWorkbook") &&
    exporter.includes("createOvertimeSettingsWorkbook") &&
    exporter.includes("parseOvertimeSettingsWorkbook"),
  "browser exporter should support workbook round-trips for settings screens"
);
assert(
  !exporter.includes("請假申請預覽") &&
    !exporter.includes("加班申請預覽") &&
    !exporter.includes("requestStyles") &&
    !exporter.includes("requestStyle"),
  "settings workbooks should not keep removed request preview sheets"
);
assert(
  !schema.includes("request_status") &&
    !schema.includes("request_type") &&
    !schema.includes("approved_by") &&
    !schema.includes("approved_at") &&
    !schema.includes("manager_note") &&
    !schema.includes("leave_requests") &&
    !schema.includes("overtime_requests") &&
    schema.includes("create table if not exists public.clock_locations") &&
    schema.includes("create table if not exists public.attendance_logs"),
  "current schema should not recreate removed employee request approval fields"
);
assert(
  schema.includes("create table if not exists public.schedule_entries") &&
    schema.includes("shift_type_id") &&
    schema.includes("leave_type_id") &&
    schema.includes("overtime_type_id") &&
    !schema.includes("schedule_documents") &&
    !schema.includes("schedule_months"),
  "current schema should use schedule_entries only for schedule cell storage"
);

console.log("manager schedule entry cleanup and settings import/export checks passed");
