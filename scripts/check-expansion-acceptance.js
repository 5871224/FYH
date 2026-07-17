const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), "utf8");

const schema = read("supabase", "001_current_schema.sql");
const databaseUpdates = read("supabase", "002_current_updates.sql");
const index = read("src", "renderer", "index.html");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const styles = read("src", "renderer", "app.css");
const webApi = read("src", "renderer", "web-api.js");
const attendanceClock = read("supabase", "functions", "attendance-clock", "index.ts");
const attendanceOvertimeEmployee = read("supabase", "functions", "attendance-overtime-employee", "index.ts");
const attendanceOvertimeAdminList = read("supabase", "functions", "attendance-overtime-admin-list", "index.ts");
const attendanceOvertimeAdminAction = read("supabase", "functions", "attendance-overtime-admin-action", "index.ts");
const mealOrder = read("supabase", "functions", "meal-order", "index.ts");

assert(schema.includes("role in ('admin', 'manager', 'employee')"), "database should support admin, manager, employee roles");
assert(schema.includes("create table if not exists public.attendance_records"), "database should include attendance records");
assert(schema.includes("create table if not exists public.attendance_overtime_requests"), "database should include attendance overtime requests");
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
assert(renderer.includes('[hidden]') || read("src", "renderer", "app.css").includes("[hidden]"), "hidden sections should stay hidden on mobile");
assert(styles.includes("@media (max-width: 640px)") && styles.includes(".calendar-nav {\n    flex-wrap: wrap;") && styles.includes(".nav-actions {\n    justify-content: flex-start;"), "mobile schedule navigation should wrap instead of forcing one row");
assert(renderer.includes('toggle.textContent = "功能"'), "schedule top-right menu should be labelled function");
assert(index.includes('id="coreHomeButton"') && !index.includes('data-home-action="home">首頁</button>\n              <button'), "schedule home button should sit outside the function menu");
assert(renderer.includes("home-password-btn") && !index.includes('data-open-change-password="true">修改密碼</button>'), "change password should live on the home dashboard");
assert(renderer.includes("const showToolbar = showSchedule && isManager()"), "schedule floating toolbar should be manager-only");
assert(styles.includes(".toolbar-top-row") && styles.includes("left: 10px;"), "toolbar collapse button should sit at the left edge");
assert(index.includes('<path d="M6 9l6 6 6-6"></path>') && renderer.includes('<path d="M6 15l6-6 6 6"></path>'), "toolbar collapse and expand icons should be swapped");
assert(styles.includes("grid-template-columns: minmax(0, 1.66fr) minmax(0, 0.78fr) minmax(0, 0.52fr);"), "floating toolbar should give overtime width to shift");

assert(index.includes('id="clockCard"') && renderer.includes("function renderClockPage"), "clock page should be present");
assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendanceClock.includes("deviceType") && webApi.includes('deviceType: isPhoneDevice() ? "phone" : "desktop"'), "clocking should distinguish phone GPS from desktop IP");
assert(renderer.includes("timeout: 15000") && renderer.includes("maximumAge: 0"), "phone GPS clocking should wait for a fresh high-accuracy location");
assert(schema.includes("create or replace function public.save_attendance_clock"), "clocking should use an atomic database RPC");
assert(attendanceClock.includes('rpc("save_attendance_clock"') && attendanceClock.includes('body?.action === "clock_in"') && attendanceClock.includes('body?.action === "clock_out"'), "clocking should call the atomic clock RPC for clock in and out");

assert(renderer.includes("function renderTodayOvertimePanel"), "overtime request panel should be present");
assert(attendanceOvertimeEmployee.includes("function eligibility"), "employee overtime should calculate eligibility");
assert(attendanceOvertimeEmployee.includes('status: "pending"'), "employee overtime requests should start pending");
assert(!attendanceOvertimeAdminList.includes("full_name,department_id"), "overtime admin list should not query retired set_employee.department_id");
assert(attendanceOvertimeAdminList.includes("members: (memberResult.data || []).filter"), "admin overtime list should receive effective member options");
assert(attendanceOvertimeAdminAction.includes('rpc("admin_review_overtime_requests_v2"'), "overtime review should use the protected transaction RPC");
assert(attendanceOvertimeAdminAction.includes('created_by_type: "admin"'), "admin overtime creation should preserve its actor type");

assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(renderer.includes('data-meal-tab="stats"') && renderer.includes("renderMealReportSection()"), "meal stats should live on the meal page");
assert(!renderer.includes('["meal", "訂餐統計", isManager()]'), "records page should not expose the meal stats tab");
assert(renderer.includes('<table class="meal-order-table">'), "today meal order should render as a table");
assert(renderer.includes("data-meal-product-row") && renderer.includes("commitMealProductOrderFromDom"), "meal settings should support drag ordering");
assert(schema.includes("create or replace function public.save_meal_order"), "meal ordering should use the canonical database transaction RPC");
assert(mealOrder.includes('rpc("save_meal_order"') && !mealOrder.includes("save_meal_order_v2"), "meal ordering should call only the canonical transaction RPC");
assert(schema.includes("請先完成上班打卡後再訂餐") && schema.includes("今日訂餐已超過截止時間"), "meal ordering should require clock-in and cutoff checks in the transaction");
assert(renderer.includes("data-meal-note-product-id"), "meal ordering should support per-item notes");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "records page should be present");
assert(renderer.includes("function loadRecordsPage") && renderer.includes("function loadMealReport") && webApi.includes('requestFunction("personal-records-v2"') && webApi.includes('requestFunction("meal-report-v2"'), "records and meal reports should use their dedicated current APIs");

console.log("expansion acceptance checks passed");
