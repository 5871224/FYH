const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("班表浮動工具列使用正式 HTML 與 CSS 緊湊合併版面", () => {
  const config = read("src/renderer/app-config.js");
  const html = read("src/renderer/index.html");
  const css = read("src/renderer/css/pages.css");
  const docsConfig = read("docs/app-config.js");
  const docsHtml = read("docs/index.html");

  assert.equal(docsConfig, config, "發布設定必須與來源一致");
  assert.equal(docsHtml, html, "發布 HTML 必須與來源一致");
  assert.doesNotMatch(config, /\.mjs|document\.write/);
  assert.match(html, /class="toolbar-control-stack"/);
  assert.match(html, /class="toolbar-category-group"/);
  assert.match(css, /\.toolbar-category-group > \.toolbar-section-leave[\s\S]*?border-top: 1px solid var\(--schedule-grid-line, var\(--line\)\) !important/);
  assert.match(css, /bottom: 0 !important/);
  assert.match(css, /flex-wrap: wrap !important/);
  assert.match(css, /\.toolbar-floating-card #shiftChips,[\s\S]*?overflow: visible !important/);
  assert.doesNotMatch(css, /\.toolbar-floating-card #(?:shiftChips|leaveChips)[\s\S]{0,220}overflow-x: auto/);
  assert.match(css, /padding: 0 8px !important/);
  assert.match(css, /0 0 0 2px #3f2d1d !important/);
  assert.doesNotThrow(() => new Function(config), "公開設定必須可解析");
});

test("班別與假別移除提示但保留快速連點修改", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const clickEvents = read("src/renderer/renderer-events-click.js");

  assert.doesNotMatch(toolbar, /雙擊修改班別|雙擊修改假別/);
  assert.match(clickEvents, /function handleToolbarChipClick\(type, id\)/);
  assert.match(clickEvents, /now - toolbarRapidEditAt <= 550/);
  assert.match(clickEvents, /openShiftFormModal\("edit", id\)/);
  assert.match(clickEvents, /openNamedColorFormModal\("leave", "edit", id\)/);
});

test("正式前端不再發布或載入 mjs 後置覆寫模組", () => {
  const rendererFiles = fs.readdirSync(path.join(root, "src", "renderer"));
  const docsFiles = fs.readdirSync(path.join(root, "docs"));
  assert.deepEqual(rendererFiles.filter((name) => name.endsWith(".mjs")), []);
  assert.deepEqual(docsFiles.filter((name) => name.endsWith(".mjs")), []);
  assert.equal(rendererFiles.includes("groups.css"), false);
  assert.equal(docsFiles.includes("groups.css"), false);
});
