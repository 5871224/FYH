const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase8-page-data.test.js");

const source = fs.readFileSync(rendererPath, "utf8");
const attendanceStart = source.indexOf("function formatClockTime");
const mealStart = source.indexOf("async function loadTodayMealOrder", attendanceStart);
const recordsStart = source.indexOf("async function loadRecordsPage", mealStart);
const end = source.indexOf("function resolveCurrentMember", recordsStart);
if (attendanceStart < 0 || mealStart <= attendanceStart || recordsStart <= mealStart || end <= recordsStart) {
  throw new Error("找不到頁面資料控制函式的安全拆分邊界");
}

const attendanceSource = source.slice(attendanceStart, mealStart).trim();
const mealSource = source.slice(mealStart, recordsStart).trim();
const recordsSource = source.slice(recordsStart, end).trim();
const nextRenderer = (source.slice(0, attendanceStart) + source.slice(end)).replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(path.join(rendererDir, "renderer-attendance-page.js"), `/* 打卡頁資料讀取與打卡控制。\n * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。\n */\n\n${attendanceSource}\n`);
fs.writeFileSync(path.join(rendererDir, "renderer-meal-page.js"), `/* 今日訂餐資料讀取、即時計算與儲存控制。\n * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。\n */\n\n${mealSource}\n`);
fs.writeFileSync(path.join(rendererDir, "renderer-records-page.js"), `/* 記錄頁及主管報表資料讀取控制。\n * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。\n */\n\n${recordsSource}\n`);
fs.writeFileSync(rendererPath, nextRenderer);

let build = fs.readFileSync(buildPath, "utf8");
const marker = `  "renderer-overtime-employee.js",\n  "renderer.js",`;
const replacement = `  "renderer-overtime-employee.js",\n  "renderer-attendance-page.js",\n  "renderer-meal-page.js",\n  "renderer-records-page.js",\n  "renderer.js",`;
if (!build.includes(marker)) throw new Error("找不到 JavaScript 建置順序插入點");
build = build.replace(marker, replacement);
fs.writeFileSync(buildPath, build);

const testSource = `const test = require("node:test");
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
  const api = vm.runInNewContext(attendance.slice(start, end) + "\\n;({ getBrowserPosition })", context);
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
  const api = vm.runInNewContext(meal.slice(start, end) + "\\n;({ getMealOrderLiveSummary })", context);
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
  let previous = -1;
  ordered.forEach((file) => {
    const index = build.indexOf(\`"\${file}"\`);
    assert.ok(index > previous, \`建置順序錯誤：\${file}\`);
    previous = index;
  });
  ["formatClockTime", "loadTodayMealOrder", "loadRecordsPage", "loadMealAdminSettings"].forEach((name) => {
    assert.equal(renderer.includes(\`function \${name}\`), false, \`renderer.js 仍保留 \${name}\`);
  });
  assert.ok(renderer.split("\\n").length < 3550, "renderer.js 未明顯縮小");
});
`;
fs.writeFileSync(testPath, testSource);

console.log(JSON.stringify({
  attendanceLines: attendanceSource.split("\n").length,
  mealLines: mealSource.split("\n").length,
  recordsLines: recordsSource.split("\n").length,
  rendererLines: nextRenderer.split("\n").length
}));
