const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const rendererDir = path.join(root, "src", "renderer");
const rendererSource = fs.readdirSync(rendererDir)
  .filter((name) => /\.(?:js|mjs)$/.test(name))
  .map((name) => read(path.join("src", "renderer", name)))
  .join("\n");

const coreTables = [
  "set_employee", "set_departments", "set_shift", "set_leave", "set_overtime",
  "schedule_entries", "scheduler_settings", "holidays", "schedule_groups",
  "access_roles", "access_role_groups", "schedule_archives", "schedule_archive_entries"
];

test("瀏覽器不得直接 CRUD 核心資料表", () => {
  for (const table of coreTables) assert.equal(rendererSource.includes("/rest/v1/" + table), false, table);
  for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
    assert.equal(rendererSource.includes(helper), false, helper);
  }
});

test("權限資料層不得用 runtime monkey patch", () => {
  assert.doesNotMatch(rendererSource, /schedulerApi\.[A-Za-z0-9_]+\s*=\s*(?:async\s+)?function/);
  assert.doesNotMatch(rendererSource, /const\s+original(?:Load|Save|Render|Sync|Normalize)[A-Za-z0-9_]*\s*=/);
  assert.doesNotMatch(rendererSource, /installGroupPermissionArchiveFeature/);
});

test("正式寫入 API 都是具名領域操作", () => {
  const api = read("src/renderer/web-api.js");
  for (const endpoint of [
    "/api/v1/schedule/entries",
    "/api/v1/settings/shift",
    "/api/v1/settings/catalog",
    "/api/v1/settings/catalog/delete",
    "/api/v1/settings/department",
    "/api/v1/settings/department/delete",
    "/api/v1/settings/order",
    "/api/v1/schedule/preferences",
    "/api/v1/schedule/holidays",
    "/api/v1/members"
  ]) assert.ok(api.includes(`request("${endpoint}"`), endpoint);
  assert.doesNotMatch(api, /\bcallRpc\s*\(/);
  assert.doesNotMatch(api, /\brequestFunction\s*\(/);
  assert.doesNotMatch(api, /\/rest\/v1\/rpc\//);
  assert.doesNotMatch(api, /\/functions\/v1\//);
});

test("Supabase Edge Function 與公開 anon 檢查工具不得存在", () => {
  assert.equal(fs.existsSync(path.join(root, "supabase", "functions")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "deploy-edge-functions.ps1")), false);
  assert.equal(fs.existsSync(path.join(root, "scripts", "check-public-supabase.js")), false);
  assert.equal(fs.existsSync(path.join(root, "deno.lock")), false);
});

test("本人打卡與訂餐由 FYH backend 驗證有效帳號與群組", () => {
  const attendance = read("src/backend/native-attendance.js");
  const meal = read("src/backend/native-meal.js");
  for (const source of [attendance, meal]) {
    assert.match(source, /employee\.deleted_at is null/);
    assert.match(source, /public\.is_employee_account_effective/);
  }
  assert.match(attendance, /where group_id=\$1::uuid and attendance_enabled=true and deleted_at is null/);
  assert.match(attendance, /ATTENDANCE_GROUP_REQUIRED/);
  assert.match(meal, /profile\.group_id/);
  assert.match(meal, /MEAL_CLOCK_REQUIRED/);
});

test("正式權限模型由 FYH backend 執行，SQL 不承擔平台授權", () => {
  const groupRole = read("src/backend/repositories/native-group-role-repository.js");
  const member = read("src/backend/repositories/native-member-repository.js");
  const settings = read("src/backend/repositories/native-settings-repository.js");
  const sql = read("supabase/002_current_updates.sql");
  const executableSql = sql.replace(/--.*$/gm, "");

  assert.match(groupRole, /permission_settings/);
  assert.match(groupRole, /access_role_groups/);
  assert.match(groupRole, /系統必須保留至少一個有效的權限管理帳號/);
  assert.match(member, /member_settings/);
  assert.match(settings, /leave_settings/);

  assert.doesNotMatch(executableSql, /auth\.uid\s*\(/i);
  assert.doesNotMatch(executableSql, /create\s+policy/i);
  assert.doesNotMatch(executableSql, /\bservice_role\b/i);
  assert.doesNotMatch(executableSql, /\bauthenticated\b/i);
  assert.doesNotMatch(executableSql, /\banon\b/i);
});

test("前端角色只使用 access_role_id 與權限資料，不保留文字角色相容層", () => {
  const auth = read("src/renderer/renderer-auth-context.js");
  const groups = read("src/renderer/renderer-groups-permissions-archive.js");
  const members = read("src/renderer/renderer-settings-member.js");
  const normalization = read("src/renderer/renderer-state-normalization.js");
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  for (const source of [auth, groups, members, normalization, webApi, exporter]) {
    assert.doesNotMatch(source, /function normalizeRole\(/);
    assert.doesNotMatch(source, /getRoleByLegacyRole/);
  }
  assert.doesNotMatch(groups, /role\.code === "employee"/);
  assert.doesNotMatch(groups, /role:\s*roleId/);
  assert.doesNotMatch(members, /<option value=\"(?:admin|manager|employee)\"/);
  assert.doesNotMatch(exporter, /parseRoleLabel/);
  assert.match(members, /member\.roleId/);
  assert.match(webApi, /accessRoleId:\s*member\?\.roleId/);
});
