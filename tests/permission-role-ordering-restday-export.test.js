const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("權限角色拖曳在 drop 或 dragend 都會立即持久化，並同步人員權限選單順序", () => {
  const ordering = read("src/renderer/permission-role-ordering.mjs");
  const config = read("src/renderer/app-config.js");

  assert.match(config, /permission-role-ordering\.mjs\?v=20260810-role-sort-v2/);
  assert.match(ordering, /dragStartOrder = getOrderedRoleIds\(table\)/);
  assert.match(ordering, /body\.addEventListener\("drop"/);
  assert.match(ordering, /body\.addEventListener\("dragend"/);
  assert.match(ordering, /shouldPersist = !dropHandled && changed/);
  assert.match(ordering, /reorderSettings\("access-role", orderedIds\)/);
  assert.match(ordering, /function syncRoleSelectOrder\(scope = document\)/);
  assert.match(ordering, /state\.accessRoles = orderedRoles/);
});

test("班別與假別區塊底部不保留多餘間距", () => {
  const toolbar = read("src/renderer/toolbar-compact.mjs");
  const ordering = read("src/renderer/permission-role-ordering.mjs");
  const config = read("src/renderer/app-config.js");

  assert.match(config, /toolbar-compact\.mjs\?v=20260810-toolbar-section-spacing/);
  assert.match(toolbar, /\.toolbar-category-group\s*\{[^}]*padding:\s*3px 6px 0;/);
  assert.match(toolbar, /\.toolbar-category-group > \.toolbar-section-combined,[\s\S]*?padding:\s*4px 0 0\s*!important;/);
  assert.match(toolbar, /\.toolbar-category-group > \.toolbar-section-leave\s*\{[^}]*margin-top:\s*0;/);
  assert.doesNotMatch(ordering, /toolbar-floating-card/);
});

test("班表頁匯出加班維持只匯出明確加班設定", () => {
  const migration = read("supabase/002_current_updates.sql");
  const section = migration.slice(migration.lastIndexOf("-- 2026-08-10 權限角色排序"));
  const match = section.match(/create or replace function public\.get_schedule_export_rows_v2[\s\S]*?(?=\nrevoke all on function public\.get_group_access_bundle_v1)/);
  const exportFunction = match?.[0] || "";
  assert.match(exportFunction, /schedule\.overtime_type_id/);
  assert.match(exportFunction, /schedule\.overtime_start_time/);
  assert.match(exportFunction, /schedule\.overtime_end_time/);
  assert.doesNotMatch(exportFunction, /leave_type\.code in \('0036','0047'\)/);
  assert.doesNotMatch(exportFunction, /then shift_type\.start_time/);
  assert.doesNotMatch(exportFunction, /then shift_type\.end_time/);
});
