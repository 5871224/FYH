const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("浮動工具列控制按鈕依新版版面排列", () => {
  const config = read("src/renderer/app-config.js");
  const docsConfig = read("docs/app-config.js");
  assert.equal(docsConfig, config, "發布 app-config.js 必須與來源一致");

  assert.match(config, /function installToolbarStackedLayout\(\)/);
  assert.match(config, /primaryRow\.append\(collapseButton, selectedPreview\)/);
  assert.match(config, /historyRow\.append\(undoButton, redoButton\)/);
  assert.match(config, /controlStack\.append\(primaryRow, historyRow\)/);
  assert.match(config, /grid-template-columns: minmax\(0, 1fr\) !important;/);
  assert.match(config, /grid-template-rows: auto auto !important;/);
  assert.match(config, /toolbar-section-combined[\s\S]*?grid-row: 1;/);
  assert.match(config, /toolbar-section-leave[\s\S]*?grid-row: 2;/);
  assert.match(config, /toolbar-floating-card #shiftChips,[\s\S]*?flex-wrap: nowrap !important;/);
  assert.match(config, /overflow-x: auto;/);
  assert.doesNotThrow(() => new Function(config), "app-config.js 必須可解析");
});
