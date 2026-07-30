from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    write(path, text.replace(old, new, 1))


# Move undo/redo beside the top-level display filter, and hide retained controls.
html_path = "src/renderer/index.html"
html = read(html_path)
history_start = html.index('        <div class="toolbar-history-actions" aria-label="班表操作歷程">')
collapse_start = html.index('        <button class="ghost-btn toolbar-collapse-toggle"', history_start)
html = html[:history_start] + html[collapse_start:]
filter_markup = '          <select id="tableDeptScopeFilter" aria-label="班表顯示範圍"></select>\n'
history_markup = '''          <select id="tableDeptScopeFilter" aria-label="班表顯示範圍"></select>
          <div class="toolbar-history-actions schedule-nav-history-actions" aria-label="班表操作歷程">
            <button class="ghost-btn toolbar-history-btn" id="scheduleUndoButton" type="button" aria-label="上一步（Ctrl+Z）" title="上一步（Ctrl+Z）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5"></path><path d="M5 12h8a6 6 0 0 1 6 6"></path></svg>
            </button>
            <button class="ghost-btn toolbar-history-btn" id="scheduleRedoButton" type="button" aria-label="下一步（Ctrl+Y）" title="下一步（Ctrl+Y）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l5 5-5 5"></path><path d="M19 12h-8a6 6 0 0 0-6 6"></path></svg>
            </button>
          </div>
'''
if html.count(filter_markup) != 1:
    raise SystemExit("src/renderer/index.html: table display filter not found exactly once")
html = html.replace(filter_markup, history_markup, 1)
html = html.replace(
    '        <div class="toolbar-section toolbar-section-overtime">',
    '        <div class="toolbar-section toolbar-section-overtime" hidden>',
    1,
)
html = html.replace(
    '<button class="table-week-jump table-week-jump-prev" id="tablePrevWeekButton" type="button"',
    '<button class="table-week-jump table-week-jump-prev" id="tablePrevWeekButton" type="button" hidden',
    1,
)
html = html.replace(
    '<button class="table-week-jump table-week-jump-next" id="tableNextWeekButton" type="button"',
    '<button class="table-week-jump table-week-jump-next" id="tableNextWeekButton" type="button" hidden',
    1,
)
write(html_path, html)

# Detect regular-holiday work in shift view.
replace_once(
    "src/renderer/renderer-schedule-cells.js",
    '''  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount
  };''',
    '''  const hasRegularHolidayWork = members.some((member) => {
    const slot = getDisplayedSlot(member.id, dateString);
    return Boolean(slot?.shift && isRegularRestLeaveId(slot.leave));
  });
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount,
    hasRegularHolidayWork
  };''',
)

# Add the yellow-state class in both table views and refresh week button states.
replace_once(
    "src/renderer/renderer-schedule-table.js",
    '''          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members)}</td>`;''',
    '''          html += `<td class="cell shift-view-cell ${inactiveClass} ${shiftViewCellState.isShortage ? "shift-view-shortage" : ""} ${shiftViewCellState.hasRegularHolidayWork ? "regular-holiday-work-cell" : ""} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-readonly="true" data-shift-id="${shift.id}" data-date="${dateString}">${renderShiftViewCell(shiftViewCellState.members)}</td>`;''',
)
replace_once(
    "src/renderer/renderer-schedule-table.js",
    '''            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            html += `<td class="cell ${previewClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;''',
    '''            const previewClass = previewSlot ? "auto-schedule-preview" : "";
            const regularHolidayWorkClass = displayedSlot?.shift && isRegularRestLeaveId(displayedSlot.leave)
              ? "regular-holiday-work-cell"
              : "";
            html += `<td class="cell ${previewClass} ${regularHolidayWorkClass} ${weekBoundaryClass} ${dateString === today ? "today" : ""}" data-member-id="${member.id}" data-date="${dateString}" data-row-index="${rowIndex}" data-col-index="${dateIndex}">${renderCellInner(key, member.id, dateString, displayedSlot, Boolean(previewSlot))}</td>`;''',
)
replace_once(
    "src/renderer/renderer-schedule-table.js",
    '''  document.getElementById("monthTitle").textContent = `${startDate} ～ ${endDate}`;
  renderAuthBar();''',
    '''  document.getElementById("monthTitle").textContent = `${startDate} ～ ${endDate}`;
  syncScheduleWeekNavigationButtons();
  renderAuthBar();''',
)

# Keep one-week movement inside the current configured eight-week cycle.
replace_once(
    "src/renderer/renderer-export-actions.js",
    '''async function changeScheduleWindowWeeks(weeks) {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}''',
    '''function getScheduleWeekNavigationBounds(startDate) {
  const cycleStartDate = getEightWeekCycleStartForDate(startDate);
  return {
    minStartDate: cycleStartDate,
    maxStartDate: addDaysToDateString(cycleStartDate, 49)
  };
}

function canChangeScheduleWindowWeeks(weeks) {
  if (Math.abs(weeks) !== 1) {
    return true;
  }
  const startDate = toDateObject(state.scheduleStartDate)
    ? state.scheduleStartDate
    : getEightWeekCycleStartForDate(getTodayDateString());
  const targetDate = addDaysToDateString(startDate, weeks * 7);
  const { minStartDate, maxStartDate } = getScheduleWeekNavigationBounds(startDate);
  return Boolean(targetDate && targetDate >= minStartDate && targetDate <= maxStartDate);
}

function syncScheduleWeekNavigationButtons() {
  const controls = [
    ["prevWeekButton", -1],
    ["tablePrevWeekButton", -1],
    ["nextWeekButton", 1],
    ["tableNextWeekButton", 1]
  ];
  controls.forEach(([id, weeks]) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !canChangeScheduleWindowWeeks(weeks);
    }
  });
}

async function changeScheduleWindowWeeks(weeks) {
  if (!canChangeScheduleWindowWeeks(weeks)) {
    syncScheduleWeekNavigationButtons();
    return;
  }
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  state.scheduleStartDate = addDaysToDateString(startDate, weeks * 7);
  syncVisibleDatePartsFromStart();
  await ensureVisibleScheduleLoaded();
  renderAll();
  await forceSave();
}''',
)

# Final CSS module overrides preserve the shared design system and generated bundle order.
pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
marker = "/* ===== 班表頁操作列與例假排班提示 ===== */"
if marker in pages:
    raise SystemExit("src/renderer/css/pages.css: schedule override already exists")
pages += '''

/* ===== 班表頁操作列與例假排班提示 ===== */
#toolbarCollapseToggle {
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--ui-accent-strong);
  border-radius: 14px;
  background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-strong) 100%);
  color: #fff;
  box-shadow: 0 8px 18px rgba(72, 52, 31, 0.2);
}

#toolbarCollapseToggle:not(:disabled):hover {
  background: linear-gradient(135deg, #ad7938 0%, #704718 100%);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(72, 52, 31, 0.26);
}

#toolbarCollapseToggle svg {
  width: 24px;
  height: 24px;
  stroke-width: 2.6;
}

.toolbar-floating-card:not(.toolbar-floating-card-collapsed) #toolbarCollapseToggle,
.toolbar-floating-card.toolbar-floating-card-collapsed #toolbarCollapseToggle {
  flex: 0 0 44px;
}

.calendar-nav-left .schedule-nav-history-actions {
  position: static;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.calendar-nav-left .toolbar-history-btn {
  width: var(--schedule-nav-control-height);
  min-width: var(--schedule-nav-control-height);
  height: var(--schedule-nav-control-height);
  min-height: var(--schedule-nav-control-height);
  border-radius: 12px;
}

.table-sticky-cell-day.sun:not(.today),
.table-sticky-cell-day.sat:not(.today),
.table-sticky-cell-day.sun:not(.today) span,
.table-sticky-cell-day.sat:not(.today) span {
  color: var(--text);
}

.table-week-jump {
  display: none !important;
}

.cell.regular-holiday-work-cell,
.cell.regular-holiday-work-cell .cell-inner,
.cell.regular-holiday-work-cell .seg,
.shift-view-cell.regular-holiday-work-cell .shift-view-member {
  background: #ffe58f !important;
  color: #2b241c !important;
}

.cell.regular-holiday-work-cell {
  box-shadow: inset 0 0 0 2px #d8a600;
}

.cell.regular-holiday-work-cell .seg {
  border-color: rgba(120, 88, 0, 0.24) !important;
}

@media (max-width: 768px) {
  .calendar-nav-left .schedule-nav-history-actions {
    flex: 0 0 auto;
  }

  #toolbarCollapseToggle {
    width: 42px;
    min-width: 42px;
    height: 42px;
    min-height: 42px;
  }
}
'''
write(pages_path, pages)

# Update the single formal specification.
replace_once("規格書.md", "**文件版本：** 2026-07-17", "**文件版本：** 2026-07-30")
replace_once("規格書.md", "**最後全面檢查：** 2026-07-17", "**最後全面檢查：** 2026-07-30")
replace_once(
    "規格書.md",
    "4. 浮動工具列右上角顯示「上一步」與「下一步」SVG 圖示按鈕。",
    "4. 班表上方「全部顯示」下拉選單右側顯示「上一步」與「下一步」SVG 圖示按鈕。",
)
replace_once(
    "規格書.md",
    "18. 匯出檔名包含選定的開始日期與結束日期。",
    """18. 匯出檔名包含選定的開始日期與結束日期。
19. 浮動工具列的班表加班區塊預設隱藏，但設定、資料、既有班表顯示與程式功能均保留。
20. 浮動工具列的收合／展開按鈕需比一般圖示按鈕更大並使用明顯的主色樣式。
21. 日期欄標題的週六、週日日期與星期文字均使用和平日相同的黑色字。
22. 「前一週」與「後一週」只能在目前八週週期內移動；到達週期起點或最後一個可移動週位時停用對應按鈕，不得跨到相鄰八週週期。
23. 日期欄標題左右兩側的前一週、後一週圖示按鈕預設隱藏，但事件與功能程式保留。
24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，該班表格底色改為黃色並維持文字可讀性。""",
)

# Add a focused regression contract for every requested behavior.
test_path = Path("tests/schedule-ui-update.test.js")
test_path.write_text(r'''const test = require("node:test");
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
''', encoding="utf-8")
