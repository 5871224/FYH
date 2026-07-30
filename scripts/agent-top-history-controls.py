from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


# Add a second undo/redo control group beside the top "全部顯示" selector.
index_path = "src/renderer/index.html"
html = read(index_path)
old_nav = '''          <select id="tableViewSelect" aria-label="班表檢視"><option value="member">人員檢視</option><option value="member-stats">人員檢視-統計欄</option><option value="shift">班別檢視</option></select>
          <select id="tableDeptScopeFilter" aria-label="班表顯示範圍"></select>
'''
new_nav = '''          <select id="tableViewSelect" aria-label="班表檢視"><option value="member">人員檢視</option><option value="member-stats">人員檢視-統計欄</option><option value="shift">班別檢視</option></select>
          <select id="tableDeptScopeFilter" aria-label="班表顯示範圍"></select>
          <div class="toolbar-history-actions schedule-nav-history-actions" aria-label="班表操作歷程">
            <button class="ghost-btn toolbar-history-btn" id="scheduleUndoTopButton" type="button" aria-label="上一步（Ctrl+Z）" title="上一步（Ctrl+Z）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5"></path><path d="M5 12h8a6 6 0 0 1 6 6"></path></svg>
            </button>
            <button class="ghost-btn toolbar-history-btn" id="scheduleRedoTopButton" type="button" aria-label="下一步（Ctrl+Y）" title="下一步（Ctrl+Y）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l5 5-5 5"></path><path d="M19 12h-8a6 6 0 0 0-6 6"></path></svg>
            </button>
          </div>
'''
if html.count(old_nav) != 1:
    raise SystemExit("src/renderer/index.html: top schedule selector block not found exactly once")
html = html.replace(old_nav, new_nav, 1)
write(index_path, html)


# Keep both toolbar and top control groups synchronized and wired to the same history.
interaction_path = "src/renderer/renderer-schedule-interaction.js"
interaction = read(interaction_path)
old_getters = '''function getScheduleUndoButton() {
  return document.getElementById("scheduleUndoButton");
}

function getScheduleRedoButton() {
  return document.getElementById("scheduleRedoButton");
}

function syncScheduleHistoryButtons() {
  const editable = typeof canEditSchedule === "function" && canEditSchedule();
  const undoButton = getScheduleUndoButton();
  const redoButton = getScheduleRedoButton();
  if (undoButton) {
    undoButton.disabled = scheduleHistoryBusy || !editable || scheduleUndoStack.length === 0;
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  }
  if (redoButton) {
    redoButton.disabled = scheduleHistoryBusy || !editable || scheduleRedoStack.length === 0;
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
  }
}
'''
new_getters = '''function getScheduleUndoButtons() {
  return ["scheduleUndoButton", "scheduleUndoTopButton"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function getScheduleRedoButtons() {
  return ["scheduleRedoButton", "scheduleRedoTopButton"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function syncScheduleHistoryButtons() {
  const editable = typeof canEditSchedule === "function" && canEditSchedule();
  getScheduleUndoButtons().forEach((button) => {
    button.disabled = scheduleHistoryBusy || !editable || scheduleUndoStack.length === 0;
    button.setAttribute("aria-disabled", String(button.disabled));
  });
  getScheduleRedoButtons().forEach((button) => {
    button.disabled = scheduleHistoryBusy || !editable || scheduleRedoStack.length === 0;
    button.setAttribute("aria-disabled", String(button.disabled));
  });
}
'''
if interaction.count(old_getters) != 1:
    raise SystemExit("renderer-schedule-interaction.js: history getter block not found exactly once")
interaction = interaction.replace(old_getters, new_getters, 1)
old_bind = '''function bindScheduleHistoryControls() {
  getScheduleUndoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void undoSchedule();
  });
  getScheduleRedoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void redoSchedule();
  });
  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncScheduleHistoryButtons
  };
  syncScheduleHistoryButtons();
}
'''
new_bind = '''function bindScheduleHistoryControls() {
  getScheduleUndoButtons().forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void undoSchedule();
    });
  });
  getScheduleRedoButtons().forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void redoSchedule();
    });
  });
  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncScheduleHistoryButtons
  };
  syncScheduleHistoryButtons();
}
'''
if interaction.count(old_bind) != 1:
    raise SystemExit("renderer-schedule-interaction.js: history binding block not found exactly once")
interaction = interaction.replace(old_bind, new_bind, 1)
write(interaction_path, interaction)


# Style the top mirror controls to match the selector row.
pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
marker = '''.table-week-jump {
  display: none !important;
}

'''
addition = '''.table-week-jump {
  display: none !important;
}

.calendar-nav-left .schedule-nav-history-actions {
  position: static;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  margin: 0;
}

.calendar-nav-left .schedule-nav-history-actions .toolbar-history-btn {
  width: var(--schedule-nav-control-height);
  min-width: var(--schedule-nav-control-height);
  height: var(--schedule-nav-control-height);
  min-height: var(--schedule-nav-control-height);
  padding: 0;
  border-radius: 12px;
}

'''
if pages.count(marker) != 1:
    raise SystemExit("pages.css: table week jump marker not found exactly once")
pages = pages.replace(marker, addition, 1)
write(pages_path, pages)


# Update regression coverage.
test_path = "tests/schedule-ui-update.test.js"
test_text = read(test_path)
test_text = test_text.replace(
    '  assert.equal(html.includes("schedule-nav-history-actions"), false);',
    '''  const filterIndex = html.indexOf('id="tableDeptScopeFilter"');
  const topUndoIndex = html.indexOf('id="scheduleUndoTopButton"');
  const topRedoIndex = html.indexOf('id="scheduleRedoTopButton"');
  assert.ok(filterIndex >= 0 && topUndoIndex > filterIndex && topRedoIndex > topUndoIndex);
  assert.match(html, /class="toolbar-history-actions schedule-nav-history-actions"/);''',
    1,
)
test_text = test_text.replace(
    '  const css = read("src/renderer/css/pages.css");',
    '  const css = read("src/renderer/css/pages.css");\n  const interaction = read("src/renderer/renderer-schedule-interaction.js");',
    1,
)
test_text = test_text.replace(
    '  assert.match(css, /\\.table-week-jump \\{[\\s\\S]*?display: none !important;/);',
    '''  assert.match(css, /\\.table-week-jump \\{[\\s\\S]*?display: none !important;/);
  assert.match(css, /\\.calendar-nav-left \\.schedule-nav-history-actions \\{[\\s\\S]*?display: inline-flex;/);
  assert.match(interaction, /function getScheduleUndoButtons\\(\\)/);
  assert.match(interaction, /scheduleUndoTopButton/);
  assert.match(interaction, /scheduleRedoTopButton/);''',
    1,
)
write(test_path, test_text)


# Keep the formal specification synchronized.
spec_path = "規格書.md"
spec = read(spec_path)
old_spec = "4. 浮動工具列最左側整合直排操作鍵，最上方為收合／展開，下面依序為「上一步」與「下一步」SVG 圖示按鈕；三者直接屬於浮動工具列，不使用獨立的上方控制列。"
new_spec = "4. 浮動工具列最左側整合直排操作鍵，最上方為收合／展開，下面依序為「上一步」與「下一步」SVG 圖示按鈕；班表最上方預設為「全部顯示」的下拉選單右側，另保留一組「上一步」與「下一步」SVG 圖示按鈕。"
if spec.count(old_spec) != 1:
    raise SystemExit("規格書.md: toolbar history rule not found exactly once")
spec = spec.replace(old_spec, new_spec, 1)
write(spec_path, spec)
