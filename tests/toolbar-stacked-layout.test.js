const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("浮動工具列控制按鈕直接由正式 HTML 與 CSS 排列", () => {
  const html = read("src/renderer/index.html");
  const css = read("src/renderer/css/pages.css");
  const docsHtml = read("docs/index.html");
  assert.equal(docsHtml, html, "發布 HTML 必須與來源一致");

  assert.match(html, /<div class="toolbar-control-primary">[\s\S]*?toolbarCollapseToggle[\s\S]*?toolbarSelectedPreview/);
  assert.match(html, /<div class="toolbar-control-history"[\s\S]*?scheduleUndoButton[\s\S]*?scheduleRedoButton/);
  assert.match(html, /<div class="toolbar-category-group">[\s\S]*?toolbar-section-combined[\s\S]*?toolbar-section-leave/);
  assert.match(css, /\.toolbar-category-group > \.toolbar-section-combined,[\s\S]*?flex-wrap: nowrap !important/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?flex-wrap: wrap !important/);
  assert.match(css, /bottom: 0 !important/);
});

test("班別與假別重新渲染後仍可快速連點開啟修改", () => {
  const events = read("src/renderer/renderer-events-click.js");
  assert.match(events, /const key = `\$\{type\}:\$\{id\}`/);
  assert.match(events, /now - toolbarRapidEditAt <= 550/);
  assert.match(events, /openToolbarChipEditor\(type, id\)/);
  assert.match(events, /openShiftFormModal\("edit", id\)/);
  assert.match(events, /openNamedColorFormModal\("leave", "edit", id\)/);
});

test("公開設定檢查不執行瀏覽器 DOM 初始化", () => {
  const checker = read("scripts/check-public-supabase.js");
  assert.match(checker, /addEventListener\(\) \{/);
  assert.match(checker, /只讀取 SCHEDULER_CONFIG/);
});
