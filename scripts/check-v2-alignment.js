const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredFiles = [
  "supabase/002_current_updates.sql",
  "supabase/functions/attendance-overtime-employee/index.ts",
  "supabase/functions/attendance-overtime-admin-list/index.ts",
  "supabase/functions/attendance-overtime-admin-action/index.ts",
  "supabase/functions/attendance-admin-list-v2/index.ts",
  "supabase/functions/attendance-admin-action-v2/index.ts",
  "supabase/functions/department-attendance-v2/index.ts",
  "supabase/functions/member-delete-v2/index.ts",
  "supabase/functions/personal-records-v2/index.ts",
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "src/renderer/renderer-overtime-employee.js",
];

requiredFiles.forEach((file) => assert(exists(file), `Missing V2 file: ${file}`));
["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"].forEach((file) => assert(!exists(`src/renderer/${file}`), `Record UI still depends on late-loaded patch: ${file}`));
assert(!exists("src/renderer/v2-meal.js"), "Meal UI still depends on a late-loaded patch module");
["v2-account.js", "v2-meal-export.js", "v2-settings-drag-handles.js", "v2-drag-scroll-preserve.js"].forEach((file) => assert(!exists(`src/renderer/${file}`), `Legacy renderer patch remains: ${file}`));

const reportRecords = read("supabase/functions/report-records/index.ts");
assert(!reportRecords.includes("full_name, department_id"), "report-records still queries retired set_employee.department_id");

const databaseUpdates = read("supabase/002_current_updates.sql");
const security = databaseUpdates;
assert(security.includes("drop policy if exists write_overtime_requests"), "Direct overtime writes are still enabled");
assert(security.includes("drop policy if exists write_meal_orders"), "Direct meal-order writes are still enabled");
assert(security.includes("using (public.is_admin(auth.uid()))"), "Admin-only attendance policies are missing");

const clock = databaseUpdates;
assert(clock.includes("clock_in_company_latitude"), "Clock-in company-coordinate snapshot is missing");
assert(clock.includes("clock_out_company_longitude"), "Clock-out company-coordinate snapshot is missing");
assert(clock.includes("and clock_out_at is null"), "Clock-out idempotency check is missing");

const attendanceAdmin = databaseUpdates;
assert(attendanceAdmin.includes("p_reason text default ''"), "Attendance admin reason is missing");
assert(attendanceAdmin.includes("old_record, new_record"), "Full attendance old/new audit snapshots are missing");
assert(attendanceAdmin.includes("if v_in_changed or v_out_changed then"), "Attendance note-only edits may still reset overtime");

const overtimeBatch = databaseUpdates;
assert(overtimeBatch.includes("admin_review_overtime_requests_v2"), "Transactional overtime review RPC is missing");
assert(overtimeBatch.includes("for update"), "Overtime batch rows are not locked transactionally");

const overtimeEmployee = read("supabase/functions/attendance-overtime-employee/index.ts");
assert(overtimeEmployee.includes("APPLY_DAYS = 5"), "Five-day overtime application window is missing");
assert(!overtimeEmployee.includes("不可高於系統計算值"), "Employee overtime still has the retired calculated-hours cap");
assert(overtimeEmployee.includes("加班申請時數必須大於 0"), "Zero-hour overtime rejection is missing");

const overtimeAdminAction = read("supabase/functions/attendance-overtime-admin-action/index.ts");
assert(overtimeAdminAction.includes('rpc("admin_review_overtime_requests_v2"'), "Admin overtime review is not using the transactional RPC");

const mealOrder = read("supabase/functions/meal-order/index.ts");
assert(mealOrder.includes('rpc("save_meal_order_v2"'), "Meal order does not preserve the first department snapshot");
assert(mealOrder.includes("停用品項只能減少或取消"), "Disabled meal-item increase protection is missing");

const sourceWebApi = read("src/renderer/web-api.js");
assert(!exists("src/renderer/v2-tablet-session.js"), "Tablet session still depends on a late-loaded compatibility module");
assert(!sourceWebApi.includes("safeDepartmentColumns") && !sourceWebApi.includes("runManagerSafeWrite") && !sourceWebApi.includes("managerSafeFetch"), "Front-end still uses fetch interception as a permission boundary");
assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2"), "Purpose-specific employee RPCs are missing from the web API");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "Retired mixed-purpose employee RPC is still used by the web API");
const sourceJs = read("src/renderer/app.js");
const docsJs = read("docs/app.js");
assert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");
assert(sourceJs.includes("get_my_profile_v2") && sourceJs.includes("get_schedule_directory_v2") && sourceJs.includes("get_employee_admin_directory_v2"), "JavaScript bundle is missing purpose-specific employee RPCs");

const sourceCss = read("src/renderer/app.css");
const docsCss = read("docs/app.css");
assert(sourceCss === docsCss, "src/renderer/app.css and docs/app.css are not synchronized");
["foundation.css", "schedule.css", "components.css", "responsive.css", "pages.css"].forEach((file) => assert(exists(`src/renderer/css/${file}`), `Missing CSS module: ${file}`));
assert(!exists("docs/css"), "CSS source modules must not be published under docs/css");

const sourceIndex = read("src/renderer/index.html");
const docsIndex = read("docs/index.html");
assert(sourceIndex.includes("app.css") && !sourceIndex.includes("styles.css") && !sourceIndex.includes("ui-system.css"), "Source index must load only bundled app.css");
assert(docsIndex.includes("app.css") && !docsIndex.includes("styles.css") && !docsIndex.includes("ui-system.css"), "Published index must load only bundled app.css");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "Source index must load only app-config.js and bundled app.js");
assert(docsIndex.includes("app-config.js") && docsIndex.includes("app.js") && !docsIndex.includes("v2-api.js"), "Published index must load only app-config.js and bundled app.js");
assert(!sourceJs.includes("document.write"), "JavaScript bundle may overwrite the page");
const publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));
assert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), `Unexpected JavaScript source modules in docs: ${publishedJsFiles.join(", ")}`);

console.log(`V2 alignment checks passed (${requiredFiles.length} required files).`);
