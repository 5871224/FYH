const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("浮動工具列控制按鈕依新版版面排列", () => {
  const base = read("src/renderer/app-config-base.mjs");
  const compact = read("src/renderer/toolbar-compact.mjs");
  const docsBase = read("docs/app-config-base.mjs");
  const docsCompact = read("docs/toolbar-compact.mjs");
  assert.equal(docsBase, base, "發布基礎設定必須與來源一致");
  assert.equal(docsCompact, compact, "發布緊湊工具列模組必須與來源一致");

  assert.match(base, /function installToolbarStackedLayout\(\)/);
  assert.match(base, /primaryRow\.append\(collapseButton, selectedPreview\)/);
  assert.match(base, /historyRow\.append\(undoButton, redoButton\)/);
  assert.match(compact, /className = "toolbar-category-group"/);
  assert.match(compact, /categoryGroup\.append\(shiftSection, leaveSection\)/);
  assert.match(compact, /flex-wrap: wrap !important/);
  assert.match(compact, /bottom: 0 !important/);
  assert.doesNotThrow(() => new Function(base), "app-config-base.mjs 必須可解析");
  assert.doesNotThrow(() => new Function(compact), "toolbar-compact.mjs 必須可解析");
});

test("班別與假別重新渲染後仍可快速連點開啟修改", () => {
  const config = read("src/renderer/app-config-base.mjs");
  assert.match(config, /function installToolbarRapidEdit\(\)/);
  assert.match(config, /const key = `\$\{type\}:\$\{id\}`/);
  assert.match(config, /now - lastChipClickAt <= 550/);
  assert.match(config, /event\.stopImmediatePropagation\(\)/);
  assert.match(config, /openShiftFormModal\("edit", id\)/);
  assert.match(config, /openNamedColorFormModal\("leave", "edit", id\)/);
  assert.match(config, /installToolbarRapidEdit\(\)/);
});

test("公開設定檢查不執行瀏覽器 DOM 初始化", () => {
  const checker = read("scripts/check-public-supabase.js");
  assert.match(checker, /addEventListener\(\) \{/);
  assert.match(checker, /只讀取 SCHEDULER_CONFIG/);
});
