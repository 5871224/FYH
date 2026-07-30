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


# Integrate collapse, undo and redo buttons directly into the floating toolbar.
html_path = "src/renderer/index.html"
html = read(html_path)
old_toolbar_start = '''    <section class="toolbar-card toolbar-floating-card">
      <div class="toolbar-top-row">
        <button class="ghost-btn toolbar-collapse-toggle" id="toolbarCollapseToggle" type="button" aria-expanded="true" aria-label="收合工具列" title="收合工具列">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
        </button>
      </div>
      <div class="toolbar-grid" id="toolbarGrid" style="display:none">'''
new_toolbar_start = '''    <section class="toolbar-card toolbar-floating-card">
      <button class="ghost-btn toolbar-collapse-toggle" id="toolbarCollapseToggle" type="button" aria-expanded="true" aria-label="收合工具列" title="收合工具列">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
      </button>
      <button class="ghost-btn toolbar-history-btn" id="scheduleUndoButton" type="button" aria-label="上一步（Ctrl+Z）" title="上一步（Ctrl+Z）" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5"></path><path d="M5 12h8a6 6 0 0 1 6 6"></path></svg>
      </button>
      <button class="ghost-btn toolbar-history-btn" id="scheduleRedoButton" type="button" aria-label="下一步（Ctrl+Y）" title="下一步（Ctrl+Y）" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l5 5-5 5"></path><path d="M19 12h-8a6 6 0 0 0-6 6"></path></svg>
      </button>
      <div class="toolbar-grid" id="toolbarGrid" style="display:none">'''
if html.count(old_toolbar_start) != 1:
    raise SystemExit("src/renderer/index.html: old standalone toolbar row not found exactly once")
html = html.replace(old_toolbar_start, new_toolbar_start, 1)

old_nav_history = '''          <div class="toolbar-history-actions schedule-nav-history-actions" aria-label="班表操作歷程">
            <button class="ghost-btn toolbar-history-btn" id="scheduleUndoButton" type="button" aria-label="上一步（Ctrl+Z）" title="上一步（Ctrl+Z）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5"></path><path d="M5 12h8a6 6 0 0 1 6 6"></path></svg>
            </button>
            <button class="ghost-btn toolbar-history-btn" id="scheduleRedoButton" type="button" aria-label="下一步（Ctrl+Y）" title="下一步（Ctrl+Y）" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l5 5-5 5"></path><path d="M19 12h-8a6 6 0 0 0-6 6"></path></svg>
            </button>
          </div>
'''
if html.count(old_nav_history) != 1:
    raise SystemExit("src/renderer/index.html: schedule navigation history controls not found exactly once")
html = html.replace(old_nav_history, "", 1)
write(html_path, html)


# Replace the prior positioning overrides with the integrated left action rail.
pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
old_css = '''#toolbarCollapseToggle {
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
'''
new_css = '''.toolbar-floating-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  grid-template-rows: auto auto 1fr;
  align-items: start;
  gap: 8px 12px;
}

.toolbar-floating-card > #toolbarCollapseToggle,
.toolbar-floating-card > #scheduleUndoButton,
.toolbar-floating-card > #scheduleRedoButton {
  position: static !important;
  grid-column: 1;
  box-sizing: border-box;
  width: 44px;
  min-width: 44px;
  margin: 0 !important;
  padding: 0;
}

.toolbar-floating-card > #toolbarCollapseToggle {
  grid-row: 1;
  height: 44px;
  min-height: 44px;
  border: 1px solid var(--ui-accent-strong);
  border-radius: 14px;
  background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-strong) 100%);
  color: #fff;
  box-shadow: 0 8px 18px rgba(72, 52, 31, 0.2);
}

.toolbar-floating-card > #scheduleUndoButton {
  grid-row: 2;
}

.toolbar-floating-card > #scheduleRedoButton {
  grid-row: 3;
}

.toolbar-floating-card > #scheduleUndoButton,
.toolbar-floating-card > #scheduleRedoButton {
  height: 40px;
  min-height: 40px;
  border-radius: 12px;
  background: rgba(255, 253, 248, 0.96);
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

.toolbar-floating-card > .toolbar-grid {
  grid-column: 2;
  grid-row: 1 / span 3;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1.66fr) minmax(0, 0.78fr);
}

.toolbar-floating-card > .toolbar-grid > .toolbar-section-combined,
.toolbar-floating-card > .toolbar-grid > .toolbar-section-leave {
  min-width: 0;
}

.toolbar-floating-card.toolbar-floating-card-collapsed {
  display: grid;
  grid-template-columns: 44px;
  grid-template-rows: repeat(3, auto);
  gap: 8px;
  padding: 8px;
}

.toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
  display: none !important;
}
'''
if pages.count(old_css) != 1:
    raise SystemExit("src/renderer/css/pages.css: previous toolbar override block not found exactly once")
pages = pages.replace(old_css, new_css, 1)
old_mobile = '''@media (max-width: 768px) {
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
new_mobile = '''@media (max-width: 768px) {
  .toolbar-floating-card {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 8px;
  }

  .toolbar-floating-card > #toolbarCollapseToggle,
  .toolbar-floating-card > #scheduleUndoButton,
  .toolbar-floating-card > #scheduleRedoButton {
    width: 42px;
    min-width: 42px;
  }

  .toolbar-floating-card > #toolbarCollapseToggle {
    height: 42px;
    min-height: 42px;
  }

  .toolbar-floating-card > .toolbar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-floating-card.toolbar-floating-card-collapsed {
    grid-template-columns: 42px;
  }
}
'''
if pages.count(old_mobile) != 1:
    raise SystemExit("src/renderer/css/pages.css: previous mobile toolbar override not found exactly once")
pages = pages.replace(old_mobile, new_mobile, 1)
write(pages_path, pages)


# Update regression tests to lock the integrated toolbar contract.
test_path = "tests/schedule-ui-update.test.js"
test_text = read(test_path)
old_test = '''test("班表操作列與保留功能符合新介面契約", () => {
  const html = read("src/renderer/index.html");
  const filterIndex = html.indexOf('id="tableDeptScopeFilter"');
  const undoIndex = html.indexOf('id="scheduleUndoButton"');
  const redoIndex = html.indexOf('id="scheduleRedoButton"');
  assert.ok(filterIndex >= 0 && undoIndex > filterIndex && redoIndex > undoIndex);
  assert.match(html, /toolbar-section-overtime" hidden/);
  assert.match(html, /id="tablePrevWeekButton"[^>]* hidden/);
  assert.match(html, /id="tableNextWeekButton"[^>]* hidden/);
});'''
new_test = '''test("班表浮動工具列使用整合式左側操作列", () => {
  const html = read("src/renderer/index.html");
  const toolbarIndex = html.indexOf('class="toolbar-card toolbar-floating-card"');
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', toolbarIndex);
  const undoIndex = html.indexOf('id="scheduleUndoButton"', toolbarIndex);
  const redoIndex = html.indexOf('id="scheduleRedoButton"', toolbarIndex);
  const gridIndex = html.indexOf('id="toolbarGrid"', toolbarIndex);
  assert.ok(toolbarIndex >= 0 && collapseIndex > toolbarIndex && undoIndex > collapseIndex && redoIndex > undoIndex && gridIndex > redoIndex);
  assert.equal(html.includes('class="toolbar-top-row"'), false);
  assert.equal(html.includes("schedule-nav-history-actions"), false);
  assert.match(html, /toolbar-section-overtime" hidden/);
  assert.match(html, /id="tablePrevWeekButton"[^>]* hidden/);
  assert.match(html, /id="tableNextWeekButton"[^>]* hidden/);
});'''
if test_text.count(old_test) != 1:
    raise SystemExit("tests/schedule-ui-update.test.js: previous toolbar test not found exactly once")
test_text = test_text.replace(old_test, new_test, 1)
test_text = test_text.replace(
    '  assert.match(css, /#toolbarCollapseToggle \\{[\\s\\S]*?width: 44px;/);',
    '  assert.match(css, /\\.toolbar-floating-card \\{[\\s\\S]*?grid-template-columns: 44px minmax\\(0, 1fr\\);/);\n  assert.match(css, /\\.toolbar-floating-card > \\.toolbar-grid \\{[\\s\\S]*?grid-template-columns: minmax\\(0, 1\\.66fr\\) minmax\\(0, 0\\.78fr\\);/);\n  assert.match(css, /\\.toolbar-floating-card\\.toolbar-floating-card-collapsed \\{[\\s\\S]*?grid-template-rows: repeat\\(3, auto\\);/);'
)
write(test_path, test_text)


# Keep the formal specification aligned with the implemented toolbar layout.
spec_path = "規格書.md"
spec = read(spec_path)
spec = spec.replace(
    "4. 班表上方「全部顯示」下拉選單右側顯示「上一步」與「下一步」SVG 圖示按鈕。",
    "4. 浮動工具列最左側整合直排操作鍵，最上方為收合／展開，下面依序為「上一步」與「下一步」SVG 圖示按鈕；三者直接屬於浮動工具列，不使用獨立的上方控制列。",
    1,
)
spec = spec.replace(
    "20. 浮動工具列的收合／展開按鈕需比一般圖示按鈕更大並使用明顯的主色樣式。",
    "20. 浮動工具列的收合／展開按鈕需比一般圖示按鈕更大並使用明顯的主色樣式；收合後仍保留左側直排的收合／展開、上一步與下一步按鈕。",
    1,
)
spec = spec.replace(
    "24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，該班表格底色改為黃色並維持文字可讀性。",
    "24. 人員檢視與班別檢視中，例假（代碼 0036）當日同時排有班別時，該班表格底色改為黃色並維持文字可讀性。\n25. 浮動工具列隱藏加班區塊後，班別與假別區塊改為兩欄並撐滿右側全部可用寬度，不得保留原第三欄空白。",
    1,
)
write(spec_path, spec)
