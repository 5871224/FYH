const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("權限角色拖曳由正式 renderer 立即持久化，並共用人員權限選單順序", () => {
  const permissions = read("src/renderer/renderer-groups-permissions-archive.js");

  assert.match(permissions, /dragRoleStartOrder = getPermissionRoleOrderFromDom\(\)/);
  assert.match(permissions, /previewPermissionRoleOrder\(roleRow, event\.clientY\)/);
  assert.match(permissions, /document\.addEventListener\("dragend"/);
  assert.match(permissions, /reorderSettings\("access-role", orderedIds\)/);
  assert.match(permissions, /state\.accessRoles = getAllRoles\(\)/);
  assert.match(permissions, /function renderMemberCustomRoleOptions\(member\)[\s\S]*const roles = getAllRoles\(\)/);
});

test("班別與假別區塊底部不保留多餘間距", () => {
  const css = read("src/renderer/css/pages.css");
  const permissions = read("src/renderer/renderer-groups-permissions-archive.js");

  assert.match(css, /\.toolbar-category-group\s*\{[^}]*padding:\s*3px 6px 0;/);
  assert.match(css, /\.toolbar-category-group > \.toolbar-section-combined,[\s\S]*?padding:\s*4px 0 0\s*!important;/);
  assert.match(css, /\.toolbar-category-group > \.toolbar-section-leave\s*\{[^}]*margin-top:\s*0;/);
  assert.doesNotMatch(permissions, /toolbar-floating-card/);
});

test("班表頁匯出加班維持只匯出明確加班設定", () => {
  const schedule = read("src/backend/native-schedule-extra.js");
  const exportFunction = schedule.match(/async function exportRows[\s\S]*?return result\.rows \|\| \[\];/)[0];
  assert.match(exportFunction, /schedule\.overtime_type_id/);
  assert.match(exportFunction, /schedule\.overtime_start_time/);
  assert.match(exportFunction, /schedule\.overtime_end_time/);
  assert.doesNotMatch(exportFunction, /leave_type\.code.*0036/);
  assert.doesNotMatch(exportFunction, /leave_type\.code.*0047/);
  assert.doesNotMatch(exportFunction, /例假|休息日/);
  assert.doesNotMatch(exportFunction, /shift_type\.start_time|shift_type\.end_time/);
});
