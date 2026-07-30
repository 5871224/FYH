const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("未隱藏且無人員的單位仍顯示空白班表列", () => {
  const config = read("src/renderer/app-config.js");
  const docsConfig = read("docs/app-config.js");
  assert.equal(docsConfig, config, "發布 app-config.js 必須與來源一致");

  assert.match(config, /function getVisibleDepartmentMemberCounts\(\)/);
  assert.match(config, /state\.tableView === "shift" \|\| state\.tableDeptScopeFilter !== "all"/);
  assert.match(config, /state\.departments\.filter\(\(department\) => isDepartmentVisibleInScheduleRange\(department\)\)/);
  assert.match(config, /className = "person-col empty-department-person-col"/);
  assert.match(config, /setAttribute\("aria-label", "目前沒有所屬人員"\)/);
  assert.match(config, /cell\.dataset\.readonly = "true"/);
  assert.match(config, /renderTableWithVisibleEmptyDepartments/);
  assert.doesNotThrow(() => new Function(config), "app-config.js 必須可解析");
});

test("空單位顯示不介入自動排班資料與候選人運算", () => {
  const autoSchedule = [
    read("src/renderer/renderer-auto-schedule.js"),
    read("src/renderer/renderer-auto-schedule-demand.js"),
    read("src/renderer/renderer-auto-schedule-assignment.js"),
    read("src/renderer/renderer-auto-fill-schedule.js")
  ].join("\n");
  assert.doesNotMatch(autoSchedule, /empty-department|renderVisibleEmptyDepartments|getVisibleTableGroups/);
  assert.match(autoSchedule, /state\.members/);
  assert.match(autoSchedule, /memberCanScheduleShift/);
});
