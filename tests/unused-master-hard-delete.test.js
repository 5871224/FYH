const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("unused members are physically deleted while history keeps the profile", () => {
  const sql = read("supabase/002_current_updates.sql");
  const edge = read("supabase/functions/member-auth-admin/index.ts");
  assert.match(sql, /v_schedule_count=0 and v_attendance_count=0 and v_meal_count=0/);
  assert.match(sql, /delete from public\.set_employee where id=p_target_id/);
  assert.match(sql, /'hardDeleted',true/);
  assert.match(sql, /update public\.set_employee[\s\S]*deleted_at=now\(\)/);
  assert.match(edge, /if \(result\?\.hardDeleted\)/);
  assert.match(edge, /auth\.admin\.deleteUser\(profile\.id\)/);
});

test("unused shift leave and overtime masters are physically deleted", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.match(sql, /delete from public\.set_shift where id=p_item_id/);
  assert.match(sql, /delete from public\.set_leave where id=p_item_id/);
  assert.match(sql, /delete from public\.set_overtime where id=p_item_id/);
  assert.match(sql, /if v_unarchived_schedule_count>0 then raise exception '此班別仍有未封存班表/);
  assert.match(sql, /'softDeleted',not v_hard_deleted/);
});

test("unused departments are physically deleted while referenced history is retained", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.match(sql, /if v_schedule_count=0 and v_other_reference_count=0 then[\s\S]*delete from public\.set_departments/);
  assert.match(sql, /select 1 from public\.meal_orders where department_id=p_department_id or attendance_department_id=p_department_id/);
  assert.match(sql, /update public\.set_departments set deleted_at=now\(\)/);
});
