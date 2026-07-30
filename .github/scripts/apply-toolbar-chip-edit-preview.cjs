const fs = require("node:fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceOnce(content, before, after, label) {
  const index = content.indexOf(before);
  if (index < 0) throw new Error(`找不到修改位置：${label}`);
  if (content.indexOf(before, index + before.length) >= 0) throw new Error(`修改位置不唯一：${label}`);
  return content.slice(0, index) + after + content.slice(index + before.length);
}

let html = read("src/renderer/index.html");
html = replaceOnce(
  html,
  '    <section class="toolbar-card toolbar-floating-card">\n      <button class="ghost-btn toolbar-collapse-toggle" id="toolbarCollapseToggle"',
  '    <section class="toolbar-card toolbar-floating-card">\n      <div class="toolbar-selected-preview" id="toolbarSelectedPreview" hidden aria-live="polite"></div>\n      <button class="ghost-btn toolbar-collapse-toggle" id="toolbarCollapseToggle"',
  "選中項目預覽"
);
html = replaceOnce(
  html,
  '            <span class="toolbar-title">班別</span>\n             <select id="deptFilter"></select>\n             <button class="settings-icon-btn toolbar-settings-btn" id="shiftSettingsButton" type="button" aria-label="班別設定" title="班別設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>',
  '            <span class="toolbar-title">班別</span>\n             <button class="settings-icon-btn toolbar-settings-btn" id="shiftSettingsButton" type="button" aria-label="班別設定" title="班別設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>\n             <select id="deptFilter"></select>',
  "班別設定圖示位置"
);
html = replaceOnce(
  html,
  '            <span class="toolbar-title">假別</span>\n             <button class="ghost-btn compact-btn toolbar-inline-action" id="restComplianceButton" type="button">例休檢查</button>\n             <button class="settings-icon-btn toolbar-settings-btn" id="leaveSettingsButton" type="button" aria-label="假別設定" title="假別設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>',
  '            <span class="toolbar-title">假別</span>\n             <button class="settings-icon-btn toolbar-settings-btn" id="leaveSettingsButton" type="button" aria-label="假別設定" title="假別設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></button>\n             <button class="ghost-btn compact-btn toolbar-inline-action" id="restComplianceButton" type="button">例休檢查</button>',
  "假別設定圖示位置"
);
write("src/renderer/index.html", html);

let toolbar = read("src/renderer/renderer-schedule-toolbar.js");
toolbar = replaceOnce(
  toolbar,
  'function renderToolbar() {',
  `function renderSelectedToolbarPreview() {
  const preview = document.getElementById("toolbarSelectedPreview");
  const toolbarCard = preview?.closest(".toolbar-floating-card");
  if (!preview || !toolbarCard) {
    return;
  }
  const type = state.selected?.type || "";
  const id = state.selected?.id || "";
  const item = (type === "shift" || type === "leave") && id ? getItem(type, id) : null;
  toolbarCard.classList.toggle("toolbar-has-selection-preview", Boolean(item));
  if (!item) {
    preview.hidden = true;
    preview.textContent = "";
    preview.removeAttribute("title");
    preview.removeAttribute("aria-label");
    preview.style.backgroundColor = "";
    preview.style.color = "";
    preview.style.borderColor = "";
    return;
  }
  const categoryLabel = type === "shift" ? "班別" : "假別";
  const color = item.color || "#888780";
  const name = item.name || categoryLabel;
  preview.hidden = false;
  preview.style.backgroundColor = color;
  preview.style.color = getItemTextColor(item, color);
  preview.style.borderColor = color;
  preview.title = \`已選擇\${categoryLabel}：\${name}\`;
  preview.setAttribute("aria-label", preview.title);
  preview.innerHTML = \`<span class="toolbar-selected-preview-label">\${escapeHtml(name)}</span>\`;
}

function renderToolbar() {`,
  "選中項目預覽函式"
);
toolbar = replaceOnce(
  toolbar,
  '  renderChips("overtimeChips", "overtime", state.overtime.filter((item) => !item.hiddenFromToolbar));\n  syncRoleUi();',
  '  renderChips("overtimeChips", "overtime", state.overtime.filter((item) => !item.hiddenFromToolbar));\n  renderSelectedToolbarPreview();\n  syncRoleUi();',
  "更新選中項目預覽"
);
write("src/renderer/renderer-schedule-toolbar.js", toolbar);

let events = read("src/renderer/renderer-events-click.js");
events = replaceOnce(
  events,
  '  document.body.addEventListener("dblclick", (event) => {\n    const shiftMember = event.target.closest("[data-shift-schedule-member]");',
  `  document.body.addEventListener("dblclick", (event) => {
    const toolbarChip = event.target.closest("[data-chip-type][data-chip-id]");
    const chipType = toolbarChip?.dataset.chipType || "";
    const chipId = toolbarChip?.dataset.chipId || "";
    if (toolbarChip && chipId && (chipType === "shift" || chipType === "leave")) {
      event.preventDefault();
      event.stopPropagation();
      if (!canEditSchedule()) {
        promptManagerAccess(\`修改\${chipType === "shift" ? "班別" : "假別"}需先登入主管帳號\`);
        return;
      }
      state.selected = { type: chipType, id: chipId };
      renderToolbar();
      renderTable();
      if (chipType === "shift") {
        openShiftFormModal("edit", chipId);
      } else {
        openNamedColorFormModal("leave", "edit", chipId);
      }
      return;
    }
    const shiftMember = event.target.closest("[data-shift-schedule-member]");`,
  "班別假別雙擊修改"
);
write("src/renderer/renderer-events-click.js", events);

let css = read("src/renderer/css/pages.css");
css = replaceOnce(
  css,
  `.toolbar-floating-card > #toolbarCollapseToggle {
  grid-row: 1;`,
  `.toolbar-selected-preview {
  grid-column: 1;
  grid-row: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.08;
}

.toolbar-selected-preview-label {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.toolbar-floating-card .chips .chip {
  border-radius: 8px;
}

.toolbar-floating-card > #toolbarCollapseToggle {
  grid-row: 1;`,
  "選中項目預覽樣式"
);
css = replaceOnce(
  css,
  `.toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
  display: none !important;
}`,
  `.toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
  display: none !important;
}

.toolbar-floating-card.toolbar-has-selection-preview {
  grid-template-rows: auto auto auto 1fr;
}

.toolbar-floating-card.toolbar-has-selection-preview > #toolbarCollapseToggle {
  grid-row: 2;
}

.toolbar-floating-card.toolbar-has-selection-preview > #scheduleUndoButton {
  grid-row: 3;
}

.toolbar-floating-card.toolbar-has-selection-preview > #scheduleRedoButton {
  grid-row: 4;
}

.toolbar-floating-card.toolbar-has-selection-preview > .toolbar-grid {
  grid-row: 1 / span 4;
}

.toolbar-floating-card.toolbar-floating-card-collapsed.toolbar-has-selection-preview {
  grid-template-rows: repeat(4, auto);
}`,
  "選中項目預覽版面"
);
css = replaceOnce(
  css,
  `  .toolbar-floating-card > #toolbarCollapseToggle,
  .toolbar-floating-card > #scheduleUndoButton,
  .toolbar-floating-card > #scheduleRedoButton {
    width: 42px;
    min-width: 42px;
  }`,
  `  .toolbar-floating-card > #toolbarCollapseToggle,
  .toolbar-floating-card > #scheduleUndoButton,
  .toolbar-floating-card > #scheduleRedoButton,
  .toolbar-floating-card > #toolbarSelectedPreview {
    width: 42px;
    min-width: 42px;
  }

  .toolbar-floating-card > #toolbarSelectedPreview {
    height: 42px;
    min-height: 42px;
  }`,
  "手機選中項目預覽尺寸"
);
write("src/renderer/css/pages.css", css);

let spec = read("規格書.md");
spec = replaceOnce(
  spec,
  '25. 浮動工具列隱藏加班區塊後，班別與假別區塊改為兩欄並撐滿右側全部可用寬度，不得保留原第三欄空白。',
  `25. 浮動工具列隱藏加班區塊後，班別與假別區塊改為兩欄並撐滿右側全部可用寬度，不得保留原第三欄空白。
26. 浮動工具列中的班別與假別按鈕以單擊選取；主管或管理員雙擊具體班別時直接開啟該班別的「修改班別」視窗，雙擊具體假別時直接開啟該假別的「修改假別」視窗；「取消」按鈕不提供雙擊修改。
27. 班別設定鉛筆圖示緊接在「班別」標題右側，單位篩選選單排列於其後；假別設定鉛筆圖示緊接在「假別」標題右側，例休檢查按鈕排列於其後。
28. 浮動工具列中的班別與假別按鈕使用較小圓角的圓角矩形，不使用完整膠囊圓角。
29. 選中具體班別或假別時，縮放按鈕上方另顯示一個同底色、同文字色的選中項目圖示；未選取、選取取消功能或選取其他類型時隱藏。此圖示在工具列展開與收合狀態都必須保留。`,
  "工具列互動規格"
);
write("規格書.md", spec);

let test = read("tests/schedule-ui-update.test.js");
test = replaceOnce(
  test,
  `  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', toolbarIndex);
  const undoIndex = html.indexOf('id="scheduleUndoButton"', toolbarIndex);`,
  `  const previewIndex = html.indexOf('id="toolbarSelectedPreview"', toolbarIndex);
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', toolbarIndex);
  const undoIndex = html.indexOf('id="scheduleUndoButton"', toolbarIndex);`,
  "測試選中預覽順序"
);
test = replaceOnce(
  test,
  `  assert.ok(toolbarIndex >= 0 && collapseIndex > toolbarIndex && undoIndex > collapseIndex && redoIndex > undoIndex && gridIndex > redoIndex);`,
  `  assert.ok(toolbarIndex >= 0 && previewIndex > toolbarIndex && collapseIndex > previewIndex && undoIndex > collapseIndex && redoIndex > undoIndex && gridIndex > redoIndex);`,
  "測試工具列順序"
);
test += `

test("班表浮動工具列支援雙擊修改與選中圖示", () => {
  const html = read("src/renderer/index.html");
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const events = read("src/renderer/renderer-events-click.js");
  const css = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");
  const shiftTitle = html.indexOf('<span class="toolbar-title">班別</span>');
  const shiftEdit = html.indexOf('id="shiftSettingsButton"', shiftTitle);
  const shiftFilter = html.indexOf('id="deptFilter"', shiftTitle);
  const leaveTitle = html.indexOf('<span class="toolbar-title">假別</span>');
  const leaveEdit = html.indexOf('id="leaveSettingsButton"', leaveTitle);
  const compliance = html.indexOf('id="restComplianceButton"', leaveTitle);
  assert.ok(shiftTitle >= 0 && shiftEdit > shiftTitle && shiftFilter > shiftEdit);
  assert.ok(leaveTitle >= 0 && leaveEdit > leaveTitle && compliance > leaveEdit);
  assert.match(toolbar, /function renderSelectedToolbarPreview\(\)/);
  assert.match(toolbar, /toolbar-has-selection-preview/);
  assert.match(toolbar, /type === "shift" \|\| type === "leave"/);
  assert.match(events, /data-chip-type.*data-chip-id/);
  assert.match(events, /openShiftFormModal\("edit", chipId\)/);
  assert.match(events, /openNamedColorFormModal\("leave", "edit", chipId\)/);
  assert.match(css, /\.toolbar-floating-card \.chips \.chip \{\s*border-radius: 8px;/);
  assert.match(css, /\.toolbar-selected-preview \{[\s\S]*?grid-row: 1;[\s\S]*?border-radius: 8px;/);
  assert.match(css, /\.toolbar-floating-card\.toolbar-has-selection-preview > #toolbarCollapseToggle \{\s*grid-row: 2;/);
  assert.match(css, /toolbar-floating-card-collapsed\.toolbar-has-selection-preview[\s\S]*?repeat\(4, auto\)/);
  assert.match(spec, /雙擊具體班別時直接開啟該班別的「修改班別」視窗/);
  assert.match(spec, /縮放按鈕上方另顯示一個同底色、同文字色的選中項目圖示/);
});
`;
write("tests/schedule-ui-update.test.js", test);

console.log("已套用浮動工具列雙擊修改、標題圖示位置、圓角與選中預覽修改");
