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

test("班表頁匯出加班會將例假或休息日的排班班別視為加班", () => {
  const migration = read("supabase/002_current_updates.sql");
  const start = migration.lastIndexOf("create or replace function public.get_schedule_export_rows_v2");
  const end = migration.indexOf("\nrevoke all on function public.get_schedule_export_rows_v2", start);
  assert.ok(start >= 0, "找不到 get_schedule_export_rows_v2");
  const exportFunction = migration.slice(start, end > start ? end : undefined);
  assert.match(exportFunction, /has_common_permission\(\(select auth\.uid\(\)\),'export'\)/);
  assert.match(exportFunction, /has_group_permission\(\(select auth\.uid\(\)\),schedule\.group_id,'schedule_view'\)/);
  assert.match(exportFunction, /leave_type\.code in \('0036','0047'\)/);
  assert.match(exportFunction, /then schedule\.shift_type_id/);
  assert.match(exportFunction, /then shift_type\.start_time/);
  assert.match(exportFunction, /then shift_type\.end_time/);
  assert.match(exportFunction, /left join public\.set_shift shift_type on shift_type\.id=schedule\.shift_type_id/);
  assert.match(exportFunction, /when schedule\.overtime_type_id is not null then schedule\.overtime_start_time/);
});
