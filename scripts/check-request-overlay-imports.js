const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const exporter = fs.readFileSync(path.join(rootDir, "src", "renderer", "browser-exporter.js"), "utf8");
const initialSql = fs.readFileSync(path.join(rootDir, "supabase", "001_initial_schema.sql"), "utf8");
const cleanupSql = fs.readFileSync(path.join(rootDir, "supabase", "016_manager_schedule_entries_cleanup.sql"), "utf8");
const unusedSql = fs.readFileSync(path.join(rootDir, "supabase", "018_drop_unused_tables.sql"), "utf8");
const mergeSql = fs.readFileSync(path.join(rootDir, "supabase", "022_rename_settings_and_merge_schedule_entries.sql"), "utf8");
const finalCleanupSql = fs.readFileSync(path.join(rootDir, "supabase", "025_remove_legacy_request_artifacts.sql"), "utf8");

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
  !initialSql.includes("request_status") &&
    !initialSql.includes("request_type") &&
    !initialSql.includes("approved_by") &&
    !initialSql.includes("approved_at") &&
    !initialSql.includes("manager_note") &&
    !initialSql.includes("employees_can_insert_own_leave_requests") &&
    !initialSql.includes("employees_can_insert_own_overtime_requests") &&
    initialSql.includes("create table public.clock_locations") &&
    initialSql.includes("create table public.attendance_logs"),
  "initial schema should not recreate removed employee request approval fields"
);
assert(
  cleanupSql.includes('drop policy if exists "employees_can_insert_own_leave_requests"') &&
    cleanupSql.includes('drop policy if exists "employees_can_update_own_leave_requests"') &&
    cleanupSql.includes('drop policy if exists "employees_can_delete_own_pending_leave_requests"') &&
    cleanupSql.includes('drop policy if exists "employees_can_insert_own_overtime_requests"') &&
    cleanupSql.includes('drop policy if exists "employees_can_update_own_overtime_requests"') &&
    cleanupSql.includes('drop policy if exists "employees_can_delete_own_pending_overtime_requests"') &&
    cleanupSql.includes("drop column if exists source cascade") &&
    cleanupSql.includes("drop column if exists status cascade") &&
    cleanupSql.includes("drop column if exists approved_by cascade") &&
    cleanupSql.includes("drop column if exists approved_at cascade") &&
    cleanupSql.includes("drop column if exists manager_note cascade") &&
    mergeSql.includes("drop table if exists public.leave_requests cascade") &&
    mergeSql.includes("drop table if exists public.overtime_requests cascade") &&
    cleanupSql.includes("drop type if exists public.request_type") &&
    !cleanupSql.includes("drop table if exists public.attendance_logs") &&
    !cleanupSql.includes("drop table if exists public.clock_locations") &&
    !cleanupSql.includes("drop table if exists public.schedule_entries") &&
    !mergeSql.includes("drop table if exists public.set_shift") &&
    !mergeSql.includes("drop table if exists public.set_employee_departments"),
  "supabase migration should remove employee request and approval columns"
);
assert(
  unusedSql.includes("drop table if exists public.manager_departments") &&
    unusedSql.includes("drop table if exists public.schedule_documents") &&
    unusedSql.includes("drop table if exists public.schedule_months cascade") &&
    unusedSql.includes("drop type if exists public.request_type") &&
    !unusedSql.includes("drop table if exists public.attendance_logs") &&
    !unusedSql.includes("drop table if exists public.clock_locations"),
  "unused-table cleanup should keep attendance tables for the next feature"
);
assert(
  finalCleanupSql.includes("drop function if exists public.get_public_schedule_requests()") &&
    finalCleanupSql.includes("drop table if exists public.leave_requests cascade") &&
    finalCleanupSql.includes("drop table if exists public.overtime_requests cascade") &&
    finalCleanupSql.includes("drop type if exists public.request_status cascade") &&
    finalCleanupSql.includes("drop type if exists public.request_type cascade"),
  "final cleanup should remove legacy request RPC, tables, and types"
);

console.log("manager schedule entry cleanup and settings import/export checks passed");
