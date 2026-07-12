const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const webApiPath = path.join(rendererDir, "web-api.js");
const attendancePatchPath = path.join(rendererDir, "v2-attendance-status.js");
const mealPatchPath = path.join(rendererDir, "v2-meal-api.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");
const testPath = path.join(root, "tests", "renderer-phase7-small-api-overrides.test.js");

let webApi = fs.readFileSync(webApiPath, "utf8");
const oldAttendance = `  async function getTodayAttendance() {
    ensureSignedIn();
    const serverDate = taipeiDateString();
    const rows = await restSelect("attendance_records", {
      select: "*",
      filters: {
        user_id: \`eq.\${currentSession.user.id}\`,
        work_date: \`eq.\${serverDate}\`
      },
      limit: "1",
      auth: true
    });
    return {
      ok: true,
      profile: currentProfile,
      record: rows?.[0] || null,
      serverDate
    };
  }`;
const newAttendance = `  async function getTodayAttendance() {
    ensureSignedIn();
    return requestFunction("attendance-clock", {
      action: "today"
    });
  }`;
if (!webApi.includes(oldAttendance)) throw new Error("找不到今日打卡正式函式");
webApi = webApi.replace(oldAttendance, newAttendance);

const oldMealAdmin = `  async function getMealAdminSettings() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "admin_settings"
    });
  }

  async function saveMealAdminSettings(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "save_admin_settings",
      products: Array.isArray(payload.products) ? payload.products : [],
      dailyCutoffTime: payload.dailyCutoffTime || "10:30"
    });
  }`;
const newMealAdmin = `  async function getMealAdminSettings() {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "admin_get"
    });
  }

  async function saveMealAdminSettings(payload = {}) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "admin_save",
      products: Array.isArray(payload.products) ? payload.products : [],
      dailyCutoffTime: payload.dailyCutoffTime || "10:30",
      companySubsidy: Number(payload.companySubsidy)
    });
  }

  async function deleteMealProduct(productId) {
    ensureSignedIn();
    return requestFunction("meal-order", {
      action: "delete_admin_product",
      productId: String(productId || "")
    });
  }`;
if (!webApi.includes(oldMealAdmin)) throw new Error("找不到訂餐管理正式函式");
webApi = webApi.replace(oldMealAdmin, newMealAdmin);
const exportMarker = "    getMealAdminSettings,\n    saveMealAdminSettings,\n    getMealReport,";
if (!webApi.includes(exportMarker)) throw new Error("找不到訂餐管理 API 輸出位置");
webApi = webApi.replace(exportMarker, "    getMealAdminSettings,\n    saveMealAdminSettings,\n    deleteMealProduct,\n    getMealReport,");
fs.writeFileSync(webApiPath, webApi);

for (const filePath of [attendancePatchPath, mealPatchPath]) {
  if (!fs.existsSync(filePath)) throw new Error(`找不到待移除的 API 覆蓋檔：${filePath}`);
  fs.unlinkSync(filePath);
}

let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-attendance-status\.js",?\r?\n/m, "");
build = build.replace(/^\s*"v2-meal-api\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
finalCheck = finalCheck.replace(/^\s*"src\/renderer\/v2-meal-api\.js",?\r?\n/m, "");
finalCheck = finalCheck.replace(
  'assert(sourceWebApi.includes(\'restSelect("attendance_records"\') && sourceWebApi.includes("function getTodayAttendance"), "今日打卡紀錄應直接讀資料庫");',
  'assert(sourceWebApi.includes(\'requestFunction("attendance-clock", {\') && sourceWebApi.includes(\'action: "today"\'), "今日打卡紀錄應使用安全 Edge Function 回應");'
);
finalCheck = finalCheck.replace(
  'const sourceMealApi = read("src/renderer/v2-meal-api.js");\nassert(sourceMealApi.includes("deleteMealProduct"), "前端 API 缺少刪除品項操作");\nassert(sourceMealApi.includes("companySubsidy"), "前端 API 未傳送公司補助");',
  'assert(sourceWebApi.includes("async function deleteMealProduct") && sourceWebApi.includes(\'action: "delete_admin_product"\'), "前端 API 缺少刪除品項操作");\nassert(sourceWebApi.includes("companySubsidy: Number(payload.companySubsidy)"), "前端 API 未傳送公司補助");'
);
fs.writeFileSync(finalCheckPath, finalCheck);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定補丁整併前已生效的安全今日打卡與訂餐管理 API 行為。
const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");

function extractFunctions(names, endName) {
  const source = fs.readFileSync(webApiPath, "utf8");
  const start = Math.min(...names.map((name) => source.indexOf("async function " + name + "(")));
  const end = source.indexOf("async function " + endName + "(", start + 1);
  if (start < 0 || end <= start) throw new Error("找不到 API 函式區段");
  return source.slice(start, end);
}

test("今日打卡狀態應透過 attendance-clock today 查詢", async () => {
  const source = extractFunctions(["getTodayAttendance"], "clockAttendance");
  const calls = [];
  const context = {
    ensureSignedIn: () => calls.push("signed"),
    requestFunction: async (name, payload) => { calls.push([name, payload]); return { ok: true, serverDate: "2026-07-12" }; }
  };
  const api = vm.runInNewContext(source + "\\n;({ getTodayAttendance })", context);
  const result = await api.getTodayAttendance();
  assert.equal(result.serverDate, "2026-07-12");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ["attendance-clock", { action: "today" }]);
});

test("訂餐管理應保留補助並提供安全刪除品項操作", async () => {
  const source = extractFunctions(["getMealAdminSettings"], "getMealReport");
  const calls = [];
  const context = {
    ensureSignedIn: () => {},
    requestFunction: async (name, payload) => { calls.push([name, payload]); return { ok: true }; }
  };
  const api = vm.runInNewContext(source + "\\n;({ getMealAdminSettings, saveMealAdminSettings, deleteMealProduct })", context);
  await api.getMealAdminSettings();
  await api.saveMealAdminSettings({ products: [{ id: "P1" }], dailyCutoffTime: "11:00", companySubsidy: 55 });
  await api.deleteMealProduct("P1");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["meal-order", { action: "admin_get" }],
    ["meal-order", { action: "admin_save", products: [{ id: "P1" }], dailyCutoffTime: "11:00", companySubsidy: 55 }],
    ["meal-order", { action: "delete_admin_product", productId: "P1" }]
  ]);
});

test("小型 API 應由正式 web-api 提供而非後載入覆蓋", () => {
  const source = fs.readFileSync(webApiPath, "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-attendance-status.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-meal-api.js")), false);
  assert.equal(build.includes("v2-attendance-status.js") || build.includes("v2-meal-api.js"), false);
  assert.equal(source.includes('action: "today"'), true);
  assert.equal(source.includes('action: "admin_get"'), true);
  assert.equal(source.includes('action: "admin_save"'), true);
  assert.equal(source.includes('action: "delete_admin_product"'), true);
  assert.equal(source.includes("    deleteMealProduct,"), true);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("small API overrides merged into canonical web-api");
