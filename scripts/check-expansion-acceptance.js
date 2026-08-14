const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), "utf8");

const schema = read("supabase", "001_current_schema.sql") + "\n" + read("supabase", "002_current_updates.sql");
const index = read("src", "renderer", "index.html");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const styles = read("src", "renderer", "app.css");
const webApi = read("src", "renderer", "web-api.js");
const pageData = read("src", "renderer", "renderer-page-data.js");
const apiContract = read("src", "backend", "api-contract.js");
const sessionStore = read("src", "backend", "session-store.js");
const attendance = read("src", "backend", "native-attendance.js");
const meal = read("src", "backend", "native-meal.js");
const memberService = read("src", "backend", "services", "native-member-service.js");

// Canonical storage remains normalized. Database-side helper functions are allowed only as
// backend implementation details until the dedicated Supabase residual-cleanup phase.
assert(schema.includes("create table if not exists public.meal_orders"), "database should include meal orders");
assert(schema.includes("create policy read_schedule_entries"), "database should retain RLS as defense in depth");
assert(schema.includes("access_role_id") && schema.includes("access_roles") && schema.includes("access_role_groups"), "database should use role ids, permissions, and applicable groups");
assert(schema.toLowerCase().includes("function public.get_scheduler_bootstrap_v3"), "schedule bootstrap residual may remain until Supabase cleanup");
assert(schema.toLowerCase().includes("function public.save_schedule_entries_v3"), "schedule write residual may remain until Supabase cleanup");
assert(schema.includes("revoke all privileges on table public.set_employee from anon,authenticated;"), "browser roles should not receive direct employee table privileges");

// FYH API is the only browser/server contract.
for (const route of [
  "scheduleBootstrap", "scheduleEntries", "scheduleEntriesSave",
  "attendanceDepartmentSettings", "attendanceToday", "attendanceClock",
  "attendancePersonalList", "attendancePersonalSave", "attendanceReviewList",
  "attendanceCommonNotes", "attendanceReviewSave", "attendanceReviewSet",
  "attendanceHistory", "attendanceExport",
  "mealToday", "mealSave", "mealCancel", "mealAdminSettings", "mealAdminSettingsSave", "mealProductDelete", "mealReport",
  "membersDirectory", "memberSave", "memberGroupChangeValidate", "memberPasswordReset", "memberDelete"
]) {
  assert(apiContract.includes(`${route}: Object.freeze(`), `FYH API contract should expose ${route}`);
}
assert(!webApi.includes("callRpc("), "browser must not call Supabase RPC directly");
assert(!webApi.includes("requestFunction("), "browser must not call Supabase Edge Functions directly");
assert(!webApi.includes("/rest/v1/"), "browser must not access Supabase REST tables directly");
assert(webApi.includes('request(`/api/v1/schedule/bootstrap${qs({documentId})}`)'), "schedule bootstrap should use FYH API");
assert(webApi.includes('request("/api/v1/attendance/clock",{method:"POST"'), "clocking should use FYH API");
assert(webApi.includes('request("/api/v1/attendance/personal/list",{method:"POST"'), "personal attendance should use FYH API");
assert(webApi.includes('request("/api/v1/attendance/review/list",{method:"POST"'), "attendance review should use FYH API");
assert(webApi.includes('request("/api/v1/attendance/review/export",{method:"POST"'), "attendance export should use FYH API");
assert(webApi.includes('request("/api/v1/meal/today",{method:"PUT"'), "meal ordering should use FYH API");
assert(webApi.includes('request("/api/v1/members",{method:"PUT"'), "member administration should use FYH API");

// Authentication/session lifetime is enforced by the backend rather than duplicated in browser code.
assert(sessionStore.includes("PHONE_SESSION_IDLE_MS = 48 * 60 * 60 * 1000"), "phone sessions should retain the configured idle window");
assert(sessionStore.includes("DESKTOP_SESSION_IDLE_MS = 30 * 60 * 1000"), "desktop/tablet sessions should retain the configured idle window");
assert(sessionStore.includes("function getSessionIdleMs(deviceType)"), "backend should derive idle timeout from device type");
assert(sessionStore.includes("record.expiresAt = currentTime + getSessionIdleMs(record.deviceType)"), "backend session touch should extend the correct idle window");

// Core permission-derived UI and page lifecycle contracts.
assert(renderer.includes("function canManagePermissions()") && renderer.includes("function canEditMemberAccount"), "UI should expose permission-derived capabilities");
assert(renderer.includes('hasPermission("permission_settings")'), "administrator UI capability should derive from permission_settings");
assert(renderer.includes('hasPermission("schedule_manage")'), "schedule editing should derive from schedule_manage");
assert(index.includes('id="homeCard"') && renderer.includes("function renderHomeDashboard"), "login should land on the home dashboard");
assert(index.includes('id="scheduleCard" hidden'), "schedule table should be hidden until the schedule page is opened");
assert(pageData.includes("async function initializeAuthenticatedHome") && pageData.includes("async function ensureScheduleApplicationLoaded"), "home and schedule loading should use the canonical page-data lifecycle");
assert(!pageData.includes("stopImmediatePropagation") && !/schedulerApi\.[A-Za-z0-9_]+\s*=/.test(pageData), "page loading must not use interception or runtime API patches");
assert(renderer.includes('window.addEventListener("popstate", handleAppBackNavigation)') && renderer.includes("function hasClosableModal") && renderer.includes('appView = "home";'), "Android back should close modal first, then return home");
assert(renderer.includes('[hidden]') || styles.includes("[hidden]"), "hidden sections should stay hidden on mobile");
assert(styles.includes("@media (max-width: 640px)") && styles.includes(".calendar-nav {\n    flex-wrap: wrap;") && styles.includes(".nav-actions {\n    justify-content: flex-start;"), "mobile schedule navigation should wrap instead of forcing one row");
assert(renderer.includes('toggle.textContent = "功能"'), "schedule top-right menu should be labelled function");
assert(index.includes('id="coreHomeButton"') && !index.includes('data-home-action="home">首頁</button>\n              <button'), "schedule home button should sit outside the function menu");
assert(renderer.includes("home-password-btn") && !index.includes('data-open-change-password="true">修改密碼</button>'), "change password should live on the home dashboard");
assert(renderer.includes("const showToolbar = showSchedule && hasManagementAccess()"), "schedule floating toolbar should respect derived management capability");

assert(!index.includes('id="clockCard"'), "standalone clock page should be removed");
assert(!renderer.includes('data-home-action="clock"'), "home dashboard should not expose a clock page button");
assert(renderer.includes('<span class="home-action-title">簽到簿</span>'), "records entry should be named attendance ledger");
assert(renderer.includes('aria-label="簽到簿分頁"'), "records tabs should use the attendance ledger name");
assert(renderer.includes('hasPermission("attendance_review")'), "attendance review tab should derive from attendance_review permission");
assert(!renderer.includes("renderTodayOvertimePanel"), "standalone overtime request panel should be removed");
assert(!renderer.includes("renderAttendanceAdminSection"), "standalone attendance admin tab should be removed");

// Attendance domain is fully owned by FYH backend, including the clock transaction.
assert(attendance.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendance.includes("MAX_GPS_ACCURACY_METERS = 300"), "clocking should reject low-accuracy GPS fixes");
assert(webApi.includes('deviceType:/Mobi|Mobile|iPhone|Android/i.test(navigator.userAgent||"")?"phone":"desktop"'), "clocking should distinguish phone GPS from desktop IP");
assert(renderer.includes("timeout: 15000") && renderer.includes("maximumAge: 0"), "phone GPS clocking should wait for a fresh high-accuracy location");
assert(attendance.includes("public.attendance_days"), "attendance backend should use daily records");
assert(attendance.includes("public.attendance_audit_logs"), "attendance backend should retain audit history");
assert(attendance.includes("database.transaction(async(tx)=>"), "clocking should use a native backend transaction");
assert(attendance.includes("for update"), "clocking should lock the daily attendance row");
assert(attendance.includes("await audit(tx,old.id,kind,a.id,old,row)"), "clocking should write audit history in the same transaction");
assert(!attendance.includes("public.save_attendance_clock"), "clocking must not call the legacy database RPC");
assert(attendance.includes("'clock_in','clock_out'"), "clocking should support clock in and out");
assert(attendance.includes("工時必須以 0.5 小時為單位"), "regular and overtime hours should use half-hour increments");
assert(attendance.includes("attendance_review"), "attendance review should validate explicit permission");
assert(attendance.includes("access_role_groups"), "attendance review should enforce applicable group scope");
assert(!attendance.includes("attendance_records"), "attendance backend should not retain the retired attendance table");

// Member administration is native FYH service/repository work, not an Edge Function contract.
assert(memberService.includes("accessRoleId") && memberService.includes("groupId"), "member service should normalize role and group ids");
assert(memberService.includes("memberRepository.saveMember"), "member mutations should go through the native repository");
assert(memberService.includes("memberRepository.resetPassword"), "password reset should go through the native repository");
assert(memberService.includes("memberRepository.deleteMember"), "member deletion should go through the native repository");
assert(memberService.includes("verifySelfPassword"), "self deletion should retain password verification");

// Meal domain is fully owned by FYH backend, including order replacement as one transaction.
assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(renderer.includes('data-meal-tab="stats"') && renderer.includes("renderMealReportSection()"), "meal stats should live on the meal page");
assert(renderer.includes('<table class="meal-order-table">'), "today meal order should render as a table");
assert(renderer.includes("data-meal-product-row") && renderer.includes("commitMealProductOrderFromDom"), "meal settings should support drag ordering");
assert(meal.includes("database.transaction(async(tx)=>"), "meal ordering should use a native backend transaction");
assert(meal.includes("delete from public.meal_orders"), "meal save should replace the current daily order atomically");
assert(!meal.includes("public.save_meal_order"), "meal ordering must not call the legacy database RPC");
assert(meal.includes("public.attendance_days") && meal.includes("clock_in_location?.departmentId"), "meal ordering should require the clock-in location snapshot");
assert(meal.includes('actor(employeeId,"meal_admin")'), "meal administration should require explicit permission");
assert(meal.includes("access_role_groups"), "meal reports should enforce applicable group scope");
assert(renderer.includes("data-meal-note-product-id"), "meal ordering should support per-item notes");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "attendance ledger page should be present");
assert(renderer.includes("function loadRecordsPage") && renderer.includes("function loadAttendanceReview"), "attendance ledger should load personal and permitted review data");
assert(!webApi.includes('personal-records-v2'), "frontend should not call the retired personal records endpoint");

for (const generic of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
  assert(!webApi.includes(generic), `frontend should not retain generic data access: ${generic}`);
}

console.log("expansion acceptance checks passed for FYH backend architecture");
