const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("所有登入者的人員目錄回傳工號與排班班別，仍限制適用群組", () => {
  const sql = read("supabase/002_current_updates.sql");
  const start = sql.indexOf("drop function if exists public.get_schedule_directory_v2()");
  const end = sql.indexOf("create or replace function public.get_employee_admin_directory_v2()", start);
  const block = sql.slice(start, end);

  assert.ok(start >= 0 && end > start, "缺少正式班表人員目錄函式");
  assert.match(block, /returns table\(id uuid,employee_code text,full_name text,home_department_id uuid,hire_date date,leave_date date,pay_by_day boolean,schedule_shift_ids uuid\[\],sort_order integer\)/);
  assert.match(block, /select id,employee_code,full_name,home_department_id,hire_date,leave_date,pay_by_day,coalesce\(schedule_shift_ids,'\{\}'::uuid\[\]\),sort_order/);
  assert.doesNotMatch(block, /has_access_permission\(auth\.uid\(\),'member_settings'\).*employee_code/);
  assert.match(block, /role_applies_to_group\(auth\.uid\(\),group_id\)/);
  assert.match(block, /grant execute on function public\.get_schedule_directory_v2\(\) to authenticated,service_role/);
});

test("前端人員資料映射保留工號與排班班別", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("function mapMemberDirectoryRows");
  const end = webApi.indexOf("async function loadEmployeeAdminDirectory", start);
  const block = webApi.slice(start, end);

  assert.ok(start >= 0 && end > start, "缺少人員資料映射函式");
  assert.match(block, /code:\s*row\.employee_code\s*\|\|\s*""/);
  assert.match(block, /normalizeTextArray\(row\.schedule_shift_ids\)/);
  assert.match(block, /scheduleShiftIds,/);
});
