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

assert(renderer.includes("function isAdmin()") && renderer.includes("function canEditMemberAccount"), "permissions should distinguish admin from manager");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "login should have device-specific idle windows");
assert(index.includes('id="homeCard"') && renderer.includes("function renderHomeDashboard"), "login should land on the home dashboard");

assert(index.includes('id="clockCard"') && renderer.includes("function renderClockPage"), "clock page should be present");
assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "clocking should enforce GPS distance");
assert(attendanceClock.includes("buildClockFields") && attendanceClock.includes('body?.action === "clock_in"') && attendanceClock.includes('body?.action === "clock_out"'), "clocking should write clock in and out times");

assert(renderer.includes("function renderTodayOvertimePanel"), "overtime request panel should be present");
assert(attendanceOvertime.includes("員工申請時數不可高於系統計算值"), "overtime should enforce employee hour limits");
assert(attendanceOvertime.includes("status: \"pending\""), "overtime requests should start pending");

assert(index.includes('id="mealCard"') && renderer.includes("function renderMealPage"), "meal order page should be present");
assert(mealOrder.includes("今日需先完成上班打卡才能訂餐"), "meal ordering should require clock in");
assert(mealOrder.includes("daily_cutoff_time"), "meal ordering should enforce cutoff time");

assert(index.includes('id="recordsCard"') && renderer.includes("function renderRecordsPage"), "records page should be present");
assert(reportRecords.includes("personalRecords") && reportRecords.includes("mealStats"), "reports should include personal records and meal stats");

console.log("expansion acceptance checks passed");
