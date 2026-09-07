const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("打卡位置優先使用本人所屬單位，再比對同群組其他單位", () => {
  const source = read("supabase/functions/attendance-clock/index.ts");
  const spec = read("規格書.md");

  assert.match(source, /group_id,home_department_id,hire_date/);
  assert.match(source, /splitDepartmentsByHome\(departments, homeDepartmentId\)/);
  assert.match(source, /getClosestGpsMatch\(\[homeDepartment\], latitude, longitude\)/);
  assert.match(source, /const otherGpsMatch = getClosestGpsMatch\(otherDepartments, latitude, longitude\);/);
  assert.match(source, /homeGpsMatch && homeGpsMatch\.distance <= MAX_GPS_DISTANCE_METERS\s*\? homeGpsMatch\s*:\s*otherGpsMatch/);
  assert.match(source, /const homeIpDepartment = homeDepartment && ipMatches/);
  assert.match(source, /const ipDepartment = homeIpDepartment \|\| getIpMatch\(otherDepartments, clientIp\);/);
  assert.match(source, /profile\.home_department_id \|\| ""/);
  assert.match(spec, /本人所屬單位.*優先.*其他單位/);
});
