const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sql = read("supabase/002_current_updates.sql");
const webApi = read("src/renderer/web-api.js");
const groups = read("src/renderer/renderer-groups-permissions-archive.js");
const runtime = read("supabase/functions/_shared/runtime.ts");

test("權限資料模型只保留最新版", () => {
  assert.match(sql, /common_permissions text\[\]/);
  assert.match(sql, /create table if not exists public\.access_role_group_permissions/);
  assert.match(sql, /permissions text\[\] not null default '\{\}'/);
  assert.match(sql, /drop table if exists public\.access_role_groups/);
  assert.match(sql, /alter table public\.access_roles drop column if exists permissions/);
  assert.doesNotMatch(sql, /create(?:\s+or\s+replace)?\s+function public\.(?:has_access_permission|can_access_group|role_applies_to_group)/i);
  assert.doesNotMatch(sql, /create(?:\s+or\s+replace)?\s+function public\.(?:get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1)/i);
  assert.doesNotMatch(sql, /v_(?:old|new)_role\.permissions|other_role\.permissions/);
});

test("前端只使用共用與群組權限", () => {
  assert.match(groups, /commonPermissions/);
  assert.match(groups, /groupPermissions/);
  assert.match(groups, /hasCommonPermission/);
  assert.match(groups, /hasGroupPermission/);
  assert.doesNotMatch(groups, /applicableGroupIds|role\.permissions|role\.groupIds|getAccessPermissions|roleAppliesToGroup/);
  assert.match(webApi, /requestFunction\("access-control"/);
  assert.doesNotMatch(webApi, /get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1/);
});

test("Edge Function 不使用舊權限 helper", () => {
  assert.match(runtime, /hasCommonPermission/);
  assert.match(runtime, /hasGroupPermission/);
  assert.doesNotMatch(runtime, /hasPermission|canAccessGroup|has_access_permission|can_access_group/);
  for (const name of fs.readdirSync(path.join(root, "supabase/functions"))) {
    const index = path.join(root, "supabase/functions", name, "index.ts");
    if (!fs.existsSync(index)) continue;
    const source = fs.readFileSync(index, "utf8");
    assert.doesNotMatch(source, /access_role_groups|has_access_permission|can_access_group|role_applies_to_group/);
  }
});
