const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("權限設定角色表格第一欄提供拖曳排序並儲存排序", () => {
  const config = read("src/renderer/app-config.js");
  const ordering = read("src/renderer/permission-role-ordering.mjs");

  assert.match(config, /permission-role-ordering\.mjs\?v=20260810-role-sort/);
  assert.match(ordering, /permission-role-drag-col/);
  assert.match(ordering, /settings-order-drag-handle/);
  assert.match(ordering, /dataset\.permissionRoleId/);
  assert.match(ordering, /reorderSettings\("access-role", orderedIds\)/);
  assert.match(ordering, /new MutationObserver\(enhancePermissionSettingsTable\)/);
});
