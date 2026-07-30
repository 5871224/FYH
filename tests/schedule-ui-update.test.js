const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表浮動工具列使用整合式左側操作列", () => {
  const html = read("src/renderer/index.html");
  const toolbarIndex = html.indexOf('class="toolbar-card toolbar-floating-card"');
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', toolbarIndex);
  const undoIndex = html.indexOf('id="scheduleUndoButton"', toolbarIndex);
  const redoIndex = html.indexOf('id="scheduleRedoButton"', toolbarIndex);
  const gridIndex = html.indexOf('id="toolbarGrid"', toolbarIndex);
  assert.ok(toolbarIndex >= 0 && collapseIndex > toolbarIndex && undoIndex > collapseIndex && redoIndex > undoIndex && gridIndex > redoIndex);
  assert.equal(html.includes('class="toolbar-top-row"'), false);
  const filterIndex = html.indexOf('id="tableDeptScopeFilter"');
  const topUndoIndex = html.indexOf('id="scheduleUndoTopButton"');
  const topRedoIndex = html.indexOf('id="scheduleRedoTopButton"');
  assert.ok(filterIndex >= 0 && topUndoIndex > filterIndex && topRedoIndex > topUndoIndex);
  assert.match(html, /class="toolbar-history-actions schedule-nav-history-actions"/);
  assert.match(html, /toolbar-section-overtime" hidden/);
  assert.match(html, /id="tablePrevWeekButton"[^>]* hidden/);
  assert.match(html, /id="tableNextWeekButton"[^>]* hidden/);
});

test("班表週移動與例假排班顯示具有正式程式契約", () => {
  const actions = read("src/renderer/renderer-export-actions.js");
  const table = read("src/renderer/renderer-schedule-table.js");
  const cells = read("src/renderer/renderer-schedule-cells.js");
  const css = read("src/renderer/css/pages.css");
  const interaction = read("src/renderer/renderer-schedule-interaction.js");
  assert.match(actions, /function canChangeScheduleWindowWeeks\(weeks\)/);
  assert.match(actions, /maxStartDate: addDaysToDateString\(cycleStartDate, 49\)/);
  assert.match(actions, /button\.disabled = !canChangeScheduleWindowWeeks\(weeks\)/);
  assert.doesNotMatch(table, /regularHolidayWorkClass|regular-holiday-work-cell/);
  assert.match(cells, /function isRegularHolidayWorkSlot\(slot\)/);
  assert.doesNotMatch(cells, /renderRegularHolidayWorkIndicator|regular-holiday-work-indicator/);
  assert.match(cells, /renderShiftViewCell\(members, dateString\)/);
  assert.match(cells, /regular-holiday-work-seg/);
  assert.match(cells, /regular-holiday-work-member/);
  assert.match(css, /\.table-week-jump \{[\s\S]*?display: none !important;/);
  assert.match(css, /\.calendar-nav-left \.schedule-nav-history-actions \{[\s\S]*?display: inline-flex;/);
  assert.match(interaction, /function getScheduleUndoButtons\(\)/);
  assert.match(interaction, /scheduleUndoTopButton/);
  assert.match(interaction, /scheduleRedoTopButton/);
  assert.match(css, /\.table-sticky-cell-day\.sun:not\(\.today\)/);
  assert.match(css, /\.toolbar-floating-card \{[\s\S]*?grid-template-columns: 44px minmax\(0, 1fr\);/);
  assert.match(css, /\.toolbar-floating-card > \.toolbar-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1\.66fr\) minmax\(0, 0\.78fr\);/);
  assert.match(css, /\.toolbar-floating-card\.toolbar-floating-card-collapsed \{[\s\S]*?grid-template-rows: repeat\(3, auto\);/);
  assert.doesNotMatch(css, /\.cell\.regular-holiday-work-cell/);
  assert.doesNotMatch(css, /regular-holiday-work-indicator/);
  assert.match(css, /\.seg\.regular-holiday-work-seg \{[\s\S]*?background: #ffe58f !important;/);
  assert.match(css, /\.shift-view-member\.regular-holiday-work-member \{[\s\S]*?background: #ffe58f;/);
});
