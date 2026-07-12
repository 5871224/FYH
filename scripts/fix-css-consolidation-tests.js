const fs = require("node:fs");

const content = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function ruleBodies(source, selector) {
  const marker = selector + " {";
  const bodies = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) break;
    const open = source.indexOf("{", start);
    const close = source.indexOf("}", open + 1);
    if (close < 0) break;
    bodies.push(source.slice(open + 1, close));
    cursor = close + 1;
  }
  return bodies;
}

test("訂餐核心樣式各只有一個正式基礎來源", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const components = read("src/renderer/css/components.css");
  const expectations = [
    [".meal-card", "width: min(1100px, 100%);"],
    [".meal-settings-table", "table-layout: fixed;"],
    [".meal-settings-drag-col", "width: 42px;"],
    [".meal-settings-price-col", "width: 104px;"],
    [".meal-settings-active-col", "width: 70px;"],
    [".meal-drag-handle", "touch-action: none;"],
    [".meal-stats-grid", "grid-template-columns: repeat(2, minmax(0, 1fr));"]
  ];
  for (const [selector, declaration] of expectations) {
    assert.equal(ruleBodies(foundation, selector).some((body) => body.includes(declaration)), true, selector + " 缺少正式宣告");
    assert.equal(ruleBodies(components, selector).length, 0, selector + " 不得再由 components 覆蓋");
  }
});

test("班表外框不再依賴後載入透明邊框與偽元素修正", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const schedule = read("src/renderer/css/schedule.css");
  const header = ruleBodies(foundation, ".table-sticky-header")[0] || "";
  const tableWrap = ruleBodies(foundation, ".table-wrap")[0] || "";
  assert.equal(header.includes("border: 1px solid var(--line);"), true);
  assert.equal(tableWrap.includes("border-left: 1px solid var(--line);"), true);
  assert.equal(foundation.includes(".table-sticky-header::after"), false);
  assert.equal(foundation.includes(".table-wrap::after"), false);
  assert.equal(foundation.includes(".table-sticky-header-left::after"), false);
  assert.equal(ruleBodies(schedule, ".table-top-scrollbar").length, 0);
  assert.equal(ruleBodies(schedule, ".table-sticky-header").length, 0);
  assert.equal(ruleBodies(schedule, ".table-wrap").length, 0);
});

test("手機打卡與加班欄位規則不再重複", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const responsive = read("src/renderer/css/responsive.css");
  const pages = read("src/renderer/css/pages.css");
  const clockRules = ruleBodies(foundation, ".clock-action-btn");
  assert.equal(clockRules.some((body) => body.includes("min-height: 120px;") && body.includes("padding: 18px 20px;")), true);
  assert.equal(ruleBodies(pages, ".clock-action-btn").length, 0);
  assert.equal(ruleBodies(responsive, ".overtime-hours-grid .form-row-wide").length, 0);
  assert.equal(ruleBodies(pages, ".overtime-hours-grid .form-row-wide").length, 1);
});
`;

fs.writeFileSync("tests/css-consolidation.test.js", content, "utf8");
console.log("CSS consolidation tests fixed.");
