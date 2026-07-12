const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererPath = path.join(root, "src", "renderer", "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testsPath = path.join(root, "tests", "renderer-core-modules.test.js");

function extractUntilMarker(source, startMarker, endMarker, includeEndMarker = false) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`找不到區塊起點：${startMarker}`);
  const endStart = source.indexOf(endMarker, start + startMarker.length);
  if (endStart < 0) throw new Error(`找不到區塊終點：${endMarker}`);
  const end = includeEndMarker ? endStart + endMarker.length : endStart;
  return {
    block: source.slice(start, end).trim(),
    source: source.slice(0, start) + source.slice(end)
  };
}

function extractBeforeNextLine(source, startMarker, nextMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`找不到區塊起點：${startMarker}`);
  const boundary = source.indexOf(`\n${nextMarker}`, start + startMarker.length);
  if (boundary < 0) throw new Error(`找不到下一區塊：${nextMarker}`);
  return {
    block: source.slice(start, boundary).trim(),
    source: source.slice(0, start) + source.slice(boundary + 1)
  };
}

function writeModule(fileName, title, body) {
  const outputPath = path.join(root, "src", "renderer", fileName);
  const content = `/* ${title}\n * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。\n */\n\n${body.trim()}\n`;
  fs.writeFileSync(outputPath, content, "utf8");
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const originalLineCount = renderer.split(/\r?\n/).length;

const constantsResult = extractUntilMarker(
  renderer,
  "const COLORS = [",
  "const SCHEDULE_HISTORY_LIMIT = 20;",
  true
);
renderer = constantsResult.source;

const recordsResult = extractBeforeNextLine(
  renderer,
  "function createRecordsState() {",
  "let scheduleUndoStack = [];"
);
renderer = recordsResult.source;

const settingsNavigationResult = extractBeforeNextLine(
  renderer,
  "function getSettingsScrollElement(selector = \"\") {",
  "function renderStickyTableHeader(dates) {"
);
renderer = settingsNavigationResult.source;

const scheduleLayoutResult = extractBeforeNextLine(
  renderer,
  "function renderStickyTableHeader(dates) {",
  "function scheduleKey(memberId, year, month, day) {"
);
renderer = scheduleLayoutResult.source;

const dateUtilsResult = extractBeforeNextLine(
  renderer,
  "function scheduleKey(memberId, year, month, day) {",
  "function reportValidationError(message) {"
);
renderer = dateUtilsResult.source;

renderer = renderer.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n");
const nextLineCount = renderer.split(/\r?\n/).length;
if (originalLineCount - nextLineCount < 650) {
  throw new Error(`renderer.js 拆分行數不足：${originalLineCount} -> ${nextLineCount}`);
}
if (nextLineCount >= 7300) {
  throw new Error(`renderer.js 仍過長：${nextLineCount} 行`);
}

writeModule(
  "renderer-foundation.js",
  "排班主程式共用常數與初始狀態工廠",
  `${constantsResult.block}\n\n${recordsResult.block}`
);
writeModule(
  "renderer-settings-navigation.js",
  "設定彈窗捲動位置與返回狀態",
  settingsNavigationResult.block
);
writeModule(
  "renderer-schedule-layout.js",
  "班表固定表頭與欄寬版面計算",
  scheduleLayoutResult.block
);
writeModule(
  "renderer-date-utils.js",
  "班表日期、週期、時間與區間工具",
  dateUtilsResult.block
);
fs.writeFileSync(rendererPath, renderer, "utf8");

let build = fs.readFileSync(buildPath, "utf8");
const manifestAnchor = '  "v2-meal-api.js",\n  "renderer.js",';
const manifestReplacement = [
  '  "v2-meal-api.js",',
  '  "renderer-foundation.js",',
  '  "renderer-settings-navigation.js",',
  '  "renderer-schedule-layout.js",',
  '  "renderer-date-utils.js",',
  '  "renderer.js",'
].join("\n");
if (!build.includes(manifestAnchor)) {
  throw new Error("找不到 build-js.js 的 renderer 模組插入位置");
}
build = build.replace(manifestAnchor, manifestReplacement);
fs.writeFileSync(buildPath, build, "utf8");

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function evaluateModule(fileName, exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", fileName), "utf8");
  return vm.runInNewContext(\`\${source}\\n;\${exportExpression}\`, context);
}

test("renderer foundation 應保留目錄與預設狀態", () => {
  const foundation = evaluateModule(
    "renderer-foundation.js",
    "({ COLORS, LEAVE_CATALOG, DEFAULT_STATE, ROLE_OPTIONS, createRecordsState })",
    {
      getTodayDateString: () => "2026-07-12",
      addDaysToDateString: (value, days) => days === -30 ? "2026-06-12" : value
    }
  );

  assert.equal(foundation.COLORS.length, 23);
  assert.equal(foundation.LEAVE_CATALOG.some((item) => item.code === "0036" && item.name === "例假"), true);
  assert.equal(foundation.DEFAULT_STATE.rules.maxConsecutiveWorkDays, 6);
  assert.equal(foundation.ROLE_OPTIONS.map((item) => item.value).join(","), "admin,manager,employee");

  const records = foundation.createRecordsState();
  assert.equal(records.mealFilters.fromDate, "2026-07-12");
  assert.equal(records.overtimeReview.filters.fromDate, "2026-06-12");
  assert.equal(records.attendanceAdmin.filters.abnormalOnly, true);
});

test("日期與時間工具應正確處理格式及區間", () => {
  const utils = evaluateModule(
    "renderer-date-utils.js",
    "({ toDateString, toDateObject, enumerateDateRange, normalizeTimeText, toMinutes, isValidTimeRange, isValidDateRange, isValidDateTimeRange, isMemberActiveOnDateString })"
  );

  assert.equal(utils.toDateString(2026, 6, 2), "2026-07-02");
  assert.equal(utils.toDateObject("2026-07-02").getFullYear(), 2026);
  assert.equal(utils.enumerateDateRange("2026-07-01", "2026-07-03").join(","), "2026-07-01,2026-07-02,2026-07-03");
  assert.equal(utils.normalizeTimeText("8:5"), "08:05");
  assert.equal(utils.normalizeTimeText("24:00"), "");
  assert.equal(utils.toMinutes("18:30"), 1110);
  assert.equal(utils.isValidTimeRange("08:00", "17:00"), true);
  assert.equal(utils.isValidTimeRange("17:00", "08:00"), false);
  assert.equal(utils.isValidDateRange("2026-07-01", "2026-07-02"), true);
  assert.equal(utils.isValidDateTimeRange("2026-07-01", "23:00", "2026-07-02", "01:00"), true);
  assert.equal(utils.isMemberActiveOnDateString({ hireDate: "2026-07-02", leaveDate: "2026-07-04" }, "2026-07-03"), true);
  assert.equal(utils.isMemberActiveOnDateString({ hireDate: "2026-07-02", leaveDate: "2026-07-04" }, "2026-07-05"), false);
});

test("renderer.js 不應再保存已拆出的核心區塊", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "const COLORS = [",
    "function createRecordsState() {",
    "function getSettingsScrollElement(selector = \"\") {",
    "function renderStickyTableHeader(dates) {",
    "function scheduleKey(memberId, year, month, day) {"
  ];

  for (const marker of movedMarkers) {
    assert.equal(renderer.includes(marker), false, \`renderer.js 仍包含：\${marker}\`);
  }

  const moduleOrder = [
    "renderer-foundation.js",
    "renderer-settings-navigation.js",
    "renderer-schedule-layout.js",
    "renderer-date-utils.js",
    "renderer.js"
  ].map((name) => build.indexOf(\`\"\${name}\"\`));
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\\r?\\n/).length < 7300, true);
});
`;
fs.mkdirSync(path.dirname(testsPath), { recursive: true });
fs.writeFileSync(testsPath, testSource, "utf8");

console.log(`renderer.js 已由 ${originalLineCount} 行降至 ${nextLineCount} 行。`);
