const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mealSources = [
  "src/renderer/renderer-main-pages.js",
  "src/renderer/renderer-meal-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-events-form.js",
  "src/renderer/renderer-events-click.js",
  "src/renderer/renderer-events-drag.js"
].map(read).join("\n");

// 訂餐功能正式化後，所有行為都必須由上述模組提供，不能再新增後載入覆蓋。
test("訂餐功能不再依賴 v2 補丁檔", () => {
  assert.equal(fs.existsSync(path.join(root, "src/renderer/v2-meal.js")), false);
  assert.doesNotMatch(read("scripts/build-js.js"), /v2-meal\.js/);
});

test("訂餐正式函式各只有一份宣告且沒有後載入覆蓋", () => {
  for (const name of ["renderMealPage", "renderMealSettingsSection", "saveMealSettingsFromPage", "saveTodayMealOrder"]) {
    const declarations = mealSources.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, "g")) || [];
    assert.equal(declarations.length, 1, `${name} 應只有一份正式實作`);
    assert.doesNotMatch(mealSources, new RegExp(`${name}\\s*=\\s*(?:async\\s+)?function`));
  }
});

test("訂餐驗證、刪除與拖曳把手均由正式模組提供", () => {
  assert.match(mealSources, /addEventListener\("beforeinput"/);
  assert.match(mealSources, /addEventListener\("paste"/);
  assert.match(mealSources, /lastValidMealQuantity/);
  assert.match(mealSources, /data-meal-company-subsidy/);
  assert.match(mealSources, /data-delete-meal-product/);
  assert.match(mealSources, /async function deleteMealProduct/);
  assert.match(mealSources, /closest\("\.meal-drag-handle"\)/);
});

test("儲存訂餐重新渲染時應保留剛輸入的數量與備註", () => {
  const mainPages = read("src/renderer/renderer-main-pages.js");
  const mealPage = read("src/renderer/renderer-meal-page.js");
  assert.match(mainPages, /Array\.isArray\(mealOrderState\.pendingItems\)/);
  assert.match(mainPages, /pendingItems\.map\(\(item\) => \[item\.productId, Number\(item\.quantity \|\| 0\)\]\)/);
  assert.match(mainPages, /pendingItems\.map\(\(item\) => \[item\.productId, item\.note \|\| ""\]\)/);
  assert.match(mealPage, /pendingItems:\s*items/);
  assert.match(mealPage, /pendingItems:\s*null/);
});

test("今日訂餐完成讀取後才顯示空商品提示，且不顯示處理中文字", () => {
  const mainPages = read("src/renderer/renderer-main-pages.js");
  assert.match(mainPages, /const showEmptyProducts = Boolean\(status\) && !mealOrderState\.loading && products\.length === 0;/);
  assert.match(mainPages, /<section class="records-section meal-order-section">/);
  assert.match(mainPages, /showEmptyProducts \? '<div class="empty-state">目前沒有可訂購的商品<\/div>' : ""/);
  assert.doesNotMatch(mainPages, /處理中，請稍候/);
});
