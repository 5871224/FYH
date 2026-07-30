const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 此檔同時確認來源版、GitHub Pages 發布版與快速連點功能契約。
const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("班表浮動工具列使用緊湊合併版面", () => {
  const loader = read("src/renderer/app-config.js");
  const base = read("src/renderer/app-config-base.mjs");
  const compact = read("src/renderer/toolbar-compact.mjs");
  const docsLoader = read("docs/app-config.js");
  const docsBase = read("docs/app-config-base.mjs");
  const docsCompact = read("docs/toolbar-compact.mjs");

  assert.equal(docsLoader, loader, "發布設定載入器必須與來源一致");
  assert.equal(docsBase, base, "發布基礎設定必須與來源一致");
  assert.equal(docsCompact, compact, "發布緊湊工具列模組必須與來源一致");
  assert.match(loader, /app-config-base\.mjs/);
  assert.match(loader, /toolbar-compact\.mjs/);
  assert.match(compact, /className = "toolbar-category-group"/);
  assert.match(compact, /categoryGroup\.append\(shiftSection, leaveSection\)/);
  assert.match(compact, /border-top: 1px solid var\(--schedule-grid-line, var\(--line\)\) !important/);
  assert.match(compact, /bottom: 0 !important/);
  assert.match(compact, /flex-wrap: wrap !important/);
  assert.match(compact, /overflow: visible !important/);
  assert.doesNotMatch(compact, /overflow-x: auto/);
  assert.match(compact, /padding: 0 8px !important/);
  assert.match(compact, /0 0 0 2px #3f2d1d !important/);
  assert.doesNotThrow(() => new Function(loader), "設定載入器必須可解析");
  assert.doesNotThrow(() => new Function(compact), "緊湊工具列模組必須可解析");
});

test("班別與假別移除提示但保留快速連點修改", () => {
  const base = read("src/renderer/app-config-base.mjs");
  const compact = read("src/renderer/toolbar-compact.mjs");

  assert.match(compact, /removeAttribute\("title"\)/);
  assert.match(compact, /renderToolbarWithoutDoubleClickHints/);
  assert.match(base, /function installToolbarRapidEdit\(\)/);
  assert.match(base, /now - lastChipClickAt <= 550/);
  assert.match(base, /openShiftFormModal\("edit", id\)/);
  assert.match(base, /openNamedColorFormModal\("leave", "edit", id\)/);
});

test("mjs 啟動模組由靜態發布自動複製且不進入 app.js 清單", () => {
  const publisher = read("scripts/publish-static-web.js");
  const builder = read("scripts/build-js.js");
  assert.match(publisher, /entry\.name\.endsWith\("\.js"\)/);
  assert.doesNotMatch(builder, /app-config-base\.mjs|toolbar-compact\.mjs/);
});
