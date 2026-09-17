const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班別假別加班刪除只走明確 RPC 契約", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function resolveManagerMemberProfileId", start);
  const block = webApi.slice(start, end);
  assert.equal(block.includes('callRpc("delete_catalog_item_v3"'), true);
  assert.equal(block.includes('p_category: String(category || "")'), true);
  assert.equal(block.includes('p_item_id: String(itemId || "")'), true);
  assert.equal(block.includes('requestFunction("catalog-admin"'), false);
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
