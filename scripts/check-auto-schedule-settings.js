const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const index = fs.readFileSync(path.join(rootDir, "src", "renderer", "index.html"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");
const memberAuthAdmin = fs.readFileSync(path.join(rootDir, "supabase", "functions", "member-auth-admin", "index.ts"), "utf8");

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
