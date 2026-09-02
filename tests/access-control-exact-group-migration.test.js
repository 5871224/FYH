const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/2026090202_access_control_exact_group_checks.sql"),
  "utf8"
);

test("封存班表查看使用指定群組 schedule_view", () => {
  assert.match(sql, /get_schedule_archives_v1[\s\S]*has_group_permission\([\s\S]*archive\.group_id,'schedule_view'\)/);
  assert.match(sql, /get_schedule_archive_detail_v1[\s\S]*has_group_permission\([\s\S]*v_archive\.group_id,'schedule_view'\)/);
});

test("班表匯出使用共用 export 並逐列驗證 schedule_view", () => {
  assert.match(sql, /get_schedule_export_rows_v2[\s\S]*has_common_permission\([\s\S]*'export'\)/);
  assert.match(sql, /get_schedule_export_rows_v2[\s\S]*has_group_permission\([\s\S]*schedule\.group_id,'schedule_view'\)/);
});

test("人員群組異動同時驗證原群組與目標群組 schedule_manage", () => {
  assert.match(sql, /validate_member_group_change_v1[\s\S]*v_member\.group_id,'schedule_manage'/);
  assert.match(sql, /validate_member_group_change_v1[\s\S]*p_new_group_id,'schedule_manage'/);
});

test("群組主檔管理只使用共用 settings，不要求舊適用群組", () => {
  const deleteBlock = sql.match(/create or replace function public\.delete_schedule_group_v1[\s\S]*?end\n\$\$;/)?.[0] || "";
  const reorderBlock = sql.match(/create or replace function public\.reorder_schedule_groups_v1[\s\S]*?end\n\$\$;/)?.[0] || "";
  assert.match(deleteBlock, /has_common_permission\([\s\S]*'settings'/);
  assert.doesNotMatch(deleteBlock, /has_group_access|role_applies_to_group|access_role_groups/);
  assert.match(reorderBlock, /has_common_permission\([\s\S]*'settings'/);
  assert.doesNotMatch(reorderBlock, /has_group_access|role_applies_to_group|access_role_groups/);
});

test("越文名稱寫入使用對應的精確權限", () => {
  const block = sql.match(/create or replace function public\.save_vietnamese_label_v1[\s\S]*?end\n\$\$;/)?.[0] || "";
  assert.match(block, /has_common_permission\(v_user_id,'settings'\)/);
  assert.match(block, /has_group_permission\(v_user_id,v_group_id,'department_settings'\)/);
  assert.match(block, /has_group_permission\(v_user_id,v_group_id,'schedule_manage'\)/);
  assert.match(block, /has_common_permission\(v_user_id,'leave_settings'\)/);
  assert.match(block, /has_any_group_permission\(v_user_id,'meal_admin'\)/);
  assert.doesNotMatch(block, /has_access_permission|role_applies_to_group|can_access_group/);
});
