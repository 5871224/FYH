const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const index = fs.readFileSync(path.join(rootDir, "src", "renderer", "index.html"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");
const schema = fs.readFileSync(path.join(rootDir, "supabase", "001_current_schema.sql"), "utf8");

assert(index.includes("weekStartSettingsButton"), "floating function menu should show month/week settings");
assert(renderer.includes("monthStartDay: 1") && renderer.includes("monthStartSetting"), "renderer should persist month start day");
assert(renderer.includes("shiftRequiredStaffCount") && renderer.includes("requiredStaffCount"), "shift settings should include required staff count");
assert(renderer.includes("memberScheduleDeptList") && renderer.includes("scheduleDeptIds"), "member settings should include ordered schedule departments");
assert(renderer.includes("monthlyRestDays"), "member settings should include monthly rest days");
assert(renderer.includes('data-set-department-view="department"') && renderer.includes('data-set-department-view="member"'), "department settings should support both views");
assert(webApi.includes("scheduleDepartmentIds") && webApi.includes("required_staff_count"), "web api should sync auto schedule settings");
assert(
  schema.includes("schedule_department_ids") &&
    schema.includes("monthly_rest_days") &&
    schema.includes("required_staff_count") &&
    schema.includes("month_start_day"),
  "current schema should include database fields for auto schedule settings"
);
assert(
    schema.includes("fixed_rest_weekday") &&
    schema.includes("public.set_employee_departments") &&
    schema.includes("public.set_shift") &&
    schema.includes("month_start_day") &&
    !schema.includes("schedule_months"),
  "current schema should preserve auto schedule settings tables without schedule_months"
);

console.log("auto schedule settings checks passed");
