const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("權限設定角色表格第一欄由正式 renderer 提供拖曳排序並持久化", () => {
  const permissions = read("src/renderer/renderer-groups-permissions-archive.js");
  const css = read("src/renderer/css/pages.css");
  const config = read("src/renderer/app-config.js");

  assert.doesNotMatch(config, /\.mjs|document\.write/);
  assert.match(permissions, /permission-role-drag-col/);
  assert.match(permissions, /settings-order-drag-handle/);
  assert.match(permissions, /data-permission-role-id/);
  assert.match(permissions, /getPermissionRoleOrderFromDom/);
  assert.match(permissions, /reorderAccessRoles\(orderedIds\)/);
  assert.match(permissions, /document\.addEventListener\("dragend"/);
  assert.match(css, /\.permission-settings-table \.permission-role-drag-col/);
  assert.match(css, /tr\.permission-role-dragging/);
});
