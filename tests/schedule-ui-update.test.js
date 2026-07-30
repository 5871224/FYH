const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表操作列與保留功能符合新介面契約", () => {
  const html = read("src/renderer/index.html");
  const filterIndex = html.indexOf('id="tableDeptScopeFilter"');
  const undoIndex = html.indexOf('id="scheduleUndoButton"');
  const redoIndex = html.indexOf('id="scheduleRedoButton"');
  assert.ok(filterIndex >= 0 && undoIndex > filterIndex && redoIndex > undoIndex);
  assert.match(html, /toolbar-section-overtime" hidden/);
  assert.match(html, /id="tablePrevWeekButton"[^>]* hidden/);
  assert.match(html, /id="tableNextWeekButton"[^>]* hidden/);
});

test("班表週移動與例假排班顯示具有正式程式契約", () => {
  const actions = read("src/renderer/renderer-export-actions.js");
  const table = read("src/renderer/renderer-schedule-table.js");
  const cells = read("src/renderer/renderer-schedule-cells.js");
  const css = read("src/renderer/css/pages.css");
  assert.match(actions, /function canChangeScheduleWindowWeeks\(weeks\)/);
  assert.match(actions, /maxStartDate: addDaysToDateString\(cycleStartDate, 49\)/);
  assert.match(actions, /button\.disabled = !canChangeScheduleWindowWeeks\(weeks\)/);
  assert.match(table, /regularHolidayWorkClass/);
  assert.match(cells, /hasRegularHolidayWork/);
  assert.match(css, /\.table-week-jump \{[\s\S]*?display: none !important;/);
  assert.match(css, /\.table-sticky-cell-day\.sun:not\(\.today\)/);
  assert.match(css, /#toolbarCollapseToggle \{[\s\S]*?width: 44px;/);
  assert.match(css, /\.cell\.regular-holiday-work-cell[\s\S]*?#ffe58f/);
});
