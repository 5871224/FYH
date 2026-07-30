from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

config_path = ROOT / "src/renderer/app-config.js"
config = config_path.read_text(encoding="utf-8")

new_layout_function = r'''  function installToolbarStackedLayout() {
    const toolbar = document.querySelector(".toolbar-floating-card");
    const collapseButton = document.getElementById("toolbarCollapseToggle");
    const selectedPreview = document.getElementById("toolbarSelectedPreview");
    const undoButton = document.getElementById("scheduleUndoButton");
    const redoButton = document.getElementById("scheduleRedoButton");
    const toolbarGrid = document.getElementById("toolbarGrid");
    const shiftSection = toolbarGrid?.querySelector(".toolbar-section-combined");
    const leaveSection = toolbarGrid?.querySelector(".toolbar-section-leave");
    if (
      !toolbar
      || !collapseButton
      || !selectedPreview
      || !undoButton
      || !redoButton
      || !toolbarGrid
      || !shiftSection
      || !leaveSection
    ) {
      return;
    }

    if (!toolbar.querySelector(".toolbar-control-stack")) {
      const controlStack = document.createElement("div");
      controlStack.className = "toolbar-control-stack";

      const primaryRow = document.createElement("div");
      primaryRow.className = "toolbar-control-primary";
      primaryRow.append(collapseButton, selectedPreview);

      const historyRow = document.createElement("div");
      historyRow.className = "toolbar-control-history";
      historyRow.setAttribute("aria-label", "班表操作歷程");
      historyRow.append(undoButton, redoButton);

      controlStack.append(primaryRow, historyRow);
      toolbar.insertBefore(controlStack, toolbarGrid);
    }

    if (!toolbarGrid.querySelector(".toolbar-category-group")) {
      const categoryGroup = document.createElement("div");
      categoryGroup.className = "toolbar-category-group";
      toolbarGrid.insertBefore(categoryGroup, shiftSection);
      categoryGroup.append(shiftSection, leaveSection);
    }

    if (!document.getElementById("fyhToolbarStackedLayoutStyles")) {
      const style = document.createElement("style");
      style.id = "fyhToolbarStackedLayoutStyles";
      style.textContent = `
        .toolbar-floating-card {
          bottom: 0 !important;
          grid-template-columns: auto minmax(0, 1fr) !important;
          grid-template-rows: auto !important;
          align-items: start;
          gap: 4px 8px;
          max-height: min(38vh, 280px);
          overflow-x: hidden !important;
          overflow-y: auto !important;
          padding: 6px 8px !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }

        .toolbar-control-stack {
          grid-column: 1;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-width: 80px;
        }

        .toolbar-control-primary,
        .toolbar-control-history {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toolbar-control-stack #toolbarCollapseToggle,
        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton {
          position: static !important;
          box-sizing: border-box;
          width: 38px;
          min-width: 38px;
          margin: 0 !important;
          padding: 0;
        }

        .toolbar-control-stack #toolbarCollapseToggle {
          height: 38px;
          min-height: 38px;
          border: 1px solid var(--ui-accent-strong);
          border-radius: 10px;
          background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-strong) 100%);
          color: #fff;
          box-shadow: 0 5px 12px rgba(72, 52, 31, 0.18);
        }

        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton {
          height: 32px;
          min-height: 32px;
          border-radius: 8px;
          background: rgba(255, 253, 248, 0.96);
        }

        .toolbar-control-primary .toolbar-selected-preview {
          flex: 0 0 38px;
          width: 38px;
          min-width: 38px;
          height: 38px;
          min-height: 38px;
          padding: 3px;
          border-radius: 7px;
          font-size: 10px;
        }

        .toolbar-floating-card > .toolbar-grid {
          grid-column: 2;
          grid-row: 1 !important;
          display: block !important;
          width: 100%;
          min-width: 0;
        }

        .toolbar-category-group {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-width: 0;
          padding: 3px 6px;
          border: 1px solid rgba(156, 107, 47, 0.16);
          border-radius: 12px;
          background: var(--panel-strong);
        }

        .toolbar-category-group > .toolbar-section-combined,
        .toolbar-category-group > .toolbar-section-leave {
          display: flex !important;
          align-items: flex-start;
          flex-wrap: nowrap;
          gap: 5px;
          min-width: 0;
          padding: 4px 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }

        .toolbar-category-group > .toolbar-section-leave {
          margin-top: 2px;
          padding-top: 6px !important;
          border-top: 1px solid var(--schedule-grid-line, var(--line)) !important;
        }

        .toolbar-floating-card .toolbar-title-row,
        .toolbar-floating-card .toolbar-title-row-combined {
          display: flex !important;
          flex: 0 0 auto;
          align-items: center;
          flex-wrap: nowrap !important;
          gap: 4px;
          min-width: max-content;
          min-height: 30px;
        }

        .toolbar-floating-card .toolbar-title {
          font-size: 13px;
          line-height: 1.1;
        }

        .toolbar-floating-card .toolbar-settings-btn {
          width: 26px;
          min-width: 26px;
          height: 26px;
          min-height: 26px;
          flex-basis: 26px;
        }

        .toolbar-floating-card #deptFilter {
          width: 104px;
          min-width: 104px;
          max-width: 104px;
          height: 30px;
          padding: 4px 25px 4px 9px;
          border-radius: 9px;
          font-size: 12px;
        }

        .toolbar-floating-card #restComplianceButton {
          min-height: 28px;
          padding: 0 8px;
          border-radius: 8px;
          font-size: 12px;
        }

        .toolbar-floating-card #shiftChips,
        .toolbar-floating-card #leaveChips {
          display: flex !important;
          flex: 1 1 auto;
          align-items: center;
          flex-wrap: wrap !important;
          align-content: flex-start;
          gap: 4px;
          min-width: 0;
          min-height: 0;
          overflow: visible !important;
          padding: 2px 3px;
          scrollbar-width: none;
        }

        .toolbar-floating-card #shiftChips::-webkit-scrollbar,
        .toolbar-floating-card #leaveChips::-webkit-scrollbar {
          display: none;
        }

        .toolbar-floating-card #shiftChips .chip,
        .toolbar-floating-card #leaveChips .chip {
          flex: 0 0 auto;
          height: 30px;
          min-height: 30px;
          padding: 0 8px !important;
          border-radius: 6px !important;
          font-size: 12px;
          line-height: 1.1;
        }

        .toolbar-floating-card #shiftChips .chip.active,
        .toolbar-floating-card #leaveChips .chip.active {
          position: relative;
          z-index: 1;
          border-color: rgba(255, 255, 255, 0.96) !important;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.92),
            0 0 0 2px #3f2d1d !important;
          transform: none !important;
        }

        .toolbar-floating-card.toolbar-floating-card-collapsed {
          bottom: 0 !important;
          grid-template-columns: auto !important;
          grid-template-rows: auto !important;
          padding: 5px !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }

        .toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
          display: none !important;
        }

        @media (max-width: 768px) {
          .toolbar-floating-card {
            bottom: 0 !important;
            max-height: min(44dvh, 300px);
            padding: 5px 6px !important;
          }

          .toolbar-control-stack {
            min-width: 76px;
          }

          .toolbar-control-stack #toolbarCollapseToggle,
          .toolbar-control-stack #scheduleUndoButton,
          .toolbar-control-stack #scheduleRedoButton,
          .toolbar-control-primary .toolbar-selected-preview {
            width: 36px;
            min-width: 36px;
          }

          .toolbar-control-stack #toolbarCollapseToggle,
          .toolbar-control-primary .toolbar-selected-preview {
            height: 36px;
            min-height: 36px;
          }

          .toolbar-control-stack #scheduleUndoButton,
          .toolbar-control-stack #scheduleRedoButton {
            height: 30px;
            min-height: 30px;
          }

          .toolbar-category-group > .toolbar-section-combined,
          .toolbar-category-group > .toolbar-section-leave {
            gap: 4px;
          }

          .toolbar-floating-card #shiftChips .chip,
          .toolbar-floating-card #leaveChips .chip {
            height: 28px;
            min-height: 28px;
            padding-right: 7px !important;
            padding-left: 7px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }'''

pattern = re.compile(
    r"  function installToolbarStackedLayout\(\) \{.*?\n  function installToolbarRapidEdit\(\) \{",
    re.S,
)
replacement = new_layout_function + "\n\n  function installToolbarRapidEdit() {"
config, count = pattern.subn(replacement, config, count=1)
if count != 1:
    raise RuntimeError("找不到 installToolbarStackedLayout 區塊")
config_path.write_text(config, encoding="utf-8")

index_path = ROOT / "src/renderer/index.html"
index = index_path.read_text(encoding="utf-8")
index = index.replace(
    'chip.title = `雙擊修改班別：${chip.textContent.trim()}`;',
    'chip.removeAttribute("title");',
)
index = index.replace(
    'chip.title = `雙擊修改假別：${chip.textContent.trim()}`;',
    'chip.removeAttribute("title");',
)
if "雙擊修改班別" in index or "雙擊修改假別" in index:
    raise RuntimeError("雙擊修改提示文字仍存在")
index_path.write_text(index, encoding="utf-8")

spec_path = ROOT / "規格書.md"
spec = spec_path.read_text(encoding="utf-8")
spec = spec.replace(
    '4. 浮動工具列最左側整合直排操作鍵，最上方為收合／展開，下面依序為「上一步」與「下一步」SVG 圖示按鈕；班表最上方預設為「全部顯示」的下拉選單右側，另保留一組「上一步」與「下一步」SVG 圖示按鈕。',
    '4. 浮動工具列左側第一列為收合／展開按鈕與目前選中的班別或假別圖示，第二列為左右排列的「上一步」與「下一步」SVG 圖示按鈕；班表最上方預設為「全部顯示」的下拉選單右側，另保留一組「上一步」與「下一步」按鈕。',
)
spec = spec.replace(
    '20. 浮動工具列的收合／展開按鈕需比一般圖示按鈕更大並使用明顯的主色樣式；收合後仍保留左側直排的收合／展開、上一步與下一步按鈕。',
    '20. 浮動工具列的收合／展開按鈕需使用明顯主色；工具列固定貼齊視窗底部且不得保留底部空隙。收合後仍保留收合／展開、選中項目圖示、上一步與下一步按鈕。',
)
spec = spec.replace(
    '25. 浮動工具列隱藏加班區塊後，班別與假別區塊改為兩欄並撐滿右側全部可用寬度，不得保留原第三欄空白。',
    '25. 浮動工具列隱藏加班區塊後，班別與假別必須合併在同一個外框區塊內並上下排列，中間以單一水平格線分隔；不得保留原第三欄空白。\n26. 班別與假別按鈕不得顯示「雙擊修改」提示文字，但快速連點兩下開啟修改視窗的功能保留。按鈕使用緊湊內距，數量超出單行時自動換行，不得產生水平捲軸。選中班別或假別一律使用相同且明顯的雙層外框，外框不得被容器裁切。',
)
if "26. 班別與假別按鈕不得顯示" not in spec:
    raise RuntimeError("規格書更新失敗")
spec_path.write_text(spec, encoding="utf-8")

test_path = ROOT / "tests/toolbar-stacked-layout.test.js"
test_path.write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("浮動工具列使用緊湊合併版面", () => {
  const config = read("src/renderer/app-config.js");
  const docsConfig = read("docs/app-config.js");
  assert.equal(docsConfig, config, "發布 app-config.js 必須與來源一致");

  assert.match(config, /function installToolbarStackedLayout\(\)/);
  assert.match(config, /primaryRow\.append\(collapseButton, selectedPreview\)/);
  assert.match(config, /historyRow\.append\(undoButton, redoButton\)/);
  assert.match(config, /categoryGroup\.append\(shiftSection, leaveSection\)/);
  assert.match(config, /className = "toolbar-category-group"/);
  assert.match(config, /border-top: 1px solid var\(--schedule-grid-line, var\(--line\)\) !important;/);
  assert.match(config, /bottom: 0 !important;/);
  assert.match(config, /flex-wrap: wrap !important;/);
  assert.match(config, /overflow: visible !important;/);
  assert.doesNotMatch(config, /overflow-x: auto;/);
  assert.match(config, /height: 30px;/);
  assert.match(config, /padding: 0 8px !important;/);
  assert.match(config, /0 0 0 2px #3f2d1d !important;/);
  assert.doesNotThrow(() => new Function(config), "app-config.js 必須可解析");
});

test("班別與假別不顯示雙擊提示但保留快速連點修改", () => {
  const config = read("src/renderer/app-config.js");
  const html = read("src/renderer/index.html");
  const docsHtml = read("docs/index.html");
  assert.equal(docsHtml, html, "發布 index.html 必須與來源一致");

  assert.doesNotMatch(html, /雙擊修改班別|雙擊修改假別/);
  assert.match(html, /chip\.removeAttribute\("title"\)/);
  assert.match(config, /function installToolbarRapidEdit\(\)/);
  assert.match(config, /const key = `\$\{type\}:\$\{id\}`/);
  assert.match(config, /now - lastChipClickAt <= 550/);
  assert.match(config, /openShiftFormModal\("edit", id\)/);
  assert.match(config, /openNamedColorFormModal\("leave", "edit", id\)/);
});

test("公開設定檢查不執行瀏覽器 DOM 初始化", () => {
  const checker = read("scripts/check-public-supabase.js");
  assert.match(checker, /addEventListener\(\) \{/);
  assert.match(checker, /只讀取 SCHEDULER_CONFIG/);
});
''', encoding="utf-8")
