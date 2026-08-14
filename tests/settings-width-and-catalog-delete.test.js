const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 同時固定欄寬單一來源、班表外層寬度與目錄刪除前後端合約。
// 正式 CI 以本檔與既有管理資料測試共同防止欄寬及 itemId 合約再次回歸。
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("設定列表應以完整內容寬度維持水平捲動後的表頭格式", () => {
  const css = read("src/renderer/css/components.css");
  assert.equal(css.includes("min-width: 1040px"), false);
  assert.equal(css.includes("min-width: 880px"), false);
  assert.equal(css.includes("min-width: 1060px"), false);
  assert.match(css, /\.member-settings-modal \.member-table,[\s\S]*?\.catalog-settings-modal \.settings-table \{[\s\S]*?width: max-content;[\s\S]*?min-width: 100%;/);
  assert.match(css, /\.member-settings-modal \.member-table-row,[\s\S]*?\.catalog-settings-modal \.settings-table-row \{[\s\S]*?width: 100%;[\s\S]*?min-width: 100%;/);
  assert.equal(css.includes(".member-settings-modal .member-table {\n  width: 100%;\n  min-width: 0;"), false);
  assert.equal(css.includes(".catalog-settings-modal .settings-table {\n  width: 100%;\n  min-width: 0;"), false);
  assert.equal((css.match(/\.catalog-settings-modal \.settings-table-row-shift \{/g) || []).length, 1);
  assert.equal(css.includes("--settings-drag-column-width: 30px"), true);
  assert.equal(css.includes("--settings-action-column-width: 72px"), true);
});

test("班表頁外層寬度固定在頁面內，水平移動留在表格捲動區", () => {
  const css = read("src/renderer/css/schedule.css");
  assert.equal(css.includes("Desktop schedule width contract"), true);
  assert.equal(css.includes("overflow-x: clip"), true);
  assert.equal(css.includes("width: calc(100% - var(--schedule-frozen-width))"), true);
});

test("班別假別加班刪除只走具名 FYH API 契約", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function reorderSettings", start);
  const block = webApi.slice(start, end);
  assert.match(block, /request\("\/api\/v1\/settings\/catalog\/delete",\{method:"POST",body:\{category,itemId\}\}\)/);
  assert.doesNotMatch(block, /callRpc|delete_catalog_item_v3|requestFunction\("catalog-admin"/);
});

test("設定刪除失敗時不得先關閉視窗或先移除本機資料", () => {
  const source = read("src/renderer/renderer-settings-catalog.js");
  const start = source.indexOf("async function deleteListItem");
  const block = source.slice(start);
  const requestPosition = block.indexOf("await window.schedulerApi.deleteCatalogItem");
  const statePosition = block.indexOf("state.shifts =", requestPosition);
  assert.ok(requestPosition >= 0);
  assert.ok(statePosition > requestPosition);
  assert.equal(block.slice(0, requestPosition).includes("closeModal()"), false);
  assert.equal(block.slice(requestPosition, statePosition).includes("openListSettings(category)"), false);
});
