const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const renderer = fs.readFileSync("src/renderer/renderer-settings-department.js", "utf8");
const sql = fs.readFileSync("supabase/002_current_updates.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/2026090401_department_settings_permission.sql", "utf8");

function blockBetween(source, start, end) {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin + start.length);
  assert.notEqual(begin, -1, `找不到 ${start}`);
  assert.notEqual(finish, -1, `找不到 ${end}`);
  return source.slice(begin, finish);
}

test("單位設定前端不得再依賴共用 settings 權限", () => {
  assert.equal(renderer.includes("canManagePermissions()"), false);
  assert.match(renderer, /getDepartmentAttendanceSettings\(\)/);
  assert.match(renderer, /scopeKey = `\$\{userId\}:\$\{groupFeatureState\.currentGroupId \|\| ""\}`/);
  assert.match(renderer, /const attendanceFieldsDisabled = "";/);
  assert.match(renderer, /const attendancePayload = \{/);
  assert.doesNotMatch(renderer, /打卡地址、座標、固定 IP 與是否啟用打卡只有管理員可以修改/);
});

test("單位讀取、儲存與保護 Trigger 只看 department_settings", () => {
  const getBlock = blockBetween(sql, "create or replace function public.get_department_attendance_settings_v3()", "create or replace function public.get_employee_admin_directory_v3");
  assert.match(getBlock, /has_group_permission\(auth\.uid\(\),d\.group_id,'department_settings'\)/);
  assert.doesNotMatch(getBlock, /has_common_permission/);

  const saveBlock = blockBetween(sql, "create or replace function public.save_department_v3", "create or replace function public.delete_department_v3");
  assert.match(saveBlock, /has_group_permission\(auth\.uid\(\),v_group_id,'department_settings'\)/);
  assert.doesNotMatch(saveBlock, /v_can_admin|has_common_permission\(auth\.uid\(\),'settings'\)/);
  assert.match(saveBlock, /address=excluded\.address/);
  assert.match(saveBlock, /attendance_enabled=excluded\.attendance_enabled/);

  const triggerBlock = blockBetween(sql, "create or replace function public.protect_department_attendance_fields()", "drop trigger if exists trg_protect_employee_role_changes");
  assert.match(triggerBlock, /has_group_permission\(\(select auth\.uid\(\)\),v_group_id,'department_settings'\)/);
  assert.doesNotMatch(triggerBlock, /has_common_permission/);

  assert.match(migration, /department_settings/);
  assert.doesNotMatch(migration, /has_common_permission\([^\n]*'settings'/);
});
