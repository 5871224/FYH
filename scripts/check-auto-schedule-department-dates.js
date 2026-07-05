const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "src", "renderer", "styles.css"), "utf8");

function isDepartmentOperatingOnDate(department, dateString) {
  if (!department || !dateString) {
    return false;
  }
  if (department.startDate && dateString < department.startDate) {
    return false;
  }
  if (department.endDate && dateString > department.endDate) {
    return false;
  }
  return true;
}

function isShiftOperatingOnDate(shift, departments, dateString) {
  const shiftDeptId = shift?.applicableDeptId || "";
  return Boolean(shiftDeptId && isDepartmentOperatingOnDate(departments.find((department) => department.id === shiftDeptId), dateString));
}

const departments = [
  { id: "open", startDate: "2026-05-01", endDate: "2026-05-31" },
  { id: "always", startDate: "", endDate: "" },
  { id: "from_june", startDate: "2026-06-01", endDate: "" },
  { id: "until_may", startDate: "", endDate: "2026-05-31" }
];

assert.equal(isDepartmentOperatingOnDate(departments[0], "2026-04-30"), false);
assert.equal(isDepartmentOperatingOnDate(departments[0], "2026-05-01"), true);
assert.equal(isDepartmentOperatingOnDate(departments[0], "2026-05-31"), true);
assert.equal(isDepartmentOperatingOnDate(departments[0], "2026-06-01"), false);
assert.equal(isDepartmentOperatingOnDate(departments[1], "2026-06-01"), true);
assert.equal(isDepartmentOperatingOnDate(departments[2], "2026-05-31"), false);
assert.equal(isDepartmentOperatingOnDate(departments[2], "2026-06-01"), true);
assert.equal(isDepartmentOperatingOnDate(departments[2], "2026-06-30"), true);
assert.equal(isDepartmentOperatingOnDate(departments[3], "2026-05-31"), true);
assert.equal(isDepartmentOperatingOnDate(departments[3], "2026-06-01"), false);
assert.equal(isShiftOperatingOnDate({ applicableDeptId: "open" }, departments, "2026-06-01"), false);
assert.equal(isShiftOperatingOnDate({ applicableDeptId: "always" }, departments, "2026-06-01"), true);
assert.equal(isShiftOperatingOnDate({ applicableDeptId: "from_june" }, departments, "2026-06-30"), true);
assert.equal(isShiftOperatingOnDate({ applicableDeptId: "" }, departments, "2026-06-01"), false);

assert(renderer.includes("function isDepartmentOperatingOnDate"), "renderer should check department operating dates");
assert(renderer.includes("function isShiftOperatingOnDate"), "renderer should check shift operating dates");
assert(renderer.includes("getVisibleAutoScheduleShifts(dateString)"), "daily auto schedule demand should filter by date");
assert(renderer.includes("getOperatingShiftDepartmentIds(shift, dateString)"), "daily candidates should use operating shift departments");
assert(renderer.includes("const isOperating = isShiftOperatingOnDate(shift, dateString);"), "shift view should compute operating state");
assert(renderer.includes("const requiredStaffCount = getShiftDemandForDate(shift, dateString);"), "shift view shortage should use date-aware demand");
assert(renderer.includes('const inactiveClass = shiftViewCellState.isOperating ? "" : "inactive-cell";'), "shift view should gray out non-operating dates");
assert(styles.includes(".shift-view-cell:not(.inactive-cell):hover"), "shift view hover should not override inactive gray cells");

console.log("auto schedule department date check ok");
