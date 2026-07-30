const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("打卡管理在員工欄後顯示當日班表圖示", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const edge = read("supabase/functions/attendance-admin-list-v2/index.ts");
  assert.match(views, /<th>員工<\/th><th class="attendance-schedule-icon-col">圖示<\/th><th>班別<\/th>/);
  assert.match(views, /<td class="attendance-schedule-icon-col">\$\{renderScheduleIcon\(row\)\}<\/td>/);
  assert.match(views, /regularHolidayWorkClass[\s\S]*?segmentCode === "0036"/);
  assert.match(edge, /shift_type_id,leave_type_id,overtime_type_id/);
  assert.match(edge, /function catalogSegment\(category: string, item: any\)/);
  assert.match(edge, /scheduleSegments = \[[\s\S]*?catalogSegment\("shift", shift\)[\s\S]*?catalogSegment\("leave", leave\)[\s\S]*?catalogSegment\("overtime", overtimeType\)/);
  assert.match(edge, /scheduleSegments,\n\s*issues: currentIssues/);
});

test("班別與人員設定表格貼合彈窗且不顯示水平捲軸", () => {
  const css = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");
  assert.match(css, /\.catalog-settings-modal \.settings-table-scroll,[\s\S]*?\.member-settings-modal \.member-table-scroll \{[\s\S]*?overflow-x: hidden;/);
  assert.match(css, /\.catalog-settings-modal \.settings-table-row-shift \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(css, /\.member-settings-modal \.member-table-row \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(spec, /人員設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸/);
  assert.match(spec, /班別設定表格左右寬度必須貼合彈出視窗可用寬度，不得出現下方水平捲軸/);
});
