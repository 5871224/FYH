const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("訂餐管理前端 action 必須與 meal-order 後端一致", () => {
  const webApi = fs.readFileSync(path.join(root, "src", "renderer", "web-api.js"), "utf8");
  const sourceApp = fs.readFileSync(path.join(root, "src", "renderer", "app.js"), "utf8");
  const publishedApp = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");
  const mealOrder = fs.readFileSync(path.join(root, "supabase", "functions", "meal-order", "index.ts"), "utf8");

  const requiredActions = ["admin_settings", "save_admin_settings", "delete_admin_product"];
  requiredActions.forEach((action) => {
    assert.equal(webApi.includes(`action: "${action}"`), true, `來源前端缺少 action：${action}`);
    assert.equal(sourceApp.includes(`action: "${action}"`), true, `執行 bundle 缺少 action：${action}`);
    assert.equal(publishedApp.includes(`action: "${action}"`), true, `發布 bundle 缺少 action：${action}`);
    assert.equal(mealOrder.includes(`body?.action === "${action}"`), true, `後端缺少 action：${action}`);
  });

  [webApi, sourceApp, publishedApp].forEach((source) => {
    assert.equal(source.includes('action: "admin_get"'), false);
    assert.equal(source.includes('action: "admin_save"'), false);
  });
  assert.equal(sourceApp, publishedApp);
});
