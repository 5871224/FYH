const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核列印 A4 直式且可設定每頁筆數", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const events = read("src/renderer/renderer-records-events.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const spec = read("規格書.md");
  assert.match(views, /data-print-attendance-review="true">列印<\/button>/);
  assert.match(events, /dataset\.printAttendanceReview[\s\S]*printAttendanceReview\(target\)/);
  assert.match(actions, /ATTENDANCE_REVIEW_PRINT_DEFAULT_PAGE_SIZE = 40/);
  assert.match(actions, /data-attendance-review-print-page-size/);
  assert.match(actions, /attendanceReviewPrintPageStyle/);
  assert.match(actions, /getAttendanceReviewList\(\{ \.\.\.filters, page: 1 \}\)/);
  assert.match(actions, /for \(let page = 2; page <= pageCount; page \+= 1\)/);
  assert.match(actions, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(actions, /--attendance-review-print-row-height/);
  assert.match(actions, /records-table attendance-review-table attendance-review-print-table/);
  assert.match(actions, /renderReviewStatus\(row\.reviewed\)/);
  assert.match(actions, /列印版沿用簽到審核頁的表格、色彩與狀態視覺/);
  assert.match(actions, /border-bottom:1px solid var\(--line\)/);
  assert.match(views, /function renderRecordDateCell\(dateString\)[\s\S]*getScheduleWeekdayLabel\(date\.getDay\(\)\)/);
  assert.match(actions, /renderRecordDateCell\(row\.work_date\)/);
  assert.match(actions, /<td class="attendance-review-print-date-col">\$\{renderRecordDateCell\(row\.work_date\)\}<\/td>/);
  assert.doesNotMatch(actions, /<div class="attendance-review-print-cell">\$\{renderRecordDateCell\(row\.work_date\)\}<\/div>/);
  assert.match(actions, /\.attendance-review-print-table \.attendance-review-print-date-col \.records-date-weekday\{display:block/);
  assert.match(spec, /「每頁筆數」設定，範圍 1～60 筆、預設 40 筆/);
});


test("簽到審核列印日期一週七天都產生星期，且不使用會裁切文字的容器", () => {
  const vm = require("node:vm");
  const views = read("src/renderer/renderer-records-views.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const dateSource = views.match(/function renderRecordDateCell\(dateString\) \{[\s\S]*?\n\}/)?.[0];
  const tableSource = actions.match(/function renderAttendanceReviewPrintTable\(rows\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(dateSource);
  assert.ok(tableSource);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const rows = weekdays.map((_, i) => ({ work_date: `2026-10-${String(25 + i).padStart(2, "0")}` }));
  const html = vm.runInNewContext(`${dateSource}\n${tableSource}\nrenderAttendanceReviewPrintTable(rows)`, {
    rows,
    toDateObject: (value) => {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    },
    getScheduleWeekdayLabel: (day) => weekdays[day],
    escapeHtml: (value) => String(value),
    renderScheduleIcon: () => "",
    renderAttendanceReviewPrintClock: () => "",
    renderReviewStatus: () => ""
  });
  const matches = [...html.matchAll(/<td class="attendance-review-print-date-col"><span class="records-date-value">([^<]+)<\/span><span class="records-date-weekday">([^<]+)<\/span><\/td>/g)];
  assert.equal(matches.length, 7);
  assert.deepEqual(matches.map((match) => match[2]), weekdays);
});
