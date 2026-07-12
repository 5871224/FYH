const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const attendance = read("src/renderer/renderer-attendance-page.js");
const meal = read("src/renderer/renderer-meal-page.js");
const records = read("src/renderer/renderer-records-page.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("電腦版打卡定位控制不應呼叫 GPS", async () => {
  const start = attendance.indexOf("function getBrowserPosition");
  const end = attendance.indexOf("async function loadTodayAttendance", start);
  const calls = [];
  const context = {
    navigator: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      maxTouchPoints: 0,
      geolocation: { getCurrentPosition: () => calls.push("gps") },
      userAgentData: { mobile: false }
    },
    window: {
      matchMedia: () => ({ matches: false }),
      screen: { width: 1440, height: 900 },
      innerWidth: 1440,
      innerHeight: 900
    },
    Promise
  };
  const api = vm.runInNewContext(attendance.slice(start, end) + "\n;({ getBrowserPosition })", context);
  const result = await api.getBrowserPosition();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {});
  assert.deepEqual(calls, []);
});

test("今日訂餐即時合計應只計算非負整數數量", () => {
  const start = meal.indexOf("function getMealOrderLiveSummary");
  const end = meal.indexOf("function updateMealOrderLiveSummary", start);
  const inputs = [
    { value: "2", dataset: { mealProductPrice: "80" } },
    { value: "1", dataset: { mealProductPrice: "55" } },
    { value: "-3", dataset: { mealProductPrice: "100" } }
  ];
  const context = { document: { querySelectorAll: () => inputs }, Math, Number };
  const api = vm.runInNewContext(meal.slice(start, end) + "\n;({ getMealOrderLiveSummary })", context);
  const result = api.getMealOrderLiveSummary();
  assert.equal(result.quantity, 3);
  assert.equal(result.amount, 215);
});

test("記錄頁資料控制應保留各正式 API", () => {
  assert.equal(records.includes("getPersonalRecords"), true);
  assert.equal(records.includes("getMealReport"), true);
  assert.equal(records.includes("getOvertimeReviewList"), true);
  assert.equal(records.includes("getAttendanceAdminRecords"), true);
  assert.equal(records.includes("getMealAdminSettings"), true);
});

test("第八階段應移出頁面資料控制並維持建置順序", () => {
  const ordered = [
    "renderer-overtime-employee.js",
    "renderer-attendance-page.js",
    "renderer-meal-page.js",
    "renderer-records-page.js",
    "renderer.js"
  ];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf(`"${file}"`);
      assert.ok(index > previous, `模組順序錯誤：${file}`);
      previous = index;
    });
  });
  ["formatClockTime", "loadTodayMealOrder", "loadRecordsPage", "loadMealAdminSettings"].forEach((name) => {
    assert.equal(renderer.includes(`function ${name}`), false, `renderer.js 仍保留 ${name}`);
  });
  assert.ok(renderer.split("\n").length < 3550, "renderer.js 未明顯縮小");
});
