const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), "utf8");

const schema = read("supabase", "001_current_schema.sql");
const index = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const webApi = read("src", "renderer", "web-api.js");
const attendanceClock = read("supabase", "functions", "attendance-clock", "index.ts");
const attendanceOvertime = read("supabase", "functions", "attendance-overtime", "index.ts");
const mealOrder = read("supabase", "functions", "meal-order", "index.ts");
const reportRecords = read("supabase", "functions", "report-records", "index.ts");

assert(schema.includes("role in ('admin', 'manager', 'employee')"), "database should support admin, manager, employee roles");
assert(schema.includes("create table if not exists public.attendance_records"), "database should include attendance records");
assert(schema.includes("create table if not exists public.attendance_overtime_requests"), "database should include attendance overtime requests");
assert(schema.includes("create table if not exists public.meal_orders"), "database should include meal orders");
assert(schema.includes("create policy read_schedule_entries"), "database should include RLS policies");
assert(schema.includes("create or replace function public.protect_admin_member"), "database should protect the last admin");
assert(schema.includes("create or replace function public.protect_department_attendance_settings"), "database should protect attendance settings from manager writes");

assert(renderer.includes("function isAdmin()") && renderer.includes("function canEditMemberAccount"), "permissions should distinguish admin from manager");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "login should have device-specific idle windows");
assert(webApi.includes("function assertSessionActive"), "authenticated requests should enforce idle timeout");
assert(index.includes('id="homeCard"') && renderer.includes("function renderHomeDashboard"), "login should land on the home dashboard");
assert(index.includes('id="scheduleCard" hidden'), "schedule table should be hidden until the schedule page is opened");
assert(renderer.includes('[hidden]') || read("src", "renderer", "styles.css").includes("[hidden]"), "hidden sections should stay hidden on mobile");

assert(index.includes('id="clockCard"') && renderer.includes("function renderClockPage"), "clock page should be present");
assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendanceClock.includes("deviceType") && webApi.includes("deviceType: isPhoneDevice() ? \"phone\" : \"desktop\""), "clocking should distinguish phone GPS from desktop IP");
assert(schema.includes("create or replace function public.save_attendance_clock"), "clocking should use an atomic database RPC");
assert(attendanceClock.includes('rpc("save_attendance_clock"') && attendanceClock.includes('body?.action === "clock_in"') && attendanceClock.includes('body?.action === "clock_out"'), "clocking should call the atomic clock RPC for clock in and out");

assert(renderer.includes("function renderTodayOvertimePanel"), "overtime request panel should be present");
assert(attendanceOvertime.includes("function buildEligibility"), "overtime should calculate eligibility");
assert(attendanceOvertime.includes('status: "pending"'), "overtime requests should start pending");

assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(renderer.includes('data-meal-tab="stats"') && renderer.includes("renderMealReportSection()"), "meal stats should live on the meal page");
assert(!renderer.includes('["meal", "訂餐統計", isManager()]'), "records page should not expose the meal stats tab");
assert(renderer.includes('<table class="meal-order-table">'), "today meal order should render as a table");
assert(schema.includes("create or replace function public.save_meal_order"), "meal ordering should use a database transaction RPC");
assert(mealOrder.includes('rpc("save_meal_order"'), "meal ordering should call the transaction RPC");
assert(schema.includes("請先完成上班打卡後再訂餐") && schema.includes("今日訂餐已超過截止時間"), "meal ordering should require clock-in and cutoff checks in the transaction");
assert(renderer.includes("data-meal-note-product-id"), "meal ordering should support per-item notes");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "records page should be present");
assert(reportRecords.includes("personalRecords") && reportRecords.includes("mealStats"), "reports should include personal records and meal stats");

console.log("expansion acceptance checks passed");
