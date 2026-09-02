const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const { readRendererCore } = require("./renderer-core-source.js");

const index = read("src/renderer/index.html");
const renderer = readRendererCore(root);
const styles = read("src/renderer/app.css");
const webApi = read("src/renderer/web-api.js");
const schema = `${read("supabase/001_current_schema.sql")}\n${read("supabase/002_current_updates.sql")}`;

assert(index.includes('id="homeCard"'), "Home card is missing");
assert(index.includes('id="scheduleCard" hidden'), "Schedule card should start hidden");
assert(index.includes('id="mealCard"'), "Meal card is missing");
assert(index.includes('id="recordsCard"'), "Records card is missing");
assert(!index.includes('id="clockCard"'), "Standalone clock page should stay removed");
assert(index.includes('id="coreHomeButton"'), "Schedule home button is missing");

assert(renderer.includes("function renderHomeDashboard"), "Home dashboard renderer is missing");
assert(renderer.includes("function renderMealPage"), "Meal page renderer is missing");
assert(renderer.includes("function renderRecordsPage"), "Records page renderer is missing");
assert(renderer.includes("function loadRecordsPage"), "Records loader is missing");
assert(renderer.includes("function loadAttendanceReview"), "Attendance review loader is missing");
assert(renderer.includes("function canManagePermissions()"), "Permission-management capability helper is missing");
assert(renderer.includes("function canUseScheduleToolbar()"), "Schedule-toolbar capability helper is missing");
assert(renderer.includes("function hasFunctionMenuAccess()"), "Function-menu capability helper is missing");
assert(!renderer.includes("hasManagementAccess") && !renderer.includes("promptManagerAccess"), "Generic management capability guards must stay removed");
assert(renderer.includes('hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")'), "Schedule management must derive from current-group permission");
assert(renderer.includes('hasAnyGroupPermission("attendance_review")'), "Attendance review UI must derive from group permissions");
assert(renderer.includes('function canManageMembersInCurrentGroup()') && renderer.includes('hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")'), "Member settings UI must derive from schedule_manage on the current group");
assert(!renderer.includes("hasPermission(") && !renderer.includes("getAccessPermissions(") && !renderer.includes("roleAppliesToGroup("), "Renderer must not restore retired permission helpers");
assert(!renderer.includes("function renderTodayOvertimePanel"), "Retired overtime panel must stay removed");
assert(!renderer.includes("function renderAttendanceAdminSection"), "Retired attendance admin section must stay removed");
assert(!renderer.includes('data-home-action="clock"'), "Home must not expose retired clock route");
assert(renderer.includes('window.addEventListener("popstate", handleAppBackNavigation)'), "Back navigation handler is missing");
assert(renderer.includes("function hasClosableModal"), "Closable modal helper is missing");
assert(renderer.includes('toggle.textContent = "功能"'), "Schedule function menu label is missing");
assert(renderer.includes("home-password-btn"), "Home password action is missing");

assert(styles.includes("@media (max-width: 640px)"), "Mobile breakpoint is missing");
assert(styles.includes(".calendar-nav"), "Calendar navigation styles are missing");
assert(styles.includes(".nav-actions"), "Navigation action styles are missing");
assert(styles.includes("[hidden]"), "Hidden-state style is missing");

assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "Device-specific session windows are missing");
assert(webApi.includes("function assertSessionActive"), "Session idle guard is missing");
assert(webApi.includes('callRpc("get_scheduler_bootstrap_v3"'), "Web API must use canonical scheduler bootstrap RPC");
assert(webApi.includes('callRpcAllRows("get_schedule_entries_v3"'), "Web API must use exhaustive canonical schedule read RPC");
assert(webApi.includes('callRpc("save_schedule_entries_v3"'), "Web API must use canonical schedule write RPC");
assert(webApi.includes('callRpc("save_shift_v3"'), "Web API must use canonical shift save RPC");
assert(webApi.includes('callRpc("save_department_v3"'), "Web API must use canonical department save RPC");
assert(webApi.includes('callRpc("get_department_attendance_settings_v3"'), "Web API must use canonical attendance settings RPC");
assert(webApi.includes('requestFunction("member-auth-admin"'), "Web API must use canonical member admin Edge function");
assert(webApi.includes('requestFunction("attendance-ledger"'), "Web API must use canonical personal ledger Edge function");
assert(webApi.includes('requestFunction("attendance-review-groups"'), "Web API must use canonical review Edge function");
assert(webApi.includes('requestFunction("attendance-ledger-export"'), "Web API must use canonical attendance export Edge function");

for (const rpc of [
  "get_scheduler_bootstrap_v3",
  "get_schedule_entries_v3",
  "save_schedule_entries_v3",
  "save_shift_v3",
  "save_catalog_item_v3",
  "delete_catalog_item_v3",
  "save_department_v3",
  "delete_department_v3",
  "reorder_settings_v3",
  "save_scheduler_preferences_v3",
  "save_holidays_v3"
]) {
  assert(schema.toLowerCase().includes(`function public.${rpc}`), `Canonical SQL is missing ${rpc}`);
}

const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceReview = read("supabase/functions/attendance-review-groups/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const memberAdmin = read("supabase/functions/member-auth-admin/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");

assert(attendanceClock.includes('rpc("save_attendance_clock"'), "Clock endpoint must use the atomic clock RPC");
assert(attendanceClock.includes("attendance_days"), "Clock endpoint must use attendance_days");
assert(attendanceLedger.includes('body?.action === "personal_list"'), "Personal ledger must provide personal_list");
assert(attendanceLedger.includes('body?.action === "personal_save"'), "Personal ledger must provide personal_save");
for (const action of ["review_list", "review_save", "review_set", "history"]) {
  assert(!attendanceLedger.includes(`body?.action === "${action}"`), `Personal ledger must not duplicate review action: ${action}`);
  assert(attendanceReview.includes(`body?.action === "${action}"`), `Attendance review endpoint is missing action: ${action}`);
}
assert(attendanceReview.includes("attendance_review"), "Attendance review endpoint must validate attendance_review permission");
assert(attendanceExport.includes('hasAnyGroupPermission(ctx, actorId, "attendance_review")') && attendanceExport.includes('hasGroupPermission(ctx, actorId, groupId, "attendance_review")'), "Attendance export must validate permission and group scope through shared runtime helpers");
assert(memberAdmin.includes('SCHEDULE_MANAGE_PERMISSION = "schedule_manage"') && memberAdmin.includes('SETTINGS_PERMISSION = "settings"'), "Member admin must validate schedule_manage and settings permissions");
assert(!memberAdmin.includes('["manager", "admin"]') && !memberAdmin.includes('["admin", "manager"]'), "Member admin must not authorize from legacy role strings");
assert(mealOrder.includes("clock_in_location") && mealOrder.includes('rpc("save_meal_order"'), "Meal order must remain tied to clock-in snapshot and transaction RPC");

for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
  assert(!webApi.includes(helper), `Web API must not contain generic helper: ${helper}`);
}
for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays"]) {
  assert(!webApi.includes(`/rest/v1/${table}`), `Web API must not access ${table} directly`);
}

console.log("Renderer alignment checks passed.");
