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
