const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("訂餐管理前端必須使用 FYH 具名 API", () => {
  const webApi = fs.readFileSync(path.join(root, "src", "renderer", "web-api.js"), "utf8");
  const sourceApp = fs.readFileSync(path.join(root, "src", "renderer", "app.js"), "utf8");
  const publishedApp = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");

  const requiredEndpoints = [
    "/api/v1/meal/admin",
    "/api/v1/meal/admin/product/delete"
  ];
  requiredEndpoints.forEach((endpoint) => {
    assert.equal(webApi.includes(endpoint), true, `來源前端缺少 API：${endpoint}`);
    assert.equal(sourceApp.includes(endpoint), true, `執行 bundle 缺少 API：${endpoint}`);
    assert.equal(publishedApp.includes(endpoint), true, `發布 bundle 缺少 API：${endpoint}`);
  });

  assert.match(webApi, /getMealAdminSettings[\s\S]*?request\("\/api\/v1\/meal\/admin"\)/);
  assert.match(webApi, /saveMealAdminSettings[\s\S]*?request\("\/api\/v1\/meal\/admin",\{method:"PUT",body:payload\}\)/);
  assert.match(webApi, /deleteMealProduct[\s\S]*?request\("\/api\/v1\/meal\/admin\/product\/delete",\{method:"POST"/);
  [webApi, sourceApp, publishedApp].forEach((source) => {
    assert.doesNotMatch(source, /action:\s*"(?:admin_settings|save_admin_settings|delete_admin_product|admin_get|admin_save)"/);
    assert.doesNotMatch(source, /\brequestFunction\s*\(/);
  });
  assert.equal(sourceApp, publishedApp);
});
