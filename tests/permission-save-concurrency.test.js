const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(root, "src/renderer/renderer-groups-permissions-archive.js"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/access-control/index.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/2026090204_access_role_group_permission_atomic_replace.sql"), "utf8");

test("權限儲存會阻止前端重複送出", () => {
  assert.match(renderer, /if \(button\.disabled\) return;[\s\S]*button\.disabled = true;[\s\S]*saveAccessRoleFromForm\(\)/);
});

test("權限群組寫入使用原子替換 RPC", () => {
  assert.match(edge, /rpc\("replace_access_role_group_permissions_v1"/);
  assert.doesNotMatch(edge, /from\("access_role_group_permissions"\)\.delete\(\)\.eq\("role_id", id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /delete from public\.access_role_group_permissions/);
  assert.match(migration, /insert into public\.access_role_group_permissions/);
});
