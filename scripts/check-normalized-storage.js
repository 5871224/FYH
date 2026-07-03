const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const exporter = fs.readFileSync(path.join(rootDir, "src", "renderer", "browser-exporter.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");
const scheduleEntryRpcMigration = fs.readFileSync(path.join(rootDir, "supabase", "024_schedule_entries_rpc.sql"), "utf8");

assert(webApi.includes('restSelect("set_departments"'), "loadState should read set_departments table");
assert(webApi.includes('restSelect("set_employee"'), "loadState should read set_employee table");
assert(webApi.includes('restSelect("set_shift"'), "loadState should read set_shift table");
assert(webApi.includes('restSelect("set_leave"'), "loadState should read set_leave table");
assert(webApi.includes('restSelect("set_overtime"'), "loadState should read set_overtime table");
assert(webApi.includes('restSelect("schedule_entries"'), "loadState should read schedule_entries table");
assert(webApi.includes('restInsert("set_departments"'), "saveState should write set_departments table");
assert(webApi.includes('restRpc("save_schedule_entries_bulk"'), "schedule entry writes should use the bulk RPC");
assert(!webApi.includes('restSelect("schedule_months"') && !webApi.includes('restInsert("schedule_months"'), "web api should not use schedule_months");
assert(!webApi.includes("schedule_month_id"), "web api should not depend on schedule_month_id");
assert(webApi.includes("async function saveScheduleCell(payload)") && webApi.includes("shift_type_id: shiftType?.id || null"), "single cell edits should save shift, leave, and overtime together");
assert(webApi.includes("function makeScheduleEntryKey(memberId, workDate)"), "schedule entry cleanup should compare by member and work date");
assert(!webApi.includes("savedScheduleRows"), "schedule entry cleanup should not depend on upsert return rows");
assert(!webApi.includes('restInsert("schedule_documents"'), "saveState should not write schedule_documents JSON");
assert(!webApi.includes('restSelect("schedule_documents"'), "loadState should not read schedule_documents JSON");
assert(webApi.includes('parts.slice(0, -3).join("_")'), "schedule key parser should keep member ids containing underscores");
assert(!webApi.includes('deleteRowsByForeignIds("leave_requests"'), "web api should not write old leave_requests table");
assert(!webApi.includes('deleteRowsByForeignIds("overtime_requests"'), "web api should not write old overtime_requests table");
assert(webApi.includes('clearScheduleEntriesByForeignIds("leave_type_id"'), "deleting leave settings should clear schedule entry leave references before deleting leave types");
assert(webApi.includes('clearScheduleEntriesByForeignIds("overtime_type_id"'), "deleting overtime settings should clear schedule entry overtime references before deleting overtime types");
assert(!renderer.includes("merged.overtime = merged.overtime.length ? [merged.overtime[0]] : [];"), "overtime settings should keep every overtime type from storage");
assert(!renderer.includes("leaveRequestId") && !renderer.includes("overtimeRequestId"), "schedule state should not keep legacy request ids");
assert(
  !renderer.includes('data-open-leave-request="true"') &&
    !renderer.includes('data-open-overtime-request="true"') &&
    !renderer.includes("openLeaveRequestModal") &&
    !renderer.includes("openOvertimeRequestModal") &&
    !renderer.includes("openLeaveApprovalModal") &&
    !renderer.includes("openOvertimeApprovalModal"),
  "renderer should not keep removed request UI"
);
assert(
  !renderer.includes("refreshScheduleRequestsAfterInitialRender") &&
    !renderer.includes("syncManagerEntriesToSchedule") &&
    !renderer.includes("syncApprovedRequestsToSchedule"),
  "schedule should not run removed request overlay sync"
);
assert(
  !webApi.includes("async function createLeaveRequest") &&
    !webApi.includes("async function createOvertimeRequest") &&
    !webApi.includes("async function listLeaveRequests") &&
    !webApi.includes("async function listOvertimeRequests") &&
    !webApi.includes("async function listPublicScheduleRequests"),
  "web api should not expose removed request helpers"
);
assert(!webApi.includes("getOvertimeTypeByReference") && !webApi.includes("listOvertimeRequests"), "web api should not expose legacy request wrappers");
assert(!webApi.includes("requestLeaveCatalog"), "deleted leave settings should not be preserved by the removed request catalog");
assert(webApi.includes("function isLegacyRequestCatalogRow(row)") && webApi.includes("!isLegacyRequestCatalogRow(row)"), "legacy catalog leave rows should not load as active leave settings");
assert(webApi.includes("!String(id).startsWith(\"catalog:\")"), "legacy catalog leave ids should not be preserved during save");
assert(
  !exporter.includes("請假申請預覽") &&
    !exporter.includes("加班申請預覽") &&
    !exporter.includes("requestStyles"),
  "settings workbooks should not keep removed request preview sheets"
);

assert(schema.includes("create table if not exists public.scheduler_settings"), "schema should create scheduler_settings");
assert(schema.includes("create table if not exists public.schedule_entries"), "schema should create schedule_entries");
assert(!schema.includes("schedule_months"), "current schema should not create schedule_months");
assert(schema.includes("create table if not exists public.holidays"), "schema should create holidays");
assert(schema.includes("create table if not exists public.set_employee"), "schema should create set_employee");
assert(schema.includes("schedule_shift_ids text[]"), "schema should store ordered member shift priorities");
assert(!schema.includes("create table if not exists public.set_employee_departments"), "schema should not recreate member department priorities");
assert(!schema.includes("leave_requests") && !schema.includes("overtime_requests"), "current schema should not recreate legacy request tables");
assert(!schema.includes("request_status") && !schema.includes("request_type"), "current schema should not recreate legacy request types");
assert(scheduleEntryRpcMigration.includes("create or replace function public.save_schedule_entries_bulk(entries jsonb)"), "schedule entry RPC migration should create the bulk save function");
assert(scheduleEntryRpcMigration.includes("on conflict (member_id, work_date)"), "schedule entry RPC should upsert by member and work date");
assert(scheduleEntryRpcMigration.includes("grant execute on function public.save_schedule_entries_bulk(jsonb) to authenticated"), "schedule entry RPC should be executable by authenticated users");
assert(!schema.includes("schedule_documents"), "current schema should not recreate legacy JSON storage");

console.log("normalized storage checks passed");
