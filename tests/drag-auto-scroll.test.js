const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("固定速度邊緣捲動不因游標距離邊緣而改變速度", () => {
  const helpers = read("src/renderer/renderer-ui-helpers.js");
  const api = vm.runInNewContext(`${helpers}\n;({ getFixedEdgeAutoScrollDelta })`, {});
  assert.equal(api.getFixedEdgeAutoScrollDelta(150, 100, 300, 50, 20), 0);
  assert.equal(api.getFixedEdgeAutoScrollDelta(100, 100, 300, 50, 20), -20);
  assert.equal(api.getFixedEdgeAutoScrollDelta(125, 100, 300, 50, 20), -20);
  assert.equal(api.getFixedEdgeAutoScrollDelta(275, 100, 300, 50, 20), 20);
  assert.equal(api.getFixedEdgeAutoScrollDelta(300, 100, 300, 50, 20), 20);
});

test("班表拖曳選取支援固定速度水平與垂直自動捲動", () => {
  const keyboard = read("src/renderer/renderer-schedule-keyboard.js");
  const events = read("src/renderer/renderer-events-session.js");
  assert.match(keyboard, /createFixedEdgeAutoScrollController\(/);
  assert.match(keyboard, /horizontal: true/);
  assert.match(keyboard, /vertical: true/);
  assert.match(keyboard, /speedX: 24/);
  assert.match(keyboard, /speedY: 18/);
  assert.match(keyboard, /function handleScheduleRangeSelectionMouseLeave\(event\)/);
  assert.match(events, /addEventListener\("mousemove", updateScheduleRangeSelection\)/);
  assert.match(events, /addEventListener\("mouseleave", handleScheduleRangeSelectionMouseLeave\)/);
  assert.match(events, /window\.addEventListener\("blur", endScheduleRangeSelection\)/);
});


test("欄標題拖曳整欄選取支援固定速度左右自動捲動", () => {
  const keyboard = read("src/renderer/renderer-schedule-keyboard.js");
  const events = read("src/renderer/renderer-events-session.js");
  assert.match(keyboard, /scheduleHeaderColumnAutoScrollController/);
  assert.match(keyboard, /isActive: \(\) => scheduleHeaderDragSelection\?\.type === "column"/);
  assert.match(keyboard, /horizontal: true/);
  assert.match(keyboard, /vertical: false/);
  assert.match(keyboard, /speedX: 24/);
  assert.match(keyboard, /updateScheduleHeaderColumnFocusAtPointer\(pointer\)/);
  assert.match(keyboard, /selectScheduleColumn\(col, true\)/);
  assert.match(keyboard, /scheduleHeaderColumnAutoScroll\(event\.clientX, event\.clientY\)/);
  assert.match(events, /addEventListener\("mousemove", updateScheduleHeaderColumnSelection\)/);
  assert.doesNotMatch(events, /addEventListener\("mouseover", updateScheduleHeaderColumnSelection\)/);
});

test("班表與設定拖曳排序共用固定速度上下自動捲動", () => {
  const drag = read("src/renderer/renderer-events-drag.js");
  for (const stateName of [
    "dragScheduleTableDeptId",
    "dragScheduleTableMemberId",
    "dragScheduleShiftId",
    "dragMemberId",
    "dragMealProductIndex",
    "dragSortItemId"
  ]) {
    assert.match(drag, new RegExp(stateName));
  }
  assert.match(drag, /createFixedEdgeAutoScrollController\(/);
  assert.match(drag, /horizontal: false/);
  assert.match(drag, /vertical: true/);
  assert.match(drag, /findNearestVerticalDragScrollContainer\(event\.target\)/);
  assert.match(drag, /refreshGeneralDragPreviewAtPointer\(pointer\)/);
  assert.match(drag, /stopGeneralDragAutoScroll\(\)/);
});

test("群組與權限角色排序也使用固定速度自動捲動", () => {
  const source = read("src/renderer/renderer-groups-permissions-archive.js");
  assert.match(source, /groupFeatureState\.dragGroupId \|\| groupFeatureState\.dragRoleId/);
  assert.match(source, /createFixedEdgeAutoScrollController\(/);
  assert.match(source, /updateGroupFeatureDragAutoScroll\(event\)/);
  assert.match(source, /refreshGroupFeatureDragPreviewAtPointer\(pointer\)/);
  assert.match(source, /stopGroupFeatureDragAutoScroll\(\)/);
});

test("拖曳排序捲動位置保存涵蓋所有主要排序來源", () => {
  const source = read("src/renderer/renderer-drag-scroll-preserve.js");
  for (const selector of [
    "[data-sort-item]",
    "[data-member-card]",
    "[data-schedule-shift-option]",
    "[data-meal-product-row]",
    "[data-table-member-id]",
    "[data-table-department-id]",
    "[data-group-row]",
    "[data-permission-role-id]"
  ]) {
    assert.ok(source.includes(`"${selector}"`), `missing selector: ${selector}`);
  }
});
