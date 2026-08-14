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
const apiContract = read("src/backend/api-contract.js");
const sessionStore = read("src/backend/session-store.js");
const attendance = read("src/backend/native-attendance.js");
const meal = read("src/backend/native-meal.js");
const memberService = read("src/backend/services/native-member-service.js");
const schema = `${read("supabase/001_current_schema.sql")}\n${read("supabase/002_current_updates.sql")}`;
const executableSql = schema.replace(/--.*$/gm, "");

// Renderer page structure and permission-derived UI.
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
assert(renderer.includes("function hasManagementAccess()"), "Management capability helper is missing");
assert(renderer.includes('hasPermission("schedule_manage")'), "Schedule management must derive from permissions");
assert(renderer.includes('hasPermission("attendance_review")'), "Attendance review UI must derive from permissions");
assert(renderer.includes('hasPermission("member_settings")'), "Member settings UI must derive from permissions");
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

// Browser transport is FYH API only. Session lifetime is a backend concern.
assert(!webApi.includes("callRpc("), "Renderer transport must not call Supabase RPC directly");
assert(!webApi.includes("requestFunction("), "Renderer transport must not call Supabase Edge Functions directly");
assert(!webApi.includes("/rest/v1/"), "Renderer transport must not call Supabase REST directly");
assert(webApi.includes('request(`/api/v1/schedule/bootstrap${qs({documentId})}`)'), "Schedule bootstrap must use FYH API");
assert(webApi.includes('request(`/api/v1/schedule/entries${qs({startDate,endDate,offset,limit:1000})}`)'), "Schedule reads must use paged FYH API");
assert(webApi.includes('request("/api/v1/schedule/entries",{method:"PUT"'), "Schedule writes must use FYH API");
assert(webApi.includes('request("/api/v1/settings/shift",{method:"PUT"'), "Shift save must use FYH API");
assert(webApi.includes('request("/api/v1/settings/department",{method:"PUT"'), "Department save must use FYH API");
assert(webApi.includes('request("/api/v1/attendance/department-settings")'), "Attendance settings must use FYH API");
assert(webApi.includes('request("/api/v1/members",{method:"PUT"'), "Member admin must use FYH API");
assert(webApi.includes('request("/api/v1/attendance/personal/list",{method:"POST"'), "Personal ledger must use FYH API");
assert(webApi.includes('request("/api/v1/attendance/review/list",{method:"POST"'), "Attendance review must use FYH API");
assert(webApi.includes('request("/api/v1/attendance/review/export",{method:"POST"'), "Attendance export must use FYH API");

assert(sessionStore.includes("PHONE_SESSION_IDLE_MS = 48 * 60 * 60 * 1000"), "Phone session idle window is missing from backend");
assert(sessionStore.includes("DESKTOP_SESSION_IDLE_MS = 30 * 60 * 1000"), "Desktop/tablet session idle window is missing from backend");
assert(sessionStore.includes("function getSessionIdleMs(deviceType)"), "Backend device-specific session policy is missing");

for (const route of [
  "scheduleBootstrap", "scheduleEntries", "scheduleEntriesSave",
  "departmentSave", "shiftSave", "attendanceDepartmentSettings",
  "attendancePersonalList", "attendanceReviewList", "attendanceExport",
  "memberSave", "mealToday"
]) {
  assert(apiContract.includes(`${route}: Object.freeze(`), `FYH API contract is missing ${route}`);
}

// Native backend owns domain behavior and transaction boundaries.
assert(attendance.includes("public.attendance_days"), "Attendance backend must use attendance_days");
assert(attendance.includes("public.attendance_audit_logs"), "Attendance backend must use audit logs");
assert(attendance.includes("database.transaction(async(tx)=>"), "Clock mutation must use a native backend transaction");
assert(attendance.includes("for update"), "Clock mutation must lock its daily row");
assert(!attendance.includes("public.save_attendance_clock"), "Attendance backend must not call the legacy clock RPC");
assert(attendance.includes("attendance_review"), "Attendance backend must validate review permission");
assert(memberService.includes("memberRepository.saveMember"), "Member service must use native repository");
assert(memberService.includes("memberRepository.resetPassword"), "Member password reset must use native repository");
assert(memberService.includes("memberRepository.deleteMember"), "Member delete must use native repository");
assert(meal.includes("database.transaction(async(tx)=>"), "Meal mutation must use a native backend transaction");
assert(meal.includes("delete from public.meal_orders"), "Meal save must replace daily rows inside its transaction");
assert(!meal.includes("public.save_meal_order"), "Meal backend must not call the legacy order RPC");
assert(meal.includes("public.attendance_days"), "Meal backend must use current attendance model");

// Canonical SQL is portable PostgreSQL and must not restore Supabase application APIs.
for (const pattern of [
  /auth\.uid\s*\(/i,
  /auth\.role\s*\(/i,
  /create\s+policy/i,
  /enable\s+row\s+level\s+security/i,
  /\bservice_role\b/i,
  /\bauthenticated\b/i,
  /\banon\b/i,
  /get_scheduler_bootstrap_v3/i,
  /save_schedule_entries_v3/i
]) {
  assert(!pattern.test(executableSql), `Canonical SQL must remain portable: ${pattern}`);
}
assert(schema.includes("create or replace function public.is_schedule_date_archived"), "Archive integrity helper is missing");
assert(schema.includes("create or replace function public.protect_archived_schedule_v1"), "Archive protection helper is missing");
assert(!fs.existsSync(path.join(root, "supabase", "functions")), "Supabase Edge Function source must remain removed");

for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
  assert(!webApi.includes(helper), `Web API must not contain generic helper: ${helper}`);
}

console.log("Renderer alignment checks passed for FYH backend architecture.");
