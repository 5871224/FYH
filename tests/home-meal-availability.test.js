const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("首頁只讀最小群組資格，不在登入後預載完整班表", () => {
  const source = read("src/renderer/app-config.js");
  const published = read("docs/app-config.js");
  const lazySource = read("src/renderer/page-lazy-data.mjs");
  const lazyPublished = read("docs/page-lazy-data.mjs");

  assert.equal(published, source, "發布設定載入器必須與來源一致");
  assert.equal(lazyPublished, lazySource, "發布頁面懶載入模組必須與來源一致");
  assert.match(source, /page-lazy-data\.mjs\?v=20260807-schedule-first-load/);
  assert.doesNotMatch(source, /DOMContentLoaded|reloadGroupApplicationState/);
  assert.match(lazySource, /get_group_access_bundle_v1/, "登入階段只需取得角色、適用群組與群組訂餐資格");
  assert.match(lazySource, /groupEntitiesLoaded = false/, "登入階段不得把完整群組實體資料標記為已載入");
  assert.match(lazySource, /await reloadGroupApplicationState\(\)/, "完整班表只在進入班表時載入");
});
