const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const expectedEdgeFunctions = [
  "member-auth-admin",
  "attendance-clock",
  "attendance-ledger",
  "attendance-ledger-export",
  "attendance-review-groups",
  "meal-order",
  "meal-report-v2",
  "meal-cancel-v2"
];
const obsoleteEdgeFunctions = [
  "catalog-admin",
  "member-delete-v2",
  "member-order-v2",
  "department-attendance-v2",
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "personal-records-v2",
  "attendance-clock-safe",
  "report-records"
];

for (const file of [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "scripts/deploy-edge-functions.ps1",
  "src/renderer/web-api.js",
  "src/renderer/renderer-page-data.js",
  "src/renderer/renderer-groups-permissions-archive.js",
  "src/renderer/renderer-attendance-page.js",
  "src/renderer/renderer-records-page.js",
  "src/renderer/app.js",
  "docs/app.js"
]) assert(exists(file), `Missing current architecture file: ${file}`);

for (const name of expectedEdgeFunctions) {
  assert(exists(`supabase/functions/${name}/index.ts`), `Missing canonical Edge Function: ${name}`);
}
for (const name of obsoleteEdgeFunctions) {
  assert(!exists(`supabase/functions/${name}`), `Obsolete Edge Function remains: ${name}`);
}

const deployScript = read("scripts/deploy-edge-functions.ps1");
for (const name of expectedEdgeFunctions) {
  assert(deployScript.includes(`"${name}"`), `Deployment list is missing canonical Edge Function: ${name}`);
}
for (const name of obsoleteEdgeFunctions) {
  assert(!deployScript.includes(`"${name}"`), `Deployment list still contains obsolete Edge Function: ${name}`);
}
assert(deployScript.includes("001_current_schema.sql") && deployScript.includes("002_current_updates.sql"), "Deployment instructions must use the two canonical SQL stages");

const schema = read("supabase/001_current_schema.sql") + "\n" + read("supabase/002_current_updates.sql");
for (const table of ["attendance_days", "attendance_audit_logs", "schedule_entries", "set_employee", "set_departments", "set_shift", "set_leave", "set_overtime"]) {
  assert(schema.includes(`public.${table}`), `Canonical database sources are missing ${table}`);
}
for (const retiredName of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(!schema.includes(retiredName), `Canonical database sources still contain retired structure: ${retiredName}`);
}
for (const rpc of [
  "get_scheduler_bootstrap_v3",
  "get_schedule_entries_v3",
  "save_schedule_entries_v3",
  "save_department_v3",
  "save_shift_v3",
  "save_catalog_item_v3",
  "get_employee_admin_directory_v3",
  "get_department_attendance_settings_v3"
]) {
  assert(schema.toLowerCase().includes(`function public.${rpc}`), `Canonical SQL is missing ${rpc}`);
}

const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceReview = read("supabase/functions/attendance-review-groups/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const memberAdmin = read("supabase/functions/member-auth-admin/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");

assert(attendanceClock.includes('rpc("save_attendance_clock"'), "Clock endpoint must use the atomic clock RPC");
assert(attendanceClock.includes("attendance_days"), "Clock endpoint must use attendance_days");
assert(attendanceLedger.includes('body?.action === "personal_list"'), "Personal ledger must provide personal_list");
assert(attendanceLedger.includes('body?.action === "personal_save"'), "Personal ledger must provide personal_save");
for (const action of ["review_list", "review_save", "review_set", "history"]) {
  assert(!attendanceLedger.includes(`body?.action === "${action}"`), `Personal ledger must not duplicate review action: ${action}`);
  assert(attendanceReview.includes(`body?.action === "${action}"`), `Attendance review endpoint is missing action: ${action}`);
}
assert(attendanceReview.includes("attendance_review"), "Attendance review endpoint must validate attendance_review permission");
assert(attendanceExport.includes("attendance_review") && attendanceExport.includes("can_access_group"), "Attendance export must validate permission and group scope");
assert(memberAdmin.includes("member_settings") && memberAdmin.includes("permission_settings"), "Member admin must validate member and privileged permissions");
assert(!memberAdmin.includes('["manager", "admin"]') && !memberAdmin.includes('["admin", "manager"]'), "Member admin must not authorize from legacy role strings");
assert(mealOrder.includes("clock_in_location") && mealOrder.includes('rpc("save_meal_order"'), "Meal order must remain tied to clock-in snapshot and transaction RPC");

const webApi = read("src/renderer/web-api.js");
for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
  assert(!webApi.includes(helper), `Web API must not contain generic helper: ${helper}`);
}
for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays"]) {
  assert(!webApi.includes(`/rest/v1/${table}`), `Web API must not access ${table} directly`);
}
for (const rpc of ["get_scheduler_bootstrap_v3", "get_schedule_entries_v3", "get_employee_admin_directory_v3", "get_department_attendance_settings_v3"]) {
  assert(webApi.includes(rpc), `Web API is missing canonical RPC: ${rpc}`);
}
assert(webApi.includes('requestFunction("attendance-ledger"'), "Web API is missing personal attendance endpoint");
assert(webApi.includes('requestFunction("attendance-review-groups"'), "Web API is missing group-scoped attendance review endpoint");
assert(webApi.includes('requestFunction("attendance-ledger-export"'), "Web API is missing attendance export endpoint");
assert(webApi.includes('requestFunction("member-auth-admin"'), "Web API is missing canonical member admin endpoint");
for (const oldName of ["get_schedule_directory_v2", "get_employee_admin_directory_v2", "get_department_directory_v2", ...obsoleteEdgeFunctions]) {
  assert(!webApi.includes(oldName), `Web API still references obsolete API: ${oldName}`);
}
assert(!webApi.includes("hasManagerAccess") && !webApi.includes("hasAdminAccess") && !webApi.includes("ensureManager"), "Browser transport must not authorize from legacy roles");

const pageData = read("src/renderer/renderer-page-data.js");
const groupModule = read("src/renderer/renderer-groups-permissions-archive.js");
assert(!pageData.includes("schedulerApi.") || !/schedulerApi\.[A-Za-z0-9_]+\s*=/.test(pageData), "Page data module must not monkey-patch schedulerApi");
assert(!groupModule.includes("installGroupPermissionArchiveFeature") && !groupModule.includes("groupRpc("), "Group module must be canonical, not a runtime patch layer");

const sourceJs = read("src/renderer/app.js");
const docsJs = read("docs/app.js");
assert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");
const sourceCss = read("src/renderer/app.css");
const docsCss = read("docs/app.css");
assert(sourceCss === docsCss, "src/renderer/app.css and docs/app.css are not synchronized");
const sourceIndex = read("src/renderer/index.html");
const docsIndex = read("docs/index.html");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js"), "Source index must load canonical app files");
assert(docsIndex.includes("app-config.js") && docsIndex.includes("app.js"), "Published index must load canonical app files");
assert(!sourceJs.includes("document.write"), "Bundled app must not dynamically patch the page");
const publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));
assert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), `Unexpected JavaScript modules in docs: ${publishedJsFiles.join(", ")}`);

console.log(`renderer alignment checks passed (${expectedEdgeFunctions.length} canonical Edge Functions).`);
