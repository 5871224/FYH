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
  for (const table of coreTables) {
    assert.equal(rendererSource.includes("/rest/v1/" + table), false, table);
  }
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

test("舊通用 API 與重複 Edge Function 不得存在", () => {
  const deploy = read("scripts/deploy-edge-functions.ps1");
  for (const name of ["catalog-admin", "member-delete-v2", "member-order-v2", "department-attendance-v2"]) {
    assert.equal(fs.existsSync(path.join(root, "supabase", "functions", name)), false, name);
    assert.equal(deploy.includes(`\"${name}\"`), false, name);
  }
});

test("本人 Edge Function 必須拒絕已軟刪除帳號", () => {
  for (const file of [
    "supabase/functions/attendance-clock/index.ts",
    "supabase/functions/attendance-ledger/index.ts",
    "supabase/functions/meal-order/index.ts",
    "supabase/functions/meal-cancel-v2/index.ts"
  ]) {
    const source = read(file);
    assert.match(source, /deleted_at/, `${file} 缺少 deleted_at 驗證`);
    assert.match(source, /\.is\(\"deleted_at\", null\)/, `${file} 未限制有效人員資料列`);
  }
});

test("打卡地點只能使用本人所屬群組的有效單位", () => {
  const source = read("supabase/functions/attendance-clock/index.ts");
  assert.match(source, /\.eq\(\"group_id\", groupId\)/);
  assert.match(source, /\.eq\(\"attendance_enabled\", true\)/);
  assert.match(source, /\.is\(\"deleted_at\", null\)/);
  assert.match(source, /resolveClockLocation\(ctx, req, body, profile\.group_id\)/);
});

test("正式 SQL 只保留 canonical 權限模型", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.match(sql, /has_access_permission/);
  assert.match(sql, /'permission_settings'/);
  assert.match(sql, /'meal_admin'/);
  assert.match(sql, /'leave_settings'/);
  assert.match(sql, /系統必須保留至少一個有效的權限管理帳號/);
  assert.doesNotMatch(sql, /role\.legacy_role\s+in\s*\('admin','manager'\)/);
  assert.doesNotMatch(sql, /employee\.role\s*=\s*'admin'/);
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
