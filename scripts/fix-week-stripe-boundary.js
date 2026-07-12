const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dateUtilsPath = path.join(root, "src", "renderer", "renderer-date-utils.js");
const foundationPath = path.join(root, "src", "renderer", "css", "foundation.css");
const specPath = path.join(root, "規格書.md");
const testPath = path.join(root, "tests", "renderer-week-stripe-boundary.test.js");

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`找不到修正位置：${label}`);
  }
  if (source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`修正位置不唯一：${label}`);
  }
  return source.replace(before, after);
}

let dateUtils = fs.readFileSync(dateUtilsPath, "utf8");
dateUtils = replaceOnce(
  dateUtils,
  `function getWeekIndexForDate(dateString) {\n  const dates = getVisibleDates();\n  const index = dates.indexOf(dateString);\n  return index >= 0 ? Math.floor(index / 7) : 0;\n}`,
  `function getWeekIndexForDate(dateString) {\n  const dates = getVisibleDates();\n  const index = dates.indexOf(dateString);\n  const firstDate = toDateObject(dates[0]);\n  if (index < 0 || !firstDate) {\n    return 0;\n  }\n  const offset = (firstDate.getDay() - getConfiguredWeekStart() + 7) % 7;\n  return Math.floor((index + offset) / 7);\n}`,
  "日期標題週索引"
);
fs.writeFileSync(dateUtilsPath, dateUtils, "utf8");

let foundation = fs.readFileSync(foundationPath, "utf8");
foundation = replaceOnce(
  foundation,
  `.table-sticky-cell-day.week-boundary-end {\n  border-right: 2px solid #b39a75;\n}`,
  `.table-sticky-cell-day.week-boundary-end {\n  border-right: 0;\n}`,
  "日期標題週結束格線"
);
foundation = replaceOnce(
  foundation,
  `.cell.week-boundary-end {\n  border-right: 2px solid #b39a75;\n}`,
  `#mainTable td.cell.week-boundary-end {\n  border-right: 0;\n}`,
  "班表內容週結束格線"
);
fs.writeFileSync(foundationPath, foundation, "utf8");

let spec = fs.readFileSync(specPath, "utf8");
const specMarker = "### 班表週期視覺規則";
if (!spec.includes(specMarker)) {
  spec += `\n\n${specMarker}\n\n- 日期標題的每週斑馬紋與週界線，必須共同依「功能 → 週期設定 → 每週起算日」計算。\n- 修改每週起算日後，日期標題斑馬紋與整張班表週界線必須在同一次重新渲染中一起移動。\n- 週界線只由新一週第一欄繪製一次；日期標題與表格內容使用相同粗細，不得由前一欄右框與下一欄左框重複疊加。\n`;
}
fs.writeFileSync(specPath, spec, "utf8");

const testSource = `const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\nconst vm = require("node:vm");\n\nconst root = path.resolve(__dirname, "..");\nconst dateUtils = fs.readFileSync(path.join(root, "src/renderer/renderer-date-utils.js"), "utf8");\nconst layout = fs.readFileSync(path.join(root, "src/renderer/renderer-schedule-layout.js"), "utf8");\nconst css = fs.readFileSync(path.join(root, "src/renderer/css/foundation.css"), "utf8");\n\nfunction makeDateContext(weekStart) {\n  const context = { state: { rules: { weekStart } } };\n  vm.createContext(context);\n  vm.runInContext(dateUtils, context);\n  const dates = Array.from({ length: 14 }, (_, index) => context.addDaysToDateString("2026-07-12", index));\n  context.getVisibleDates = () => dates;\n  return context;\n}\n\ntest("日期標題斑馬紋應跟隨每週起算日移動", () => {\n  const sunday = makeDateContext(0);\n  assert.equal(sunday.getWeekStripeClassForDate("2026-07-13"), "");\n  assert.equal(sunday.getWeekStripeClassForDate("2026-07-19"), "week-alt");\n\n  const monday = makeDateContext(1);\n  assert.equal(monday.getWeekStripeClassForDate("2026-07-13"), "week-alt");\n  assert.equal(monday.getWeekStripeClassForDate("2026-07-20"), "");\n});\n\ntest("斑馬紋與週界線應使用同一個每週起算日", () => {\n  const monday = makeDateContext(1);\n  assert.match(monday.getWeekBoundaryClassForDate("2026-07-13", 1, 14), /week-boundary-start/);\n  assert.equal(monday.getWeekStripeClassForDate("2026-07-13"), "week-alt");\n  assert.match(layout, /getWeekStripeClassForDate\\(dateString\\)/);\n  assert.match(layout, /getWeekBoundaryClassForDate\\(dateString, index, dates\\.length\\)/);\n});\n\ntest("日期標題與表格內容週界線應只繪製單一同粗線條", () => {\n  assert.match(css, /\\.table-sticky-cell-day\\.week-boundary-start\\s*\\{\\s*border-left: 2px solid #b39a75;/s);\n  assert.match(css, /\\.table-sticky-cell-day\\.week-boundary-end\\s*\\{\\s*border-right: 0;/s);\n  assert.match(css, /\\.cell\\.week-boundary-start\\s*\\{\\s*border-left: 2px solid #b39a75;/s);\n  assert.match(css, /#mainTable td\\.cell\\.week-boundary-end\\s*\\{\\s*border-right: 0;/s);\n});\n`;
fs.writeFileSync(testPath, testSource, "utf8");

console.log("週期斑馬紋與週界線修正完成");
