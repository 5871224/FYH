const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const webApi = read("src/renderer/web-api.js");
const schema = read("supabase/001_current_schema.sql") + "\n" + read("supabase/002_current_updates.sql");
const executableSql = schema.replace(/--.*$/gm, "");
const sqlFiles = fs.readdirSync(path.join(rootDir, "supabase")).filter((name) => /^\d+_.*\.sql$/i.test(name)).sort();

assert.deepStrictEqual(sqlFiles, ["001_current_schema.sql", "002_current_updates.sql"], "canonical PostgreSQL schema must remain exactly two SQL files");
assert(!schema.includes("scheduler_state"), "legacy scheduler_state blob table must not return");
for (const table of [
  "schedule_entries",
  "set_employee",
  "set_departments",
  "set_shift",
  "set_leave",
  "set_overtime",
  "attendance_days",
  "attendance_audit_logs",
  "meal_orders",
  "schedule_groups",
  "access_roles",
  "access_role_groups",
  "schedule_archives",
  "schedule_archive_entries"
]) {
  assert(schema.includes(`create table if not exists public.${table}`), `normalized ${table} table must exist`);
}
assert(schema.includes("deleted_at"), "soft delete columns must remain canonical where required");

for (const pattern of [
  /auth\.uid\s*\(/i,
  /auth\.role\s*\(/i,
  /create\s+policy/i,
  /enable\s+row\s+level\s+security/i,
  /\bservice_role\b/i,
  /\bauthenticated\b/i,
  /\banon\b/i,
  /get_scheduler_bootstrap_v3/i,
  /get_schedule_entries_v3/i,
  /save_schedule_entries_v3/i,
  /save_attendance_clock/i,
  /save_meal_order/i
]) {
  assert(!pattern.test(executableSql), `canonical SQL must not depend on Supabase-specific mechanism: ${pattern}`);
}

for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "syncCatalogs(", "saveState("]) {
  assert(!webApi.includes(helper), `browser must not keep generic data helper ${helper}`);
}
for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays"]) {
  assert(!webApi.includes(`/rest/v1/${table}`), `browser must not access ${table} directly`);
}

assert(!webApi.includes("callRpc("), "browser must not call Supabase RPC directly");
assert(!webApi.includes("requestFunction("), "browser must not call Supabase Edge Functions directly");
assert(webApi.includes('request(`/api/v1/schedule/bootstrap${qs({documentId})}`)'), "browser bootstrap must use named FYH API");
assert(webApi.includes('request("/api/v1/schedule/entries",{method:"PUT"'), "schedule writes must use named FYH API");
assert(webApi.includes('request("/api/v1/settings/department",{method:"PUT"'), "department writes must use named FYH API");
assert(webApi.includes('request("/api/v1/members",{method:"PUT"'), "member mutations must use named FYH member API");
assert(webApi.includes('request("/api/v1/members/password/reset",{method:"POST"'), "member password reset must use named FYH member API");
assert(webApi.includes('request("/api/v1/members/delete",{method:"POST"'), "member deletion must use named FYH member API");

assert(!fs.existsSync(path.join(rootDir, "supabase", "functions")), "Supabase Edge Function source must remain removed");
assert(!fs.existsSync(path.join(rootDir, "scripts", "deploy-edge-functions.ps1")), "Edge Function deploy script must remain removed");
assert(!fs.existsSync(path.join(rootDir, "scripts", "check-public-supabase.js")), "public Supabase browser checker must remain removed");

console.log("normalized storage, portable PostgreSQL, and FYH API architecture checks passed");
