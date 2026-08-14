const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定正式 web-api 對 FYH Backend 的小型 API 契約。
const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");

function extractFunctions(names, endName) {
  const source = fs.readFileSync(webApiPath, "utf8");
  const start = Math.min(...names.map((name) => source.indexOf("async function " + name + "(")));
  const end = source.indexOf("async function " + endName + "(", start + 1);
  if (start < 0 || end <= start) throw new Error("找不到 API 函式區段");
  return source.slice(start, end);
}

test("今日打卡狀態應透過 FYH attendance today API 查詢", async () => {
  const source = extractFunctions(["getTodayAttendance"], "clockAttendance");
  const calls = [];
  const context = {
    request: async (pathname, options) => { calls.push([pathname, options]); return { ok: true, serverDate: "2026-07-12" }; }
  };
  const api = vm.runInNewContext(source + "\n;({ getTodayAttendance })", context);
  const result = await api.getTodayAttendance();
  assert.equal(result.serverDate, "2026-07-12");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["/api/v1/attendance/today", null]]);
});

test("訂餐管理應保留設定並提供安全刪除品項操作", async () => {
  const source = extractFunctions(["getMealAdminSettings"], "getMealReport");
  const calls = [];
  const context = {
    request: async (pathname, options) => { calls.push([pathname, options]); return { ok: true }; }
  };
  const api = vm.runInNewContext(source + "\n;({ getMealAdminSettings, saveMealAdminSettings, deleteMealProduct })", context);
  const payload = { products: [{ id: "P1" }], dailyCutoffTime: "11:00", companySubsidy: 55 };
  await api.getMealAdminSettings();
  await api.saveMealAdminSettings(payload);
  await api.deleteMealProduct("P1");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["/api/v1/meal/admin", null],
    ["/api/v1/meal/admin", { method: "PUT", body: payload }],
    ["/api/v1/meal/admin/product/delete", { method: "POST", body: { productId: "P1" } }]
  ]);
});

test("小型 API 應由正式 web-api 提供而非後載入覆蓋", () => {
  const source = fs.readFileSync(webApiPath, "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-attendance-status.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-meal-api.js")), false);
  assert.equal(build.includes("v2-attendance-status.js") || build.includes("v2-meal-api.js"), false);
  assert.equal(source.includes('/api/v1/attendance/today'), true);
  assert.equal(source.includes('/api/v1/meal/admin'), true);
  assert.equal(source.includes('/api/v1/meal/admin/product/delete'), true);
  assert.doesNotMatch(source, /action:\s*"(?:today|admin_settings|save_admin_settings|delete_admin_product)"/);
  assert.match(source, /\bgetMealAdminSettings,saveMealAdminSettings,deleteMealProduct,/);
});
