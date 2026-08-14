const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("unused members are physically deleted while history keeps the profile", () => {
  const repository = read("src/backend/repositories/native-member-repository.js");
  assert.match(repository, /const hardDeleted = scheduleCount === 0 && attendanceCount === 0 && mealCount === 0/);
  assert.match(repository, /LAST_PRIVILEGED_ACCOUNT/);
  assert.match(repository, /系統必須保留至少一個有效的權限管理帳號/);
  assert.match(repository, /delete from public\.auth_sessions where employee_id = \$1::uuid/);
  assert.match(repository, /delete from public\.set_employee where id = \$1::uuid and deleted_at is null/);
  assert.match(repository, /update public\.set_employee[\s\S]*set deleted_at = now\(\), updated_at = now\(\)/);
  assert.match(repository, /softDeleted: !hardDeleted/);
  assert.match(repository, /hardDeleted/);
});

test("unused shift leave and overtime masters are physically deleted", () => {
  const repository = read("src/backend/repositories/native-master-data-repository.js");
  assert.match(repository, /delete from public\.set_shift where id = \$1::uuid and deleted_at is null/);
  assert.match(repository, /category === "leave" \|\| category === "overtime"/);
  assert.match(repository, /delete from \$\{table\} where id = \$1::uuid and deleted_at is null/);
  assert.match(repository, /SHIFT_HAS_UNARCHIVED_SCHEDULE/);
  assert.match(repository, /CATALOG_HAS_UNARCHIVED_SCHEDULE/);
  assert.match(repository, /softDeleted: !hardDelete/);
});

test("unused departments are physically deleted while referenced history is retained", () => {
  const repository = read("src/backend/repositories/native-master-data-repository.js");
  assert.match(repository, /const hardDelete = Number\(schedule\?\.schedule_count \|\| 0\) === 0/);
  assert.match(repository, /public\.meal_orders where department_id = \$1::uuid or attendance_department_id = \$1::uuid/);
  assert.match(repository, /delete from public\.set_departments where id = \$1::uuid and deleted_at is null/);
  assert.match(repository, /update public\.set_departments[\s\S]*set deleted_at = now\(\), updated_at = now\(\)/);
});
