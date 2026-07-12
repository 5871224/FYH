const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function closingBrace(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return index;
  }
  return -1;
}

function rootRuleBodies(source, selector) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const bodies = [];
  let cursor = 0;
  while (cursor < clean.length) {
    while (cursor < clean.length && /\s/.test(clean[cursor])) cursor += 1;
    const open = clean.indexOf("{", cursor);
    if (open < 0) break;
    const header = clean.slice(cursor, open).trim();
    const close = closingBrace(clean, open);
    if (close < 0) break;
    if (!header.startsWith("@") && header === selector) {
      bodies.push(clean.slice(open + 1, close));
    }
    cursor = close + 1;
  }
  return bodies;
}

function allRuleBodies(source, selector) {
  const marker = selector + " {";
  const bodies = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) break;
    const open = source.indexOf("{", start);
    const close = closingBrace(source, open);
    if (close < 0) break;
    bodies.push(source.slice(open + 1, close));
    cursor = close + 1;
  }
  return bodies;
}

test("訂餐核心樣式各只有一個正式根層來源", () => {
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
    assert.equal(rootRuleBodies(foundation, selector).some((body) => body.includes(declaration)), true, selector + " 缺少正式宣告");
    assert.equal(rootRuleBodies(components, selector).length, 0, selector + " 不得再由 components 根層覆蓋");
  }
});

test("班表外框不再依賴根層後載入修正", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const schedule = read("src/renderer/css/schedule.css");
  const header = rootRuleBodies(foundation, ".table-sticky-header")[0] || "";
  const tableWrap = rootRuleBodies(foundation, ".table-wrap")[0] || "";
  assert.equal(header.includes("border: 1px solid var(--line);"), true);
  assert.equal(tableWrap.includes("border-left: 1px solid var(--line);"), true);
  assert.equal(foundation.includes(".table-sticky-header::after"), false);
  assert.equal(foundation.includes(".table-wrap::after"), false);
  assert.equal(foundation.includes(".table-sticky-header-left::after"), false);
  assert.equal(rootRuleBodies(schedule, ".table-top-scrollbar").length, 0);
  assert.equal(rootRuleBodies(schedule, ".table-sticky-header").length, 0);
  assert.equal(rootRuleBodies(schedule, ".table-wrap").length, 0);
});

test("手機打卡與加班欄位規則不再重複", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const responsive = read("src/renderer/css/responsive.css");
  const pages = read("src/renderer/css/pages.css");
  assert.equal(allRuleBodies(foundation, ".clock-action-btn").some((body) => body.includes("min-height: 120px;") && body.includes("padding: 18px 20px;")), true);
  assert.equal(allRuleBodies(pages, ".clock-action-btn").length, 0);
  assert.equal(allRuleBodies(responsive, ".overtime-hours-grid .form-row-wide").length, 0);
  assert.equal(allRuleBodies(pages, ".overtime-hours-grid .form-row-wide").length, 1);
});
