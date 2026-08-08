const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function evaluateModule(fileName, exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", fileName), "utf8");
  return vm.runInNewContext(`${source}\n;${exportExpression}`, context);
}

test("renderer foundation 應保留目錄與每日簽到預設狀態", () => {
  const foundation = evaluateModule(
    "renderer-foundation.js",
    "({ COLORS, LEAVE_CATALOG, DEFAULT_STATE, createRecordsState })",
    {
      getTodayDateString: () => "2026-07-12",
      addDaysToDateString: (value, days) => days === -30 ? "2026-06-12" : days === -49 ? "2026-05-24" : value
    }
  );

  assert.equal(foundation.COLORS.length, 23);
  assert.equal(foundation.LEAVE_CATALOG.some((item) => item.code === "0036" && item.name === "例假"), true);
  assert.equal(foundation.DEFAULT_STATE.rules.maxConsecutiveWorkDays, 6);

  const records = foundation.createRecordsState();
  assert.equal(records.mealFilters.fromDate, "2026-07-12");
  assert.equal(records.personalFilters.fromDate, "2026-05-24");
  assert.equal(records.attendanceReview.filters.fromDate, "2026-06-12");
  assert.equal(records.attendanceReview.filters.status, "unreviewed");
  assert.equal(records.attendanceReview.rows.length, 0);
  assert.equal(Object.hasOwn(records, "overtimeReview"), false);
  assert.equal(Object.hasOwn(records, "attendanceAdmin"), false);
});

test("日期與時間工具應正確處理格式及區間", () => {
  const utils = evaluateModule(
    "renderer-date-utils.js",
    "({ toDateString, toDateObject, enumerateDateRange, normalizeTimeText, toMinutes, isValidTimeRange, isValidDateRange, isMemberActiveOnDateString })"
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
  assert.equal(utils.isMemberActiveOnDateString({ hireDate: "2026-07-02", leaveDate: "2026-07-04" }, "2026-07-03"), true);
  assert.equal(utils.isMemberActiveOnDateString({ hireDate: "2026-07-02", leaveDate: "2026-07-04" }, "2026-07-05"), false);
});

test("renderer.js 不應再保存已拆出的核心區塊", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "const COLORS = [",
    "function createRecordsState() {",
    'function getSettingsScrollElement(selector = "") {',
    "function renderStickyTableHeader(dates) {",
    "function scheduleKey(memberId, year, month, day) {"
  ];

  for (const marker of movedMarkers) {
    assert.equal(renderer.includes(marker), false, `renderer.js 仍包含：${marker}`);
  }

  const moduleOrder = [
    "renderer-foundation.js",
    "renderer-settings-navigation.js",
    "renderer-schedule-layout.js",
    "renderer-date-utils.js",
    "renderer.js"
  ].map((name) => build.indexOf(`"${name}"`));
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\r?\n/).length < 7300, true);
});
