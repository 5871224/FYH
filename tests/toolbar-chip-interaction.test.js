const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("班表浮動工具列支援雙擊修改與選中項目圖示", () => {
  const html = read("src/renderer/index.html");
  const docsHtml = read("docs/index.html");
  assert.equal(docsHtml, html, "發布 index.html 必須與來源一致");

  const previewIndex = html.indexOf('id="toolbarSelectedPreview"');
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"');
  assert.ok(previewIndex >= 0 && previewIndex < collapseIndex, "選中項目圖示必須位於縮放按鈕上方");

  const shiftTitle = html.indexOf('<span class="toolbar-title">班別</span>');
  const shiftEdit = html.indexOf('id="shiftSettingsButton"', shiftTitle);
  const shiftFilter = html.indexOf('id="deptFilter"', shiftTitle);
  assert.ok(shiftTitle >= 0 && shiftEdit > shiftTitle && shiftFilter > shiftEdit, "班別修改圖示必須緊接標題並位於單位選單前");

  const leaveTitle = html.indexOf('<span class="toolbar-title">假別</span>');
  const leaveEdit = html.indexOf('id="leaveSettingsButton"', leaveTitle);
  const compliance = html.indexOf('id="restComplianceButton"', leaveTitle);
  assert.ok(leaveTitle >= 0 && leaveEdit > leaveTitle && compliance > leaveEdit, "假別修改圖示必須緊接標題並位於例休檢查前");

  assert.match(html, /#shiftChips \.chip,[\s\S]*?#leaveChips \.chip \{[\s\S]*?border-radius: 8px;/);
  assert.match(html, /toolbar-floating-card\.toolbar-has-selection-preview > #toolbarCollapseToggle \{\s*grid-row: 2;/);
  assert.match(html, /toolbar-floating-card-collapsed\.toolbar-has-selection-preview \{\s*grid-template-rows: repeat\(4, auto\);/);
  assert.match(html, /openShiftFormModal\("edit", id\)/);
  assert.match(html, /openNamedColorFormModal\("leave", "edit", id\)/);
  assert.match(html, /data-chip-type="shift"/);
  assert.match(html, /data-chip-type="leave"/);

  const script = html.match(/<script id="toolbarChipInteractionScript">([\s\S]*?)<\/script>/)?.[1] || "";
  assert.ok(script, "缺少浮動工具列互動程式");
  assert.doesNotThrow(() => new Function(script), "浮動工具列互動程式必須可解析");
});
