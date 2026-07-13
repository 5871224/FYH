const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const dateUtils = fs.readFileSync(path.join(root, "src/renderer/renderer-date-utils.js"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/renderer/renderer-schedule-layout.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src/renderer/css/foundation.css"), "utf8");
const scheduleCss = fs.readFileSync(path.join(root, "src/renderer/css/schedule.css"), "utf8");

function makeDateContext(weekStart) {
  const context = { state: { rules: { weekStart } } };
  vm.createContext(context);
  vm.runInContext(dateUtils, context);
  const dates = Array.from({ length: 14 }, (_, index) => context.addDaysToDateString("2026-07-12", index));
  context.getVisibleDates = () => dates;
  return context;
}

test("日期標題斑馬紋應跟隨每週起算日移動", () => {
  const sunday = makeDateContext(0);
  assert.equal(sunday.getWeekStripeClassForDate("2026-07-13"), "");
  assert.equal(sunday.getWeekStripeClassForDate("2026-07-19"), "week-alt");

  const monday = makeDateContext(1);
  assert.equal(monday.getWeekStripeClassForDate("2026-07-13"), "week-alt");
  assert.equal(monday.getWeekStripeClassForDate("2026-07-20"), "");
});

test("斑馬紋與週界線應使用同一個每週起算日", () => {
  const monday = makeDateContext(1);
  assert.match(monday.getWeekBoundaryClassForDate("2026-07-13", 1, 14), /week-boundary-start/);
  assert.equal(monday.getWeekStripeClassForDate("2026-07-13"), "week-alt");
  assert.match(layout, /getWeekStripeClassForDate\(dateString\)/);
  assert.match(layout, /getWeekBoundaryClassForDate\(dateString, index, dates\.length\)/);
});

test("今天日期標題即使位於斑馬紋週也必須保持微亮藍色", () => {
  assert.match(layout, /\$\{weekStripeClass\}[^\n]+\$\{dateString === today \? "today" : ""\}/);
  assert.match(css, /--today:\s*#eaf5ff;/);
  assert.match(css, /--today-header:\s*#cfe8ff;/);
  assert.match(css, /--today-text:\s*#204f73;/);
  assert.match(css, /--today-border:\s*#62a7d8;/);
  assert.match(css, /\.table-sticky-cell-day\.today\s*\{[^}]*background:\s*var\(--today-header\);[^}]*color:\s*var\(--today-text\);[^}]*box-shadow:\s*inset 0 0 0 2px var\(--today-border\);/s);
  assert.match(css, /\.table-sticky-cell-day\.week-alt:not\(\.today\)\s*\{/);
  assert.doesNotMatch(scheduleCss, /\.table-sticky-cell-day\.today\.week-alt/);
});

test("日期標題與表格內容週界線應只繪製單一同粗線條", () => {
  assert.match(css, /\.table-sticky-cell-day\.week-boundary-start\s*\{\s*border-left: 2px solid #b39a75;/s);
  assert.match(css, /\.table-sticky-cell-day\.week-boundary-end\s*\{\s*border-right: 0;/s);
  assert.match(css, /\.cell\.week-boundary-start\s*\{\s*border-left: 2px solid #b39a75;/s);
  assert.match(css, /#mainTable td\.cell\.week-boundary-end\s*\{\s*border-right: 0;/s);
});
