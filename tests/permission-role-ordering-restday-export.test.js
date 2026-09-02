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
  assert.match(permissions, /reorderAccessRoles\(orderedIds\)/);
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
  const migration = read("supabase/002_current_updates.sql");
  const start = migration.lastIndexOf("create or replace function public.get_schedule_export_rows_v2");
  const end = migration.indexOf("\nrevoke all on function public.get_schedule_export_rows_v2", start);
  assert.ok(start >= 0, "找不到 get_schedule_export_rows_v2");
  const exportFunction = migration.slice(start, end > start ? end : undefined);
  assert.match(exportFunction, /schedule\.overtime_type_id/);
  assert.match(exportFunction, /schedule\.overtime_start_time/);
  assert.match(exportFunction, /schedule\.overtime_end_time/);
  assert.doesNotMatch(exportFunction, /leave_type\.code in \('0036','0047'\)/);
  assert.doesNotMatch(exportFunction, /then shift_type\.start_time/);
  assert.doesNotMatch(exportFunction, /then shift_type\.end_time/);
});
