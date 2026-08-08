const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("權限設定的權限項目使用可換行膠囊標籤並取得主要寬度", () => {
  const renderer = read("src/renderer/renderer-groups-permissions-archive.js");
  const css = read("src/renderer/groups.css");
  const spec = read("規格書.md");

  assert.match(renderer, /function renderPermissionSummaryTags\(role\)/);
  assert.match(renderer, /class="permission-summary-tags"/);
  assert.match(renderer, /class="group-unit-tag permission-summary-tag"/);
  assert.match(renderer, /class="permission-summary-cell permission-items-col">\$\{renderPermissionSummaryTags\(role\)\}/);
  assert.match(css, /\.permission-settings-table \{[^}]*table-layout:\s*fixed/);
  assert.match(css, /\.permission-settings-table \.permission-items-col \{\s*width:\s*auto/);
  assert.match(css, /\.permission-summary-tags \{[^}]*flex-wrap:\s*wrap/);
  assert.match(spec, /權限項目.*主要寬欄.*膠囊標籤/);
});

test("首次載入班表顯示圓形載入動畫", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  const events = read("src/renderer/renderer-events-click.js");
  const css = read("src/renderer/groups.css");

  assert.match(pageData, /function getScheduleLoadingIndicator\(\)/);
  assert.match(pageData, /schedule-page-loading-spinner/);
  assert.match(events, /if \(firstLoad\) await showScheduleLoadingIndicator\(\)/);
  assert.match(events, /if \(firstLoad\) hideScheduleLoadingIndicator\(\)/);
  assert.match(css, /\.schedule-page-loading-spinner \{[^}]*border-radius:\s*50%/);
  assert.match(css, /@keyframes schedule-page-loading-spin/);
});
