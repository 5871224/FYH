const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("未隱藏且無人員的單位仍顯示並可參與班表拖曳", () => {
  const config = read("src/renderer/app-config.js");
  const docsConfig = read("docs/app-config.js");
  assert.equal(docsConfig, config, "發布 app-config.js 必須與來源一致");

  assert.match(config, /getVisibleTableGroupsWithEmptyDepartments/);
  assert.match(config, /groupsByDepartmentId/);
  assert.match(config, /\{ department, members: \[\] \}/);
  assert.match(config, /row\.dataset\.tableEmptyDepartmentId = department\.id/);
  assert.match(config, /departmentCell\.dataset\.tableDepartmentId = department\.id/);
  assert.match(config, /departmentCell\.draggable = true/);
  assert.match(config, /className = "person-col empty-department-person-col"/);
  assert.match(config, /cell\.dataset\.readonly = "true"/);
  assert.doesNotThrow(() => new Function(config), "app-config.js 必須可解析");
});

test("人員可拖入空單位並保存新的所屬單位", () => {
  const config = read("src/renderer/app-config.js");
  assert.match(config, /moveScheduleTableMemberToDepartment\(memberId, departmentId\)/);
  assert.match(config, /remainingMembers\.splice\(insertionIndex, 0, \{ \.\.\.draggedMember, deptId: departmentId \}\)/);
  assert.match(config, /finishScheduleTableOrderChange\(viewport\)/);
  assert.match(config, /dragScheduleTableMemberId/);
  assert.match(config, /closest\("\[data-table-empty-department-id\]"\)/);
  assert.match(config, /markDragPreviewTarget\(target\)/);
});

test("空單位顯示與拖曳不介入自動排班候選人運算", () => {
  const autoSchedule = [
    read("src/renderer/renderer-auto-schedule.js"),
    read("src/renderer/renderer-auto-schedule-demand.js"),
    read("src/renderer/renderer-auto-schedule-assignment.js"),
    read("src/renderer/renderer-auto-fill-schedule.js")
  ].join("\n");
  assert.doesNotMatch(autoSchedule, /empty-department|tableEmptyDepartment|moveScheduleTableMemberToDepartment/);
  assert.match(autoSchedule, /state\.members/);
  assert.match(autoSchedule, /memberCanScheduleShift/);
});
