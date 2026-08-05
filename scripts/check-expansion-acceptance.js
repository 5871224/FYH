const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), "utf8");

const schema = read("supabase", "001_current_schema.sql");
const index = read("src", "renderer", "index.html");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const styles = read("src", "renderer", "app.css");
const webApi = read("src", "renderer", "web-api.js");
const attendanceClock = read("supabase", "functions", "attendance-clock", "index.ts");
const attendanceLedger = read("supabase", "functions", "attendance-ledger", "index.ts");
const attendanceLedgerExport = read("supabase", "functions", "attendance-ledger-export", "index.ts");
const mealOrder = read("supabase", "functions", "meal-order", "index.ts");
const deployScript = read("scripts", "deploy-edge-functions.ps1");

assert(schema.includes("role in ('admin', 'manager', 'employee')"), "database should support admin, manager, employee roles");
assert(schema.includes("create table if not exists public.meal_orders"), "database should include meal orders");
assert(schema.includes("create policy read_schedule_entries"), "database should include RLS policies");
assert(schema.includes("create or replace function public.protect_admin_member"), "database should protect the last admin");
assert(schema.includes("create or replace function public.protect_department_attendance_fields"), "database should protect attendance settings from manager writes");

assert(renderer.includes("function isAdmin()") && renderer.includes("function canEditMemberAccount"), "permissions should distinguish admin from manager");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "login should have device-specific idle windows");
assert(webApi.includes("function assertSessionActive"), "authenticated requests should enforce idle timeout");
assert(index.includes('id="homeCard"') && renderer.includes("function renderHomeDashboard"), "login should land on the home dashboard");
assert(index.includes('id="scheduleCard" hidden'), "schedule table should be hidden until the schedule page is opened");
assert(renderer.includes('window.addEventListener("popstate", handleAppBackNavigation)') && renderer.includes("function hasClosableModal") && renderer.includes('appView = "home";'), "Android back should close modal first, then return home");
assert(renderer.includes('[hidden]') || styles.includes("[hidden]"), "hidden sections should stay hidden on mobile");
assert(styles.includes("@media (max-width: 640px)") && styles.includes(".calendar-nav {\n    flex-wrap: wrap;") && styles.includes(".nav-actions {\n    justify-content: flex-start;"), "mobile schedule navigation should wrap instead of forcing one row");
assert(renderer.includes('toggle.textContent = "功能"'), "schedule top-right menu should be labelled function");
assert(index.includes('id="coreHomeButton"') && !index.includes('data-home-action="home">首頁</button>\n              <button'), "schedule home button should sit outside the function menu");
assert(renderer.includes("home-password-btn") && !index.includes('data-open-change-password="true">修改密碼</button>'), "change password should live on the home dashboard");
assert(renderer.includes("const showToolbar = showSchedule && isManager()"), "schedule floating toolbar should be manager-only");

assert(!index.includes('id="clockCard"'), "standalone clock page should be removed");
assert(!renderer.includes('data-home-action="clock"'), "home dashboard should not expose a clock page button");
assert(renderer.includes('<span class="home-action-title">簽到簿</span>'), "records entry should be named attendance ledger");
assert(renderer.includes('aria-label="簽到簿分頁"'), "records tabs should use the attendance ledger name");
assert(renderer.includes('["review", "簽到審核", isAdmin()]'), "attendance review should be the single admin attendance tab");
assert(!renderer.includes("renderTodayOvertimePanel"), "standalone overtime request panel should be removed");
assert(!renderer.includes("renderAttendanceAdminSection"), "standalone attendance admin tab should be removed");

assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendanceClock.includes("deviceType") && webApi.includes('deviceType: isPhoneDevice() ? "phone" : "desktop"'), "clocking should distinguish phone GPS from desktop IP");
assert(renderer.includes("timeout: 15000") && renderer.includes("maximumAge: 0"), "phone GPS clocking should wait for a fresh high-accuracy location");
assert(attendanceClock.includes('.from("attendance_days")'), "clocking should read the daily attendance model");
assert(attendanceClock.includes('rpc("save_attendance_clock"') && attendanceClock.includes('body?.action === "clock_in"') && attendanceClock.includes('body?.action === "clock_out"'), "clocking should call the atomic clock RPC for clock in and out");
assert(!attendanceClock.includes("attendance_records"), "clocking should not retain the retired attendance table");

for (const action of ["personal_list", "personal_save", "review_list", "review_save", "review_set", "history"]) {
  assert(attendanceLedger.includes(`body?.action === "${action}"`), `attendance ledger should support ${action}`);
}
assert(attendanceLedger.includes('.from("attendance_days")'), "attendance ledger should use daily records");
assert(attendanceLedger.includes('.from("attendance_audit_logs")'), "attendance ledger should retain audit history");
assert(attendanceLedger.includes("工時必須以 0.5 小時為單位"), "regular and overtime hours should use half-hour increments");
assert(attendanceLedger.includes("reviewed_at: null") && attendanceLedger.includes("reviewed_by: null"), "editing reviewed data should return it to unreviewed");
assert(attendanceLedgerExport.includes('.not("reviewed_at", "is", null)'), "attendance export should include reviewed records only");
assert(webApi.includes('requestFunction("attendance-ledger"') && webApi.includes('requestFunction("attendance-ledger-export"'), "frontend should use only the consolidated attendance APIs");

assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(renderer.includes('data-meal-tab="stats"') && renderer.includes("renderMealReportSection()"), "meal stats should live on the meal page");
assert(renderer.includes('<table class="meal-order-table">'), "today meal order should render as a table");
assert(renderer.includes("data-meal-product-row") && renderer.includes("commitMealProductOrderFromDom"), "meal settings should support drag ordering");
assert(mealOrder.includes('rpc("save_meal_order"') && !mealOrder.includes("save_meal_order_v2"), "meal ordering should call only the canonical transaction RPC");
assert(mealOrder.includes('.from("attendance_days")') && mealOrder.includes("clock_in_location?.departmentId"), "meal ordering should use the new clock-in location snapshot");
assert(renderer.includes("data-meal-note-product-id"), "meal ordering should support per-item notes");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "attendance ledger page should be present");
assert(renderer.includes("function loadRecordsPage") && renderer.includes("function loadAttendanceReview"), "attendance ledger should load personal and review data");
assert(!webApi.includes('requestFunction("personal-records-v2"'), "frontend should not call the retired personal records endpoint");

for (const name of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) {
  assert(deployScript.includes(`"${name}"`), `deployment list should include ${name}`);
}
for (const oldName of ["attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2"]) {
  assert(!deployScript.includes(oldName), `deployment list should not include ${oldName}`);
}

console.log("expansion acceptance checks passed");
