const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const index = fs.readFileSync(path.join(rootDir, "src", "renderer", "index.html"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");
const memberAuthAdmin = fs.readFileSync(path.join(rootDir, "supabase", "functions", "member-auth-admin", "index.ts"), "utf8");
const attendanceClock = fs.readFileSync(path.join(rootDir, "supabase", "functions", "attendance-clock", "index.ts"), "utf8");
const attendanceOvertime = fs.readFileSync(path.join(rootDir, "supabase", "functions", "attendance-overtime", "index.ts"), "utf8");
const mealOrder = fs.readFileSync(path.join(rootDir, "supabase", "functions", "meal-order", "index.ts"), "utf8");
const reportRecords = fs.readFileSync(path.join(rootDir, "supabase", "functions", "report-records", "index.ts"), "utf8");

assert(index.includes("weekStartSettingsButton"), "floating function menu should show month/week settings");
assert(renderer.includes("monthStartDay: 1") && renderer.includes("monthStartSetting"), "renderer should persist month start day");
assert(renderer.includes("shiftRequiredStaffCount") && renderer.includes("requiredStaffCount"), "shift settings should include required staff count");
assert(renderer.includes("memberScheduleShiftList") && renderer.includes("scheduleShiftIds"), "member settings should include ordered schedule shifts");
assert(renderer.includes('id="memberDept"') && webApi.includes("homeDepartmentId: member?.deptId"), "member settings should preserve the home department separately");
assert(memberAuthAdmin.includes("home_department_id: homeDepartmentUuid"), "member auth sync should write home department id");
assert(memberAuthAdmin.includes('return role === "admin" || role === "manager" ? role : "employee";'), "member auth sync should preserve admin roles");
assert(memberAuthAdmin.includes("function hasManagerAccess"), "member auth sync should let admin share manager-level access");
assert(memberAuthAdmin.includes("只有管理員可以修改人員權限"), "member auth sync should restrict role changes to admins");
assert(renderer.includes("function isAdmin()"), "renderer should expose an admin role helper");
assert(renderer.includes("const ROLE_OPTIONS"), "renderer should keep role labels in one place");
assert(webApi.includes("function hasManagerAccess"), "web api should let admins use manager-level actions");
assert(index.includes('id="homeCard"'), "logged-in users should land on a home dashboard");
assert(renderer.includes('let appView = "home"'), "renderer should track the active app view");
assert(renderer.includes("function renderHomeDashboard"), "renderer should render the logged-in home dashboard");
assert(renderer.includes("if (!currentSession?.user)") && renderer.includes("authModalOpen = true"), "renderer should not load schedule data before login");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs"), "web api should enforce device-specific login idle windows");
assert(webApi.includes("function assertProfileCanLogin"), "web api should reject inactive or out-of-period accounts");
assert(index.includes('id="clockCard"'), "attendance should have a clock page container");
assert(renderer.includes("function renderClockPage") && renderer.includes('data-clock-action="clock_in"'), "renderer should render attendance clock buttons");
assert(renderer.includes("async function submitAttendanceClock") && renderer.includes("navigator.geolocation"), "renderer should submit clock actions with browser location when available");
assert(webApi.includes("getTodayAttendance") && webApi.includes("clockAttendance"), "web api should expose attendance clock calls");
assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300"), "attendance clock should enforce the 300m GPS distance");
assert(attendanceClock.includes("MAX_GPS_ACCURACY_METERS = 300"), "attendance clock should enforce the 300m GPS accuracy");
assert(attendanceClock.includes('action === "clock_in"') && attendanceClock.includes('action === "clock_out"'), "attendance clock should support clock in and clock out");
assert(renderer.includes("function renderTodayOvertimePanel"), "renderer should show today's attendance overtime panel");
assert(renderer.includes("async function submitTodayOvertimeRequest"), "renderer should submit employee overtime requests");
assert(webApi.includes("submitAttendanceOvertime") && webApi.includes("deleteAttendanceOvertime"), "web api should expose attendance overtime actions");
assert(attendanceOvertime.includes("function buildEligibility"), "attendance overtime should calculate request eligibility");
assert(attendanceOvertime.includes("Math.floor(minutes / 30) * 0.5"), "attendance overtime should round down to half-hour increments");
assert(attendanceOvertime.includes("員工申請時數不可高於系統計算值"), "attendance overtime should reject employee hours above system calculation");
assert(index.includes('id="mealCard"'), "meal ordering should have a page container");
assert(renderer.includes("function renderMealPage") && renderer.includes("data-save-today-meal"), "renderer should render today's meal order page");
assert(webApi.includes("getTodayMealOrder") && webApi.includes("saveTodayMealOrder"), "web api should expose meal order actions");
assert(mealOrder.includes("今日需先完成上班打卡才能訂餐"), "meal order should require clock-in before ordering");
assert(mealOrder.includes("daily_cutoff_time") && mealOrder.includes("orderingOpen"), "meal order should enforce the daily cutoff time");
assert(mealOrder.includes("clock_in_department_id"), "meal order should snapshot the clock-in department");
assert(index.includes('id="recordsCard"'), "reports should have a records page container");
assert(renderer.includes("function renderRecordsPage"), "renderer should render the records page");
assert(webApi.includes("getPersonalRecords") && webApi.includes("getMealStatsReport"), "web api should expose report actions");
assert(reportRecords.includes("personalRecords") && reportRecords.includes("mealStats"), "report records function should provide personal records and meal stats");
assert(reportRecords.includes("此功能限主管或管理員使用"), "meal stats should require manager-level access");
assert(renderer.includes("monthlyRestDays"), "member settings should include monthly rest days");
assert(!renderer.includes('data-set-department-view="member"') && !renderer.includes("人員檢視"), "department settings should keep only the department view");
assert(webApi.includes("scheduleShiftIds") && webApi.includes("required_staff_count"), "web api should sync auto schedule settings");
assert(
  schema.includes("schedule_shift_ids") &&
    schema.includes("monthly_rest_days") &&
    schema.includes("required_staff_count") &&
    schema.includes("month_start_day"),
  "current schema should include database fields for auto schedule settings"
);
assert(
    schema.includes("fixed_rest_weekday") &&
    !schema.includes("public.set_employee_departments") &&
    schema.includes("public.set_shift") &&
    schema.includes("month_start_day") &&
    !schema.includes("schedule_months"),
  "current schema should preserve active auto schedule tables without schedule_months"
);

console.log("auto schedule settings checks passed");
