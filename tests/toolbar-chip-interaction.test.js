const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("班表浮動工具列支援快速連點修改與選中項目圖示", () => {
  const html = read("src/renderer/index.html");
  const docsHtml = read("docs/index.html");
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const events = read("src/renderer/renderer-events-click.js");
  const css = read("src/renderer/css/pages.css");
  assert.equal(docsHtml, html, "發布 index.html 必須與來源一致");

  const primaryStart = html.indexOf('class="toolbar-control-primary"');
  const collapseIndex = html.indexOf('id="toolbarCollapseToggle"', primaryStart);
  const previewIndex = html.indexOf('id="toolbarSelectedPreview"', primaryStart);
  assert.ok(primaryStart >= 0 && collapseIndex > primaryStart && previewIndex > collapseIndex, "縮放按鈕與選中項目圖示必須位於同一主控制列");

  const shiftTitle = html.indexOf('<span class="toolbar-title">班別</span>');
  const shiftEdit = html.indexOf('id="shiftSettingsButton"', shiftTitle);
  const shiftFilter = html.indexOf('id="deptFilter"', shiftTitle);
  assert.ok(shiftTitle >= 0 && shiftEdit > shiftTitle && shiftFilter > shiftEdit, "班別修改圖示必須緊接標題並位於單位選單前");

  const leaveTitle = html.indexOf('<span class="toolbar-title">假別</span>');
  const leaveEdit = html.indexOf('id="leaveSettingsButton"', leaveTitle);
  const compliance = html.indexOf('id="restComplianceButton"', leaveTitle);
  assert.ok(leaveTitle >= 0 && leaveEdit > leaveTitle && compliance > leaveEdit, "假別修改圖示必須緊接標題並位於例休檢查前");

  assert.match(css, /\.toolbar-floating-card #shiftChips \.chip,[\s\S]*?\.toolbar-floating-card #leaveChips \.chip[\s\S]*?border-radius: 6px !important/);
  assert.match(toolbar, /function syncSelectedToolbarPreview\(\)/);
  assert.match(events, /openToolbarChipEditor/);
  assert.match(events, /data-chip-type="shift"/);
  assert.match(events, /data-chip-type="leave"/);
  assert.doesNotMatch(html, /toolbarChipInteractionScript|toolbarChipInteractionStyles/);
});
