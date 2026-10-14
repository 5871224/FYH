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

test("班表的匯出選單不再有加班，但簽到審核仍有匯出加班", () => {
  const vm = require("node:vm");
  const source = read("src/renderer/renderer-groups-permissions-archive.js");
  const start = source.indexOf("function getFunctionMenuSections()");
  const end = source.indexOf("\nfunction hasFunctionMenuAccess()", start);
  assert.ok(start >= 0 && end > start);
  const categories = vm.runInNewContext(
    source.slice(start, end) + "\ngetFunctionMenuSections()",
    {
      groupFeatureState: { currentGroupId: "g1" },
      hasCommonPermission: name => name === "export",
      hasGroupPermission: () => false
    }
  );
  const items = categories.find(category => category.id === "export").items;
  assert.deepEqual(Array.from(items, item => item.label), [
    "列印班表", "匯出上班日", "匯出休例假", "匯出請假",
    "統計上班日", "統計人數"
  ]);
  assert.doesNotMatch(read("src/renderer/renderer-events-toolbar.js"), /action === "export-overtime"/);
  assert.match(read("src/renderer/renderer-records-views.js"), /data-export-attendance-review="true">匯出加班/);
  assert.match(read("src/renderer/web-api.js"), /async function exportAttendanceReview\(filters = \{\}\)/);
});
