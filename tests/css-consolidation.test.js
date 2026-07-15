const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
// 根層規則必須維持單一來源；媒體查詢中的響應式差異可使用同名選擇器。

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

test("班表共用樣式不再依賴後載入覆蓋", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const schedule = read("src/renderer/css/schedule.css");
  const nav = rootRuleBodies(foundation, ".calendar-nav")[0] || "";
  const select = rootRuleBodies(foundation, ".calendar-nav-left select")[0] || "";
  const collapsed = rootRuleBodies(foundation, ".toolbar-floating-card.toolbar-floating-card-collapsed .toolbar-top-row")[0] || "";
  const title = rootRuleBodies(foundation, ".toolbar-title-row")[0] || "";
  assert.equal(nav.includes("position: relative;"), true);
  assert.equal(select.includes("padding: 0 30px 0 12px;"), true);
  assert.equal(collapsed.includes("display: flex;") && collapsed.includes("margin: 0;"), true);
  assert.equal(title.includes("justify-content: flex-start;"), true);
  assert.equal(rootRuleBodies(schedule, ".calendar-nav").length, 0);
  assert.equal(rootRuleBodies(schedule, ".calendar-nav-left select").length, 0);
  assert.equal(rootRuleBodies(schedule, ".toolbar-floating-card.toolbar-floating-card-collapsed .toolbar-top-row").length, 0);
  assert.equal(rootRuleBodies(foundation, ".toolbar-title-row").length, 1);
});

test("手機主要頁面與表單響應式規格集中於 responsive", () => {
  const components = read("src/renderer/css/components.css");
  const responsive = read("src/renderer/css/responsive.css");
  assert.doesNotMatch(components, /body\.is-home-view \.app-shell[\s\S]*padding: var\(--ui-mobile-page-gutter\);/);
  assert.doesNotMatch(components, /\.home-card,[\s\S]*\.calendar-card \{\s*padding: var\(--ui-mobile-card-padding\);/);
  assert.doesNotMatch(components, /\.form-grid,\s*\.two-col,[\s\S]*grid-template-columns: 1fr;/);
  assert.match(responsive, /body\.is-home-view \.app-shell,[\s\S]*body\.is-schedule-view \.app-shell \{[^}]*padding: 8px 8px 4px;[^}]*gap: var\(--ui-mobile-gap\);/s);
  assert.match(responsive, /\.form-grid,\s*\.two-col \{\s*grid-template-columns: 1fr;/s);
  assert.match(responsive, /\.modal:not\(\.attendance-edit-modal\) :is\(\.form-grid, \.two-col\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/s);
});

test("手機假別與加班設定表格應使用內部水平捲動", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const responsive = read("src/renderer/css/responsive.css");
  assert.match(foundation, /\.member-table-scroll,\s*\.settings-table-scroll\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(responsive, /\.catalog-settings-modal \.settings-table-row-leave\s*\{\s*min-width:\s*720px;/s);
  assert.match(responsive, /\.catalog-settings-modal \.settings-table-row-overtime\s*\{\s*min-width:\s*840px;/s);
  assert.doesNotMatch(responsive, /\.catalog-settings-modal \.settings-table-row-shift\s*\{\s*min-width:/s);
});

test("訂餐與記錄頁使用 Chrome 式共用籤頁", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const components = read("src/renderer/css/components.css");
  const responsive = read("src/renderer/css/responsive.css");
  const mealPage = read("src/renderer/renderer-main-pages.js");
  const recordsView = read("src/renderer/renderer-records-views.js");
  assert.match(foundation, /\.meal-tabs \{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(foundation, /\.record-tabs \{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(components, /\.meal-tabs \.page-tab-btn,[\s\S]*border-radius:\s*14px 14px 0 0 !important;/);
  assert.match(components, /\.meal-tabs \.page-tab-btn\.active,[\s\S]*border-bottom-color:\s*var\(--ui-surface\);[\s\S]*color:\s*var\(--ui-accent-strong\);/);
  assert.match(responsive, /\.meal-tabs,[\s\S]*\.record-tabs \{[^}]*scroll-snap-type:\s*x proximity;/s);
  assert.match(foundation, /\.meal-tabs \{[^}]*margin:\s*10px 0 0;/s);
  assert.match(foundation, /\.record-tabs \{[^}]*margin:\s*12px 0 0;/s);
  assert.match(components, /body\.is-records-view \.record-tabs ~ \.records-section,[\s\S]*body\.is-meal-view \.meal-tabs ~ \.records-section \{[^}]*margin-top:\s*0;[^}]*border-top:\s*0;[^}]*border-top-left-radius:\s*0;[^}]*border-top-right-radius:\s*0;/s);
  assert.match(mealPage, /class="meal-tabs" role="tablist" aria-label="訂餐頁分頁"/);
  assert.match(mealPage, /class="ghost-btn page-tab-btn/);
  assert.match(recordsView, /class="record-tabs" role="tablist" aria-label="記錄頁分頁"/);
  assert.match(recordsView, /role="tab" aria-selected=/);
});
