const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("未隱藏且無人員的單位由正式班表 renderer 顯示並可參與拖曳", () => {
  const groups = read("src/renderer/renderer-schedule-groups.js");
  const table = read("src/renderer/renderer-schedule-table.js");

  assert.match(groups, /return state\.tableDeptScopeFilter === "all"[\s\S]*?groups/);
  assert.match(table, /data-table-empty-department-id/);
  assert.match(table, /data-table-department-id/);
  assert.match(table, /draggable="true"/);
  assert.match(table, /empty-department-person-col/);
  assert.match(table, /data-readonly="true"/);
});

test("人員可拖入空單位並保存新的所屬單位", () => {
  const ordering = read("src/renderer/renderer-schedule-ordering.js");
  const drag = read("src/renderer/renderer-events-drag.js");
  assert.match(ordering, /moveScheduleTableMemberToDepartment\(memberId, departmentId\)/);
  assert.match(ordering, /remainingMembers\.splice\(insertionIndex, 0, movedMember\)/);
  assert.match(ordering, /persistScheduleTableMemberDepartment\(movedMember, draggedMember\.code\)/);
  assert.match(ordering, /persistScheduleTableOrder\("member"\)/);
  assert.match(drag, /dragScheduleTableMemberId/);
  assert.match(drag, /closest\("\[data-table-empty-department-id\]"\)/);
  assert.match(drag, /moveScheduleTableMemberToDepartment\(memberId, departmentId\)/);
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
