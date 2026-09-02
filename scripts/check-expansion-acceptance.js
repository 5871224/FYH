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
const attendanceClock = read("supabase", "functions", "attendance-clock", "index.ts");
const attendanceLedger = read("supabase", "functions", "attendance-ledger", "index.ts");
const attendanceReview = read("supabase", "functions", "attendance-review-groups", "index.ts");
const attendanceLedgerExport = read("supabase", "functions", "attendance-ledger-export", "index.ts");
const memberAdmin = read("supabase", "functions", "member-auth-admin", "index.ts");
const mealOrder = read("supabase", "functions", "meal-order", "index.ts");
const deployScript = read("scripts", "deploy-edge-functions.ps1");

assert(schema.includes("create table if not exists public.meal_orders"), "database should include meal orders");
assert(schema.includes("create policy read_schedule_entries"), "database should retain RLS as defense in depth");
assert(schema.includes("access_role_id") && schema.includes("access_roles") && schema.includes("access_role_group_permissions") && schema.includes("common_permissions"), "database should use role ids plus common and group permissions");
assert(schema.toLowerCase().includes("function public.get_scheduler_bootstrap_v3"), "database should expose the canonical schedule bootstrap API");
assert(schema.toLowerCase().includes("function public.save_schedule_entries_v3"), "database should expose the canonical schedule write API");
assert(schema.includes("revoke all privileges on table public.set_employee from anon,authenticated;"), "browser roles should not receive direct employee table privileges");

assert(renderer.includes("function canManagePermissions()") && renderer.includes("function canEditMemberAccount"), "UI should expose permission-derived capabilities");
assert(renderer.includes('hasCommonPermission("settings")'), "administrator UI capability should derive from common settings permission");
assert(renderer.includes('hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")'), "schedule editing should derive from schedule_manage on the current group");
assert(!renderer.includes("hasPermission(") && !renderer.includes("getAccessPermissions(") && !renderer.includes("roleAppliesToGroup("), "UI should not restore retired permission helpers");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "login should have device-specific idle windows");
assert(webApi.includes("function assertSessionActive"), "authenticated requests should enforce idle timeout");
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
assert(renderer.includes("const showToolbar = showSchedule && canUseScheduleToolbar()"), "schedule floating toolbar should respect its exact schedule/leave capability");
assert(!renderer.includes("hasManagementAccess") && !renderer.includes("promptManagerAccess"), "UI must not restore generic management capability guards");

assert(!index.includes('id="clockCard"'), "standalone clock page should be removed");
assert(!renderer.includes('data-home-action="clock"'), "home dashboard should not expose a clock page button");
assert(renderer.includes('<span class="home-action-title">簽到簿</span>'), "records entry should be named attendance ledger");
assert(renderer.includes('aria-label="簽到簿分頁"'), "records tabs should use the attendance ledger name");
assert(renderer.includes('hasAnyGroupPermission("attendance_review")'), "attendance review tab should derive from attendance_review group permission");
assert(!renderer.includes("renderTodayOvertimePanel"), "standalone overtime request panel should be removed");
assert(!renderer.includes("renderAttendanceAdminSection"), "standalone attendance admin tab should be removed");

assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendanceClock.includes("deviceType") && webApi.includes('deviceType: isPhoneDevice() ? "phone" : "desktop"'), "clocking should distinguish phone GPS from desktop IP");
assert(renderer.includes("timeout: 15000") && renderer.includes("maximumAge: 0"), "phone GPS clocking should wait for a fresh high-accuracy location");
assert(attendanceClock.includes('.from("attendance_days")'), "clocking should read the daily attendance model");
assert(attendanceClock.includes('rpc("save_attendance_clock"') && attendanceClock.includes('body?.action === "clock_in"') && attendanceClock.includes('body?.action === "clock_out"'), "clocking should call the atomic clock RPC for clock in and out");
assert(!attendanceClock.includes("attendance_records"), "clocking should not retain the retired attendance table");

for (const action of ["personal_list", "personal_save"]) {
  assert(attendanceLedger.includes(`body?.action === "${action}"`), `personal attendance ledger should support ${action}`);
}
for (const action of ["review_list", "review_save", "review_set", "history"]) {
  assert(!attendanceLedger.includes(`body?.action === "${action}"`), `personal attendance ledger should not duplicate ${action}`);
  assert(attendanceReview.includes(`body?.action === "${action}"`), `group-scoped attendance review should support ${action}`);
}
assert(attendanceLedger.includes('.from("attendance_days")'), "attendance ledger should use daily records");
assert(attendanceLedger.includes('.from("attendance_audit_logs")'), "attendance ledger should retain audit history");
assert(attendanceLedger.includes("工時必須以 0.5 小時為單位"), "regular and overtime hours should use half-hour increments");
assert(attendanceLedger.includes("if (old.reviewed_at)") && attendanceLedger.includes("此日簽到紀錄已審，無法修改"), "reviewed personal attendance records should be immutable");
assert(attendanceReview.includes("attendance_review") && attendanceReview.includes("hasAnyGroupPermission") && attendanceReview.includes("hasGroupPermission"), "attendance review should validate attendance_review and concrete group scope");
assert(attendanceLedgerExport.includes('.not("reviewed_at", "is", null)'), "attendance export should include reviewed records only");
assert(attendanceLedgerExport.includes('hasAnyGroupPermission(ctx, actorId, "attendance_review")') && attendanceLedgerExport.includes('hasGroupPermission(ctx, actorId, groupId, "attendance_review")'), "attendance export should enforce review permission and group scope through shared runtime helpers");
assert(webApi.includes('requestFunction("attendance-ledger"') && webApi.includes('requestFunction("attendance-review-groups"') && webApi.includes('requestFunction("attendance-ledger-export"'), "frontend should use the canonical attendance endpoints");

assert(memberAdmin.includes('SCHEDULE_MANAGE_PERMISSION = "schedule_manage"') && memberAdmin.includes('SETTINGS_PERMISSION = "settings"'), "member account administration should validate schedule_manage and settings permissions");
assert(memberAdmin.includes("accessRoleId") && memberAdmin.includes("access_role_group_permissions"), "member account administration should validate the chosen access role against group permissions");
assert(!memberAdmin.includes("member_settings") && !memberAdmin.includes("permission_settings"), "member administration should not retain retired permission names");
assert(!memberAdmin.includes('["manager", "admin"]') && !memberAdmin.includes('["admin", "manager"]'), "member administration should not authorize from legacy role strings");

assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(renderer.includes('data-meal-tab="stats"') && renderer.includes("renderMealReportSection()"), "meal stats should live on the meal page");
assert(renderer.includes('<table class="meal-order-table">'), "today meal order should render as a table");
assert(renderer.includes("data-meal-product-row") && renderer.includes("commitMealProductOrderFromDom"), "meal settings should support drag ordering");
assert(mealOrder.includes('rpc("save_meal_order"') && !mealOrder.includes("save_meal_order_v2"), "meal ordering should call only the canonical transaction RPC");
assert(mealOrder.includes('.from("attendance_days")') && mealOrder.includes("clock_in_location?.departmentId"), "meal ordering should use the new clock-in location snapshot");
assert(renderer.includes("data-meal-note-product-id"), "meal ordering should support per-item notes");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "attendance ledger page should be present");
assert(renderer.includes("function loadRecordsPage") && renderer.includes("function loadAttendanceReview"), "attendance ledger should load personal and permitted review data");
assert(!webApi.includes('requestFunction("personal-records-v2"'), "frontend should not call the retired personal records endpoint");

for (const name of ["access-control", "member-auth-admin", "attendance-clock", "attendance-ledger", "attendance-review-groups", "attendance-ledger-export", "meal-order"]) {
  assert(deployScript.includes(`"${name}"`), `deployment list should include ${name}`);
}
for (const oldName of ["catalog-admin", "member-delete-v2", "member-order-v2", "department-attendance-v2", "attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
  assert(!deployScript.includes(oldName), `deployment list should not include ${oldName}`);
}

for (const generic of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
  assert(!webApi.includes(generic), `frontend should not retain generic data access: ${generic}`);
}

console.log("expansion acceptance checks passed");
