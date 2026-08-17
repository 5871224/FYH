const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核列印 A4 橫式且每頁 40 筆", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const events = read("src/renderer/renderer-records-events.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const spec = read("規格書.md");
  assert.match(views, /data-print-attendance-review="true">列印<\/button>/);
  assert.match(events, /dataset\.printAttendanceReview[\s\S]*printAttendanceReview\(target\)/);
  assert.match(actions, /ATTENDANCE_REVIEW_PRINT_PAGE_SIZE = 40/);
  assert.match(actions, /getAttendanceReviewList\(\{ \.\.\.filters, page: 1 \}\)/);
  assert.match(actions, /for \(let page = 2; page <= pageCount; page \+= 1\)/);
  assert.match(actions, /@page\{size:A4 landscape;margin:0\}/);
  assert.match(spec, /每個完整列印頁固定 40 筆/);
});
