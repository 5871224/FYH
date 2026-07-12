const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 同時固定欄寬單一來源、班表外層寬度與目錄刪除前後端合約。
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("電腦版設定列表應配合彈窗寬度，不使用第二套固定最小寬度", () => {
  const css = read("src/renderer/css/components.css");
  assert.equal(css.includes("min-width: 1040px"), false);
  assert.equal(css.includes("min-width: 880px"), false);
  assert.equal(css.includes("min-width: 1060px"), false);
  assert.match(css, /\.member-settings-modal \.member-table \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(css, /\.catalog-settings-modal \.settings-table \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
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

test("班別假別加班刪除的前後端參數名稱一致", () => {
  const webApi = read("src/renderer/web-api.js");
  const backend = read("supabase/functions/catalog-admin/index.ts");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function resolveManagerMemberProfileId", start);
  const block = webApi.slice(start, end);
  assert.equal(block.includes('itemId: String(itemId || "")'), true);
  assert.equal(block.includes("id: String("), false);
  assert.equal(backend.includes("body?.itemId"), true);
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
