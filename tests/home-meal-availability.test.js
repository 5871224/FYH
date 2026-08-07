const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("首頁訂餐資格應先快速載入，再等待完整群組班表初始化", () => {
  const source = read("src/renderer/app-config.js");
  const published = read("docs/app-config.js");

  assert.equal(published, source, "發布設定載入器必須與來源一致");
  assert.match(source, /async \(\) => \{[\s\S]*loadGroupAccessData\(\)[\s\S]*syncPermissionUi\(\)/, "首頁應獨立載入群組資格並立即同步按鈕");

  const quickAccessIndex = source.indexOf("await loadGroupAccessForHome()");
  const fullReloadIndex = source.indexOf("await reloadGroupApplicationState()");
  assert.ok(quickAccessIndex >= 0, "缺少首頁群組資格快速載入");
  assert.ok(fullReloadIndex > quickAccessIndex, "首頁訂餐資格必須早於完整班表重新載入完成");
  assert.match(source, /retryGroupFeatureInitialization\(\)/, "快速資格載入失敗時必須可重試");
});
