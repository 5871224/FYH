const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredFiles = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-ledger/index.ts",
  "supabase/functions/attendance-ledger-export/index.ts",
  "supabase/functions/meal-order/index.ts",
  "supabase/functions/department-attendance-v2/index.ts",
  "supabase/functions/member-delete-v2/index.ts",
  "supabase/functions/member-auth-admin/index.ts",
  "supabase/functions/member-order-v2/index.ts",
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "scripts/deploy-edge-functions.ps1",
  "src/renderer/web-api.js",
  "src/renderer/renderer-attendance-page.js",
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js",
  "src/renderer/app.js",
  "docs/app.js"
];

requiredFiles.forEach((file) => assert(exists(file), `Missing current architecture file: ${file}`));

const retiredEdgeFunctions = [
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "personal-records-v2",
  "attendance-clock-safe",
  "report-records"
];
retiredEdgeFunctions.forEach((name) => {
  assert(!exists(`supabase/functions/${name}`), `Retired Edge Function remains: ${name}`);
});
assert(!exists("src/renderer/renderer-overtime-employee.js"), "Retired overtime request renderer remains");

[
  "v2-records.js",
  "v2-personal-record-layout.js",
  "v2-overtime-admin.js",
  "v2-attendance-admin.js",
  "v2-live-report-filters.js",
  "v2-meal.js",
  "v2-account.js",
  "v2-meal-export.js",
  "v2-settings-drag-handles.js",
  "v2-drag-scroll-preserve.js",
  "v2-tablet-session.js"
].forEach((file) => assert(!exists(`src/renderer/${file}`), `Legacy renderer patch remains: ${file}`));

const deployScript = read("scripts/deploy-edge-functions.ps1");
const deployedFunctions = [
  "attendance-clock",
  "attendance-ledger",
  "attendance-ledger-export",
  "meal-order"
];
deployedFunctions.forEach((name) => {
  assert(deployScript.includes(`"${name}"`), `Deployment list is missing current endpoint: ${name}`);
});
retiredEdgeFunctions.forEach((name) => {
  assert(!deployScript.includes(`"${name}"`), `Deployment list still contains retired endpoint: ${name}`);
});

const schema = `${read("supabase/001_current_schema.sql")}\n${read("supabase/002_current_updates.sql")}`;
assert(schema.includes("create table if not exists public.attendance_days"), "Current attendance_days table is missing from database sources");
assert(schema.includes("create table if not exists public.attendance_audit_logs"), "Current attendance_audit_logs table is missing from database sources");
assert(schema.includes("insert into public.attendance_days") && schema.includes("from public.attendance_records"), "Legacy attendance history backfill is missing");
assert(schema.includes("public.attendance_days%rowtype"), "Clocking or meal transaction RPCs still use the retired attendance row type");
assert(schema.includes("from public.attendance_days"), "Current attendance table is not used by database RPCs");

const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");
for (const [name, source] of [
  ["attendance-clock", attendanceClock],
  ["attendance-ledger", attendanceLedger],
  ["attendance-ledger-export", attendanceExport],
  ["meal-order", mealOrder]
]) {
  assert(source.includes("attendance_days"), `${name} does not use attendance_days`);
  assert(!source.includes("attendance_records"), `${name} still uses attendance_records`);
}
assert(attendanceClock.includes('rpc("save_attendance_clock"'), "Clock endpoint is not using the atomic clock RPC");
assert(attendanceLedger.includes('body?.action === "personal_list"'), "Attendance ledger is missing personal records");
assert(attendanceLedger.includes('body?.action === "personal_save"'), "Attendance ledger is missing employee edits");
assert(attendanceLedger.includes('body?.action === "review_list"'), "Attendance ledger is missing review list");
assert(attendanceLedger.includes('body?.action === "review_save"'), "Attendance ledger is missing administrator edits");
assert(attendanceLedger.includes('body?.action === "review_set"'), "Attendance ledger is missing review state updates");
assert(attendanceLedger.includes('body?.action === "history"'), "Attendance ledger is missing audit history");
assert(attendanceExport.includes("attendance_days"), "Attendance export is not based on the current daily ledger");
assert(mealOrder.includes("clock_in_location") && mealOrder.includes('rpc("save_meal_order"'), "Meal order is not tied to the current clock-in snapshot and transaction RPC");

const sourceWebApi = read("src/renderer/web-api.js");
assert(sourceWebApi.includes('requestFunction("attendance-ledger"'), "Web API is missing the unified attendance ledger endpoint");
assert(sourceWebApi.includes('requestFunction("attendance-ledger-export"'), "Web API is missing the attendance export endpoint");
for (const name of retiredEdgeFunctions) {
  assert(!sourceWebApi.includes(name), `Web API still calls retired endpoint: ${name}`);
}
assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2"), "Purpose-specific employee RPCs are missing from the web API");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "Retired mixed-purpose employee RPC is still used by the web API");

const sourceJs = read("src/renderer/app.js");
const docsJs = read("docs/app.js");
assert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");
assert(sourceJs.includes("attendance-ledger") && sourceJs.includes("簽到簿"), "JavaScript bundle is missing the current attendance ledger");

const sourceCss = read("src/renderer/app.css");
const docsCss = read("docs/app.css");
assert(sourceCss === docsCss, "src/renderer/app.css and docs/app.css are not synchronized");
["foundation.css", "schedule.css", "components.css", "responsive.css", "pages.css"].forEach((file) => {
  assert(exists(`src/renderer/css/${file}`), `Missing CSS module: ${file}`);
});
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

console.log(`renderer alignment checks passed (${requiredFiles.length} required files).`);
