const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssDir = path.join(root, "src", "renderer", "css");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到 CSS 整合位置：${label}`);
  return source.replace(from, to);
}

function removeOnce(source, block, label) {
  return replaceOnce(source, block, "", label).replace(/\n{3,}/g, "\n\n");
}

let foundation = read("src/renderer/css/foundation.css");
let schedule = read("src/renderer/css/schedule.css");
let components = read("src/renderer/css/components.css");
let responsive = read("src/renderer/css/responsive.css");
let pages = read("src/renderer/css/pages.css");

// 訂餐頁與訂餐設定：以 foundation 為唯一基礎來源，保留 components 中真正新增的欄位樣式。
foundation = replaceOnce(foundation, "  width: min(820px, 100%);\n  margin: 0 auto;\n  padding: clamp(18px, 4vw, 34px);\n  border-radius: 28px;\n  background: linear-gradient(150deg, #fffdf8 0%, #f3e8d5 100%);", "  width: min(1100px, 100%);\n  margin: 0 auto;\n  padding: clamp(18px, 4vw, 34px);\n  border-radius: 28px;\n  background: linear-gradient(150deg, #fffdf8 0%, #f3e8d5 100%);", "訂餐頁寬度");
foundation = replaceOnce(foundation, `.meal-settings-table th,
.meal-settings-table td {
  padding: 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}`, `.meal-settings-table th,
.meal-settings-table td {
  min-width: 0;
  padding: 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}`, "訂餐設定儲存格");
foundation = replaceOnce(foundation, `.meal-settings-drag-col {
  width: 34px;
  text-align: center;
}`, `.meal-settings-drag-col {
  width: 42px;
  text-align: center;
}`, "訂餐拖曳欄寬");
foundation = replaceOnce(foundation, `.meal-settings-price-col {
  width: 120px;
}`, `.meal-settings-price-col {
  width: 104px;
}`, "訂餐價格欄寬");
foundation = replaceOnce(foundation, `.meal-settings-active-col {
  width: 72px;
}`, `.meal-settings-active-col {
  width: 70px;
  text-align: center;
}`, "訂餐啟用欄寬");
foundation = replaceOnce(foundation, `.meal-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: var(--muted);
  cursor: grab;
  user-select: none;
}`, `.meal-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ui-icon-radius);
  color: var(--muted);
  cursor: grab;
  user-select: none;
  touch-action: none;
}`, "訂餐拖曳把手");
foundation = replaceOnce(foundation, `.meal-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}`, `.meal-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}`, "訂餐統計卡");

for (const [block, label] of [
  [`.meal-order-table {
  table-layout: fixed;
}`, "重複訂餐表格配置"],
  [`.meal-card {
  width: min(1100px, 100%);
}`, "訂餐頁後載入寬度"],
  [`.meal-settings-table {
  width: 100%;
  table-layout: fixed;
}`, "訂餐設定表格重複配置"],
  [`.meal-settings-table th,
.meal-settings-table td {
  min-width: 0;
}`, "訂餐設定儲存格後載入配置"],
  [`.meal-settings-drag-col {
  width: 42px;
  text-align: center;
}`, "訂餐拖曳欄後載入配置"],
  [`.meal-settings-price-col {
  width: 104px;
}`, "訂餐價格欄後載入配置"],
  [`.meal-settings-active-col {
  width: 70px;
  text-align: center;
}`, "訂餐啟用欄後載入配置"],
  [`.meal-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ui-icon-radius);
  cursor: grab;
  user-select: none;
  touch-action: none;
}`, "訂餐拖曳把手後載入配置"],
  [`.meal-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}`, "訂餐統計卡後載入配置"]
]) components = removeOnce(components, block, label);
components = components.replace("/* Consolidated styles formerly injected by v2 JavaScript modules. */", "/* Formal meal, record and settings component styles. */");

// 班表外框：直接在 foundation 定義最終樣式，移除透明邊框與偽元素補丁。
foundation = replaceOnce(foundation, `.table-top-scrollbar {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 25;
  height: 14px;
  margin-left: var(--schedule-frozen-width);
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--schedule-header-bg);
  border: 1px solid var(--line);
  border-bottom: none;
  border-radius: var(--schedule-radius) var(--schedule-radius) 0 0;
  scrollbar-color: #cdbb9f #fbf8f1;
  scrollbar-width: thin;
}`, `.table-top-scrollbar {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 25;
  height: 14px;
  margin-left: var(--schedule-frozen-width);
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--schedule-header-bg);
  border: 0;
  border-radius: 0;
  box-shadow: none;
  scrollbar-color: #cdbb9f #fbf8f1;
  scrollbar-width: thin;
}`, "班表頂部捲軸外框");
foundation = replaceOnce(foundation, "  border: 1px solid transparent;\n  border-bottom: none;\n  border-radius: var(--schedule-radius) var(--schedule-radius) 0 0;", "  border: 1px solid var(--line);\n  border-bottom: 0;\n  border-radius: var(--schedule-radius) var(--schedule-radius) 0 0;", "班表固定表頭外框");
foundation = removeOnce(foundation, `.table-sticky-header::after,
.table-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}`, "班表外框偽元素共用基礎");
foundation = removeOnce(foundation, `.table-sticky-header::after {
  border: 1px solid var(--line);
  border-right: none;
  border-bottom: none;
  border-radius: var(--schedule-radius) var(--schedule-radius) 0 0;
}`, "班表表頭偽元素");
foundation = removeOnce(foundation, `.table-sticky-header-left::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  z-index: 9;
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
  border-top-left-radius: var(--schedule-radius);
  pointer-events: none;
}`, "班表左側表頭偽元素");
foundation = replaceOnce(foundation, `  border-radius: 0 0 var(--schedule-radius) var(--schedule-radius);
  border: 1px solid transparent;
  border-top: none;
  background: #fff;`, `  border: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-left: 1px solid var(--line);
  border-radius: 0 0 var(--schedule-radius) var(--schedule-radius);
  background: #fff;`, "班表內容外框");
foundation = removeOnce(foundation, `.table-wrap::after {
  border: 1px solid var(--line);
  border-right: none;
  border-top: none;
  border-radius: 0 0 var(--schedule-radius) var(--schedule-radius);
}`, "班表內容偽元素");

schedule = removeOnce(schedule, `:root {
  --schedule-nav-control-height: 42px;
}`, "舊班表控制項高度變數");
schedule = removeOnce(schedule, `/* Keep the schedule frame fixed while synchronized horizontal scrollers move. */
.table-top-scrollbar {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.table-sticky-header {
  border: 1px solid var(--line);
  border-bottom: 0;
}

.table-sticky-header::after,
.table-sticky-header-left::after {
  content: none;
  display: none;
}

.table-wrap {
  border: 0;
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.table-wrap::after {
  content: none;
  display: none;
}`, "班表外框後載入修正");

// 手機與打卡頁：移除舊值與完全重複規則，將最終尺寸留在 foundation。
responsive = removeOnce(responsive, `.overtime-use-label {
  font-size: 15px;
}`, "舊加班標籤字級");
responsive = removeOnce(responsive, `.overtime-hours-grid .form-row-wide {
  grid-column: 1 / -1;
}`, "重複加班寬欄規則");
foundation = replaceOnce(foundation, `  .clock-action-btn {
    min-height: 132px;
    padding: 22px;
  }

  .clock-action-btn span {
    font-size: 26px;
  }`, `  .clock-action-btn {
    min-height: 120px;
    padding: 18px 20px;
  }

  .clock-action-btn span {
    margin-bottom: 10px;
    font-size: 26px;
  }`, "手機打卡按鈕最終尺寸");
pages = removeOnce(pages, `@media (max-width: 960px) {
  .clock-action-btn {
    min-height: 120px;
    padding: 18px 20px;
  }

  .clock-action-btn span {
    margin-bottom: 10px;
  }
}`, "打卡頁後載入手機尺寸");

write("src/renderer/css/foundation.css", foundation);
write("src/renderer/css/schedule.css", schedule);
write("src/renderer/css/components.css", components);
write("src/renderer/css/responsive.css", responsive);
write("src/renderer/css/pages.css", pages);

let audit = read("scripts/audit-css-duplicates.js");
audit = replaceOnce(audit, `fs.writeFileSync(reportPath, \`${"${lines.join(\"\\n\")}"}\\n\`, "utf8");
console.log(\`CSS audit completed: ${"${rules.length}"} rules, ${"${exactGroups.length}"} exact groups, ${"${overrideGroups.length}"} override groups.\`);`, `fs.writeFileSync(reportPath, \`${"${lines.join(\"\\n\")}"}\\n\`, "utf8");
console.log(\`CSS audit completed: ${"${rules.length}"} rules, ${"${exactGroups.length}"} exact groups, ${"${overrideGroups.length}"} override groups.\`);
if (process.argv.includes("--check") && exactGroups.length) {
  console.error(\`Found ${"${exactGroups.length}"} exact duplicate CSS rule group(s).\`);
  process.exit(1);
}`, "CSS 稽核檢查模式");
write("scripts/audit-css-duplicates.js", audit);

let packageJson = JSON.parse(read("package.json"));
packageJson.scripts["css:architecture"] = "node scripts/audit-css-duplicates.js --check";
packageJson.scripts["ci:check"] = `${packageJson.scripts["ci:check"]} && npm run css:architecture`;
write("package.json", JSON.stringify(packageJson, null, 2));

const test = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("訂餐核心樣式各只有一個正式來源", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const components = read("src/renderer/css/components.css");
  for (const selector of [".meal-card {", ".meal-settings-table {", ".meal-settings-drag-col {", ".meal-settings-price-col {", ".meal-settings-active-col {", ".meal-drag-handle {", ".meal-stats-grid {"]) {
    assert.equal((foundation.match(new RegExp(selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "g")) || []).length, 1, selector + " 應由 foundation 提供");
    assert.equal(components.includes(selector), false, selector + " 不得再由 components 覆蓋");
  }
});

test("班表外框不再依賴後載入透明邊框與偽元素修正", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const schedule = read("src/renderer/css/schedule.css");
  assert.match(foundation, /\.table-sticky-header \{[\s\S]*?border: 1px solid var\(--line\);/);
  assert.match(foundation, /\.table-wrap \{[\s\S]*?border-left: 1px solid var\(--line\);/);
  assert.doesNotMatch(foundation, /\.table-sticky-header::after|\.table-wrap::after|\.table-sticky-header-left::after/);
  assert.doesNotMatch(schedule, /\.table-top-scrollbar \{|\.table-sticky-header \{|\.table-wrap \{/);
});

test("手機打卡與加班欄位規則不再重複", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const responsive = read("src/renderer/css/responsive.css");
  const pages = read("src/renderer/css/pages.css");
  assert.match(foundation, /\.clock-action-btn \{[\s\S]*?min-height: 120px;[\s\S]*?padding: 18px 20px;/);
  assert.doesNotMatch(pages, /@media \(max-width: 960px\)[\s\S]*?\.clock-action-btn/);
  assert.equal((responsive.match(/\.overtime-hours-grid \.form-row-wide/g) || []).length, 0);
  assert.equal((pages.match(/\.overtime-hours-grid \.form-row-wide/g) || []).length, 1);
});
`;
write("tests/css-consolidation.test.js", test);

let spec = read("規格書.md");
if (!spec.includes("### CSS 單一來源與覆蓋規則")) {
  spec += `\n\n### CSS 單一來源與覆蓋規則\n\n- 完全相同的選擇器與宣告不得散落在不同 CSS 模組。\n- 訂餐表格、欄寬、拖曳把手與統計卡的基礎樣式集中於 ` + "`foundation.css`" + `；` + "`components.css`" + ` 只保留額外元件樣式。\n- 班表外框由單一規則直接定義，不得先使用透明邊框或偽元素，再由後載入檔覆蓋。\n- 響應式規則只有在斷點下確實改變行為時才保留；完全相同宣告由 CSS 架構檢查阻擋。\n`;
}
write("規格書.md", spec);

console.log("CSS rules consolidated.");
