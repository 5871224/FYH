const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const webApi = read("src/renderer/web-api.js");
const schema = read("supabase/001_current_schema.sql") + "\n" + read("supabase/002_current_updates.sql");
const sqlFiles = fs.readdirSync(path.join(rootDir, "supabase")).filter((name) => /^\d+_.*\.sql$/i.test(name)).sort();

assert.deepStrictEqual(sqlFiles, ["001_current_schema.sql", "002_current_updates.sql"], "Supabase canonical schema must remain exactly two SQL files");
assert(!schema.includes("scheduler_state"), "legacy scheduler_state blob table must not return");
assert(schema.includes("create table if not exists public.schedule_entries"), "normalized schedule_entries table must exist");
assert(schema.includes("create table if not exists public.set_employee"), "normalized employee table must exist");
assert(schema.includes("create table if not exists public.set_departments"), "normalized department table must exist");
assert(schema.includes("create table if not exists public.set_shift"), "normalized shift table must exist");
assert(schema.includes("create table if not exists public.set_leave"), "normalized leave table must exist");
assert(schema.includes("create table if not exists public.set_overtime"), "normalized overtime table must exist");
assert(schema.includes("deleted_at"), "soft delete columns must remain canonical");

const requiredApis = [
  "get_scheduler_bootstrap_v3",
  "get_schedule_entries_v3",
  "save_schedule_entries_v3",
  "save_shift_v3",
  "save_catalog_item_v3",
  "delete_catalog_item_v3",
  "save_department_v3",
  "delete_department_v3",
  "reorder_settings_v3",
  "save_scheduler_preferences_v3",
  "save_holidays_v3",
  "get_department_attendance_settings_v3",
  "get_employee_admin_directory_v3"
];
for (const name of requiredApis) {
  assert(schema.toLowerCase().includes(`function public.${name}`), `${name} must exist in canonical SQL`);
}
assert(schema.includes("security definer"), "canonical privileged APIs must use SECURITY DEFINER");

const obsoleteApis = [
  "assign_department_group_v1",
  "assign_member_access_v1",
  "delete_department_general_v2",
  "delete_member_account_v3",
  "get_department_directory_v2",
  "get_employee_admin_directory_v2",
  "get_schedule_directory_v2",
  "save_department_attendance_fields_bulk",
  "save_departments_general_v2",
  "save_schedule_entries_bulk"
];
for (const name of obsoleteApis) {
  assert(!new RegExp(`create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${name}\\b`, "i").test(schema), `${name} legacy definition must be removed`);
}

for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "syncCatalogs(", "saveState("]) {
  assert(!webApi.includes(helper), `browser must not keep generic data helper ${helper}`);
}
for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays"]) {
  assert(!webApi.includes(`/rest/v1/${table}`), `browser must not access ${table} directly`);
}
assert(webApi.includes('callRpc("get_scheduler_bootstrap_v3"'), "browser bootstrap must use named v3 RPC");
assert(webApi.includes('callRpc("save_schedule_entries_v3"'), "schedule writes must use named v3 RPC");
assert(webApi.includes('callRpc("save_department_v3"'), "department writes must use named v3 RPC");
assert(webApi.includes('requestFunction("member-auth-admin"'), "member account mutations must use the canonical member-auth-admin Edge Function");
assert(webApi.includes('requestFunction("access-control"'), "access role operations must use the canonical access-control Edge Function");

for (const removedEdge of ["catalog-admin", "member-delete-v2", "member-order-v2", "department-attendance-v2"]) {
  assert(!fs.existsSync(path.join(rootDir, "supabase", "functions", removedEdge)), `${removedEdge} obsolete Edge Function must be removed`);
}

for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays", "meal_orders", "meal_products", "meal_settings", "attendance_days"]) {
  assert(schema.includes(`revoke all privileges on table public.${table} from anon,authenticated;`), `${table} direct browser privileges must be revoked`);
}

console.log("normalized storage and access architecture checks passed");
