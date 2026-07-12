const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runtimePaths = [
  path.join(root, "src", "renderer", "web-api.js"),
  path.join(root, "src", "renderer", "app.js"),
  path.join(root, "docs", "app.js")
];
const regressionTestPath = path.join(root, "tests", "renderer-phase7-small-api-overrides.test.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");

function replaceRequired(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`找不到待修正內容：${label}`);
  }
  return source.replaceAll(oldValue, newValue);
}

for (const runtimePath of runtimePaths) {
  let source = fs.readFileSync(runtimePath, "utf8");
  source = replaceRequired(source, 'action: "admin_get"', 'action: "admin_settings"', `${path.relative(root, runtimePath)} 訂餐設定讀取 action`);
  source = replaceRequired(source, 'action: "admin_save"', 'action: "save_admin_settings"', `${path.relative(root, runtimePath)} 訂餐設定儲存 action`);
  fs.writeFileSync(runtimePath, source);
}

let regressionTest = fs.readFileSync(regressionTestPath, "utf8");
regressionTest = replaceRequired(regressionTest, '["meal-order", { action: "admin_get" }]', '["meal-order", { action: "admin_settings" }]', "讀取 API 測試");
regressionTest = replaceRequired(regressionTest, '["meal-order", { action: "admin_save", products:', '["meal-order", { action: "save_admin_settings", products:', "儲存 API 測試");
regressionTest = replaceRequired(regressionTest, "source.includes('action: \"admin_get\"')", "source.includes('action: \"admin_settings\"')", "讀取結構測試");
regressionTest = replaceRequired(regressionTest, "source.includes('action: \"admin_save\"')", "source.includes('action: \"save_admin_settings\"')", "儲存結構測試");
fs.writeFileSync(regressionTestPath, regressionTest);

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
const anchor = 'assert(sourceWebApi.includes("async function deleteMealProduct") && sourceWebApi.includes(\'action: "delete_admin_product"\'), "前端 API 缺少刪除品項操作");';
const replacement = `${anchor}\nassert(sourceWebApi.includes('action: "admin_settings"') && sourceWebApi.includes('action: "save_admin_settings"'), "訂餐管理 API 操作名稱與後端不一致");\nassert(!sourceWebApi.includes('action: "admin_get"') && !sourceWebApi.includes('action: "admin_save"'), "訂餐管理仍使用後端不支援的操作名稱");`;
finalCheck = replaceRequired(finalCheck, anchor, replacement, "訂餐 API 最終檢查位置");
fs.writeFileSync(finalCheckPath, finalCheck);

const alignmentTestPath = path.join(root, "tests", "meal-admin-api-alignment.test.js");
fs.writeFileSync(alignmentTestPath, `const test = require("node:test");
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
    assert.equal(webApi.includes(\`action: "\${action}"\`), true, \`來源前端缺少 action：\${action}\`);
    assert.equal(sourceApp.includes(\`action: "\${action}"\`), true, \`執行 bundle 缺少 action：\${action}\`);
    assert.equal(publishedApp.includes(\`action: "\${action}"\`), true, \`發布 bundle 缺少 action：\${action}\`);
    assert.equal(mealOrder.includes(\`body?.action === "\${action}"\`), true, \`後端缺少 action：\${action}\`);
  });

  [webApi, sourceApp, publishedApp].forEach((source) => {
    assert.equal(source.includes('action: "admin_get"'), false);
    assert.equal(source.includes('action: "admin_save"'), false);
  });
  assert.equal(sourceApp, publishedApp);
});
`);

console.log("訂餐管理 API action 已與後端對齊，來源與發布 bundle 已同步");
