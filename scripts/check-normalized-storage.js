const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const exporter = fs.readFileSync(path.join(rootDir, "src", "renderer", "browser-exporter.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");
const databaseUpdates = fs.readFileSync(path.join(rootDir, "supabase", "002_current_updates.sql"), "utf8");

assert(webApi.includes('restRpc("get_department_directory_v2"'), "loadState should use the safe department directory RPC");
assert(webApi.includes('restRpc("get_my_profile_v2"'), "auth should use the self profile RPC");
assert(webApi.includes('restRpc("get_schedule_directory_v2"'), "schedule should use the shared operational directory RPC");
assert(webApi.includes('restRpc("get_employee_admin_directory_v2"'), "member settings should use the manager directory RPC");
assert(!webApi.includes("get_employee_directory_v2"), "web api should not use the retired mixed-purpose employee directory RPC");
assert(webApi.includes('restSelect("set_shift"'), "loadState should read set_shift table");
assert(webApi.includes('restSelect("set_leave"'), "loadState should read set_leave table");
assert(webApi.includes('restSelect("set_overtime"'), "loadState should read set_overtime table");
assert(webApi.includes('restSelect("schedule_entries"'), "loadState should read schedule_entries table");
assert(webApi.includes("filters: getScheduleEntryFilters(scheduleRange)"), "loadState should only read the buffered visible schedule range");
assert(webApi.includes('restRpc("save_departments_general_v2"'), "saveState should write departments through the protected RPC");
assert(webApi.includes('restRpc("save_schedule_entries_bulk"'), "schedule entry writes should use the bulk RPC");
assert(webApi.includes("fetchExistingScheduleRowsForRanges(state.scheduleLoadedRanges)"), "saveState cleanup should only compare loaded schedule ranges");
assert(!webApi.includes('restSelect("schedule_months"') && !webApi.includes('restInsert("schedule_months"'), "web api should not use schedule_months");
assert(!webApi.includes("schedule_month_id"), "web api should not depend on schedule_month_id");
assert(webApi.includes("async function saveScheduleCell(payload)") && webApi.includes("shift_type_id: shiftType?.id || null"), "single cell edits should save shift, leave, and overtime together");
assert(webApi.includes("function makeScheduleEntryKey(memberId, workDate)"), "schedule entry cleanup should compare by member and work date");
assert(!webApi.includes("savedScheduleRows"), "schedule entry cleanup should not depend on upsert return rows");
assert(!webApi.includes('restInsert("schedule_documents"'), "saveState should not write schedule_documents JSON");
assert(!webApi.includes('restSelect("schedule_documents"'), "loadState should not read schedule_documents JSON");
assert(webApi.includes('parts.slice(0, -3).join("_")'), "schedule key parser should keep member ids containing underscores");
assert(webApi.includes('clearScheduleEntriesByForeignIds("leave_type_id"'), "deleting leave settings should clear schedule entry leave references before deleting leave types");
assert(webApi.includes('clearScheduleEntriesByForeignIds("overtime_type_id"'), "deleting overtime settings should clear schedule entry overtime references before deleting overtime types");
assert(webApi.includes("async function fetchRowsById") && webApi.includes("async function fetchRowById"), "catalog settings should resolve rows by uuid id");
assert(webApi.includes("requiresTime: Boolean(row.requires_time)") && webApi.includes("requiresReason: Boolean(row.requires_reason)"), "leave catalog naming should match requires_time and requires_reason");
assert(!webApi.includes("defaultAllDay: Boolean(row.requires_time)") && !webApi.includes("requireReason: Boolean(row.requires_reason)"), "web api should not keep the old leave catalog names");
assert(renderer.includes("item.requiresTime") && renderer.includes("item.requiresReason"), "renderer should use consistent leave catalog naming");
assert(!webApi.includes("fetchSchedulerRowByItemId") && !webApi.includes("deleteSchedulerRowsNotIn"), "web api should not depend on scheduler_item_id helpers");
assert(!webApi.includes("login_email_by_employee_code"), "login should derive the auth email from employee code without a database login_email RPC");
assert(!schema.includes("login_email"), "set_employee should not store login_email");
assert(!renderer.includes("merged.overtime = merged.overtime.length ? [merged.overtime[0]] : [];"), "overtime settings should keep every overtime type from storage");
assert(!webApi.includes("migrateLegacyTabletSession"), "web api should not keep legacy tablet session migration");
assert(!renderer.includes("LEGACY_LEAVE_NAME_MAP") && !renderer.includes("resolveLeaveCatalogEntry"), "renderer should not keep legacy leave-name or index inference");
assert(!renderer.includes("clearLegacyLeaveFromSlot") && !renderer.includes("clearLegacyOvertimeFromSlot"), "renderer should use current schedule-clear naming");
assert(!renderer.includes("function getRemainingDailyShiftDemand(") && !renderer.includes("function isValidDateTimeRange("), "renderer should not keep test-only helper wrappers");
assert(!renderer.includes("function getWeekStripeClass(") && !renderer.includes("function getWeekBoundaryClass("), "renderer should not keep retired month-based week helpers");
assert(!renderer.includes("function getPositionName(") && !renderer.includes("function formatMonthText(") && !renderer.includes("function formatWeekStartLabel("), "renderer should not keep unused display helpers");
assert(!renderer.includes("function sanitizeNamedColorItem(") && !renderer.includes("function isDepartmentActiveInMonth(") && !renderer.includes("function isMemberActiveInMonth("), "renderer should not keep unused normalization or month helpers");
assert(!fs.readFileSync(path.join(rootDir, "src", "renderer", "rest-compliance.js"), "utf8").includes("module.exports"), "browser source should not expose CommonJS solely for tests");
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
assert(!webApi.includes("isLegacyRequestCatalogRow") && !webApi.includes('startsWith("catalog:")'), "web api should not keep retired request catalog compatibility code");
assert(
  !renderer.includes("getRequestActor") &&
    !renderer.includes("requestMatchesMember") &&
    !renderer.includes("hasDateRangeOverlap") &&
    !renderer.includes("findDirectLeaveScheduleConflict") &&
    !renderer.includes("hasDirectOvertimeScheduleConflict") &&
    !renderer.includes("formatRequestDateText") &&
    !renderer.includes("formatOvertimeTimeText") &&
    !renderer.includes("formatOvertimeRestLines") &&
    !renderer.includes("getLeaveStyleForRecord") &&
    !renderer.includes("getLeaveStyleForSlot") &&
    !renderer.includes("cleanSlotMeta") &&
    !renderer.includes("cancelLeaveRequestIds"),
  "renderer should not keep retired schedule request helper names"
);
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
const setEmployeeSchema = schema.slice(schema.indexOf("create table if not exists public.set_employee"), schema.indexOf("create table if not exists public.set_shift"));
assert(!setEmployeeSchema.includes("is_active"), "set_employee should not keep an is_active column");
assert(schema.includes("role in ('admin', 'manager', 'employee')"), "employee roles should include admin");
assert(!schema.includes("alter column role type text using role::text"), "current schema should not keep legacy role enum conversion");
assert(schema.includes("schedule_shift_ids uuid[]"), "schema should store ordered member shift priorities as uuid ids");
assert(schema.includes("applicable_department_id uuid not null"), "schema should store one required shift department id");
assert(!schema.includes("applicable_department_ids uuid[]"), "schema should not keep shift department applicability arrays");
assert(schema.includes("auto_text_color boolean not null default true"), "schema should store catalog auto text color flags");
assert(schema.includes("requires_time boolean not null default false"), "schema should store leave time requirement flags");
assert(schema.includes("requires_reason boolean not null default false"), "schema should store leave reason requirement flags");
assert(schema.includes("hidden_from_schedule") && !schema.includes("hidden_from_leave"), "department hidden flag should be schedule-named");
assert(schema.includes("address text") && schema.includes("attendance_enabled boolean not null default false"), "departments should store attendance location settings");
assert(schema.includes("create table if not exists public.attendance_days"), "schema should create daily attendance rows");
assert(schema.includes("create table if not exists public.attendance_audit_logs"), "schema should create attendance audit logs");
assert(schema.includes("regular_minutes smallint") && schema.includes("overtime_minutes smallint"), "attendance days should store half-hour work totals");
assert(!schema.includes("attendance_records") && !schema.includes("attendance_action_logs"), "schema should not create retired attendance tables");
assert(!schema.includes("attendance_overtime_requests") && !schema.includes("overtime_review_logs"), "schema should not create retired overtime review tables");
assert(schema.includes("create table if not exists public.meal_products"), "schema should create meal products");
assert(schema.includes("create table if not exists public.meal_settings"), "schema should create meal settings");
assert(schema.includes("create table if not exists public.meal_orders"), "schema should create meal order item rows");
assert(schema.includes("attendance_department_id uuid references public.set_departments"), "meal orders should use the canonical attendance department field");
assert(!schema.includes("clock_location_id") && !schema.includes("display_name text"), "current schema should not keep compatibility-only meal or leave fields");
assert(schema.includes("code text not null unique"), "leave codes should be required and unique");
assert(!databaseUpdates.includes("create or replace function public.save_meal_order_v2"), "updates should not recreate the old meal wrapper RPC");
assert(!databaseUpdates.includes("set_schedule_documents_updated_at() from") && !databaseUpdates.includes("alter function public.set_schedule_documents_updated_at"), "updates should not manage an orphaned legacy trigger function");
assert(schema.includes("unique (user_id, work_date)"), "attendance and overtime should be unique by user/date where required");
assert(schema.includes("unique (user_id, order_date, product_id)"), "meal orders should be unique by user/date/product");
assert(schema.includes("create or replace function public.is_admin(p_user_id uuid)"), "schema should expose an admin helper");
assert(schema.includes("create or replace function public.get_my_profile_v2()") && schema.includes("create or replace function public.get_schedule_directory_v2()") && schema.includes("create or replace function public.get_employee_admin_directory_v2()"), "current schema should create separated employee data RPCs");
assert(schema.includes("alter table public.meal_orders enable row level security"), "new meal tables should have RLS enabled");
assert(schema.includes("create policy read_schedule_entries") && schema.includes("create policy read_meal_orders"), "current schema should create RLS policies");
assert(schema.includes("drop policy if exists v2_restrict_employee_directory") && schema.includes("drop policy if exists v2_restrict_schedule_visibility"), "schema should remove old employee-only schedule visibility policies");
assert(schema.includes("create or replace function public.protect_admin_member"), "current schema should protect the last admin at database level");
assert(schema.includes("create or replace function public.save_attendance_clock"), "current schema should create the atomic clock RPC");
assert(schema.includes("create or replace function public.save_meal_order"), "current schema should create the meal transaction RPC");
assert(!schema.includes("and clock_in_at is not null\n      and clock_out_at is null"), "clock-out should not require a clock-in record");
assert(schema.includes("訂餐數量必須是 0 或正整數"), "meal order RPC should reject invalid quantities instead of rounding them");
assert(!schema.includes("create table if not exists public.clock_locations"), "current schema should not create retired clock_locations");
assert(!schema.includes("create table if not exists public.attendance_logs"), "current schema should not create retired attendance_logs");
assert(!schema.includes("scheduler_item_id text unique"), "active catalog tables should not keep scheduler_item_id");
assert(!schema.includes("create table if not exists public.set_employee_departments"), "schema should not recreate member department priorities");
assert(!schema.includes("create table if not exists public.leave_requests") && !schema.includes("create table if not exists public.overtime_requests"), "current schema should not recreate legacy request tables");
assert(!schema.includes("request_status") && !schema.includes("request_type"), "current schema should not recreate legacy request types");
assert(databaseUpdates.includes("create or replace function public.save_schedule_entries_bulk(entries jsonb)"), "schedule entry RPC migration should create the bulk save function");
assert(databaseUpdates.includes("on conflict (member_id, work_date)"), "schedule entry RPC should upsert by member and work date");
assert(databaseUpdates.includes("grant execute on function public.save_schedule_entries_bulk(jsonb) to authenticated"), "schedule entry RPC should be executable by authenticated users");
assert(!schema.includes("schedule_documents"), "current schema should not recreate legacy JSON storage");

assert(!fs.existsSync(path.join(rootDir, "supabase", "functions", "attendance-clock-safe")), "retired attendance-clock-safe endpoint still exists");
assert(!fs.existsSync(path.join(rootDir, "supabase", "functions", "report-records")), "retired report-records endpoint still exists");

const retiredTableNames = ["manager_departments", "schedule_documents", "schedule_months"];
const retiredReferenceRoots = [
  path.join(rootDir, "src"),
  path.join(rootDir, "docs"),
  path.join(rootDir, "supabase", "functions")
];
const retiredReferenceExtensions = new Set([".js", ".ts", ".html"]);
const retiredTableReferences = [];

function scanRetiredTableReferences(targetPath) {
  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      scanRetiredTableReferences(path.join(targetPath, entry));
    }
    return;
  }
  if (!retiredReferenceExtensions.has(path.extname(targetPath))) return;
  const content = fs.readFileSync(targetPath, "utf8");
  for (const tableName of retiredTableNames) {
    if (content.includes(tableName)) {
      retiredTableReferences.push(`${path.relative(rootDir, targetPath)} -> ${tableName}`);
    }
  }
}

for (const targetPath of retiredReferenceRoots) scanRetiredTableReferences(targetPath);
assert.equal(
  retiredTableReferences.length,
  0,
  `Retired Supabase tables are still referenced:\n${retiredTableReferences.join("\n")}`
);

console.log("normalized storage checks passed");

assert(!fs.existsSync(path.join(rootDir, "supabase", "003_attendance_ledger.sql")), "canonical schema should not keep a third attendance migration file");
assert(!fs.existsSync(path.join(rootDir, "supabase", "004_remove_legacy_attendance.sql")), "canonical schema should not keep a legacy cleanup file");
assert(!webApi.includes("approvedOvertimeRows"), "attendance export should use the canonical exportRows contract");
assert(!fs.existsSync(path.join(rootDir, "src", "renderer", "renderer-period-exports.js")), "period export runtime override module still exists");
