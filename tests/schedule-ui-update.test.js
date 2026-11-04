const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表浮動工具列使用整合式左側操作列", () => {
  const html = read("src/renderer/index.html");
  const toolbarIndex = html.indexOf('class="toolbar-card toolbar-floating-card"');
  const controlStackIndex = html.indexOf('class="toolbar-control-stack"', toolbarIndex);
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', toolbarIndex);
  const undoIndex = html.indexOf('id="scheduleUndoButton"', toolbarIndex);
  const redoIndex = html.indexOf('id="scheduleRedoButton"', toolbarIndex);
  const gridIndex = html.indexOf('id="toolbarGrid"', toolbarIndex);
  assert.ok(toolbarIndex >= 0 && controlStackIndex > toolbarIndex && collapseIndex > controlStackIndex && undoIndex > collapseIndex && redoIndex > undoIndex && gridIndex > redoIndex);
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

test("班表週捲動與例假排班顯示具有正式程式契約", () => {
  const actions = read("src/renderer/renderer-export-actions.js");
  const events = read("src/renderer/renderer-events-toolbar.js");
  const table = read("src/renderer/renderer-schedule-table.js");
  const cells = read("src/renderer/renderer-schedule-cells.js");
  const css = read("src/renderer/css/schedule.css");
  const interaction = read("src/renderer/renderer-schedule-interaction.js");
  assert.match(actions, /const SCHEDULE_WEEK_SCROLL_DAYS = 7;/);
  assert.match(actions, /function canScrollScheduleByWeeks\(weeks\)/);
  assert.match(actions, /function scrollScheduleByWeeks\(weeks\)/);
  assert.match(actions, /maxScrollLeft: Math\.max\(0, tableWrap\.scrollWidth - tableWrap\.clientWidth\)/);
  assert.match(actions, /button\.disabled = !canScrollScheduleByWeeks\(weeks\)/);
  assert.match(events, /bindClick\("prevWeekButton", \(\) => scrollScheduleByWeeks\(-1\)\)/);
  assert.match(events, /bindClick\("nextWeekButton", \(\) => scrollScheduleByWeeks\(1\)\)/);
  assert.doesNotMatch(table, /regularHolidayWorkClass|regular-holiday-work-cell/);
  assert.match(cells, /function isRegularHolidayWorkSlot\(slot\)/);
  assert.doesNotMatch(cells, /renderRegularHolidayWorkIndicator|regular-holiday-work-indicator/);
  assert.match(cells, /renderShiftViewCell\(members, dateString\)/);
  assert.match(cells, /regular-holiday-work-seg/);
  assert.match(cells, /regular-holiday-work-member/);
  assert.match(css, /\.table-week-jump \{[\s\S]*?display: none;/);
  assert.match(css, /\.calendar-nav-left \.schedule-nav-history-actions \{[\s\S]*?display: inline-flex;/);
  assert.match(interaction, /function getScheduleUndoButtons\(\)/);
  assert.match(interaction, /scheduleUndoTopButton/);
  assert.match(interaction, /scheduleRedoTopButton/);
  assert.match(css, /\.table-sticky-cell-day\.sun:not\(\.today\)/);
  assert.match(css, /\.toolbar-floating-card \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\);/);
  assert.match(css, /\.toolbar-control-stack \{[\s\S]*?flex-direction: column;/);
  assert.match(css, /\.toolbar-floating-card > \.toolbar-grid \{[\s\S]*?display: block;/);
  assert.match(css, /\.toolbar-category-group \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.toolbar-floating-card\.toolbar-floating-card-collapsed \{[\s\S]*?grid-template-columns: auto;/);
  assert.doesNotMatch(css, /\.cell\.regular-holiday-work-cell/);
  assert.doesNotMatch(css, /regular-holiday-work-indicator/);
  assert.match(css, /\.seg\.regular-holiday-work-seg \{\s*background: #ffe58f;\s*\}/);
  assert.match(css, /\.shift-view-member\.regular-holiday-work-member \{\s*background: #ffe58f;\s*\}/);
});

test("上方水平捲軸不產生多餘留白且使用透明軌道與淺色主題滑塊", () => {
  const css = read("src/renderer/css/foundation.css");
  assert.match(css, /--schedule-top-scrollbar-height: 10px;/);
  assert.match(css, /\.table-top-scrollbar \{[\s\S]*?margin-top: calc\(-1 \* var\(--schedule-top-scrollbar-height\)\);/);
  assert.match(css, /\.table-top-scrollbar \{[\s\S]*?background: transparent;/);
  assert.match(css, /\.table-top-scrollbar \{[\s\S]*?scrollbar-color: var\(--schedule-scrollbar-thumb\) transparent;/);
  assert.match(css, /\.table-top-scrollbar::-webkit-scrollbar-track,[\s\S]*?background: transparent;/);
  assert.match(css, /\.table-sticky-header \{\s*position: relative;/);
});

test("浮動工具列縮放鍵與右側編輯 SVG 按鈕同為 34px", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const schedule = read("src/renderer/css/schedule.css");
  const components = read("src/renderer/css/components.css");
  assert.match(foundation, /\.toolbar-collapse-toggle \{[\s\S]*?width: 34px;[\s\S]*?height: 34px;[\s\S]*?flex: 0 0 34px;/);
  assert.match(schedule, /\.toolbar-floating-card:not\(\.toolbar-floating-card-collapsed\) \.toolbar-collapse-toggle \{[\s\S]*?flex: 0 0 34px;/);
  assert.match(components, /\.settings-icon-btn \{\s*width: 34px;\s*height: 34px;/);
});

test("班表導覽列、水平捲軸和日期欄一同固定，不需計算標題高度", () => {
  const html = read("src/renderer/index.html");
  const foundation = read("src/renderer/css/foundation.css");
  const components = read("src/renderer/css/components.css");
  const wrapper = html.indexOf('class="schedule-sticky-head"');
  const nav = html.indexOf('class="calendar-nav"', wrapper);
  const scroll = html.indexOf('id="tableTopScrollbar"', nav);
  const dates = html.indexOf('id="tableStickyHeader"', scroll);
  const table = html.indexOf('id="tableWrap"', dates);
  assert.ok(wrapper > 0 && nav > wrapper && scroll > nav && dates > scroll && table > dates);
  assert.match(foundation, /\.schedule-sticky-head \{\s*position: sticky;\s*top: 0;\s*z-index: 30;/);
  assert.match(foundation, /\.table-top-scrollbar \{\s*position: relative;/);
  assert.match(foundation, /\.table-sticky-header \{\s*position: relative;/);
  assert.doesNotMatch(components, /\.table-sticky-header \{\s*top: 0;/);
});

test("固定標題區圓角外側使用頁面底色，不出現淺白色直角", () => {
  const css = read("src/renderer/css/foundation.css");
  const match = css.match(/\.schedule-sticky-head \{([^}]+)\}/);
  assert.ok(match, "找不到固定標題區 CSS");
  assert.match(match[1], /background: var\(--bg\);/);
  assert.doesNotMatch(match[1], /background: var\(--schedule-header-bg\);/);
  assert.match(css, /\.calendar-nav \{[\s\S]*?border-radius: var\(--schedule-radius\) var\(--schedule-radius\) 0 0;/);
});
