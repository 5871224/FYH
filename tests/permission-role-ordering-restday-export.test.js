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

test("班表浮動工具列不保留下方多餘空白", () => {
  const ordering = read("src/renderer/permission-role-ordering.mjs");
  assert.match(ordering, /toolbar-floating-card:not\(\.toolbar-floating-card-collapsed\)[^{]*\{[^}]*min-height:\s*0\s*!important/);
  assert.match(ordering, /height:\s*max-content\s*!important/);
  assert.match(ordering, /padding-bottom:\s*3px\s*!important/);
  assert.match(ordering, /toolbar-category-group[^}]*padding-bottom:\s*0\s*!important/);
});

test("例假或休息日有排班時，加班匯出使用該班別上下班時間", () => {
  const migration = read("supabase/003_20260810_permission_sort_restday_overtime.sql");
  assert.match(migration, /leave_type\.code in \('0036','0047'\)/);
  assert.match(migration, /leave_type\.name in \('例假','休息日'\)/);
  assert.match(migration, /then shift_type\.start_time/);
  assert.match(migration, /then shift_type\.end_time/);
  assert.match(migration, /then schedule\.shift_type_id/);
});
