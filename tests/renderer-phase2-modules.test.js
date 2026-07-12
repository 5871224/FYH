const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");

function evaluateModule(fileName, exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", fileName), "utf8");
  return vm.runInNewContext(`${source}\n;${exportExpression}`, context);
}

test("共用訊息與時間輸入工具應保留既有格式", () => {
  const helpers = evaluateModule(
    "renderer-ui-helpers.js",
    "({ formatSchedulerError, buildTimeOptions, splitTimeValue })",
    {
      normalizeTimeText: (value) => /^\d{2}:\d{2}$/.test(String(value)) ? String(value) : ""
    }
  );

  assert.equal(helpers.formatSchedulerError(new Error("一般錯誤")), "一般錯誤");
  assert.equal(helpers.formatSchedulerError(null, "備援訊息"), "備援訊息");
  assert.equal(helpers.buildTimeOptions("08", ["07", "08"]).includes('value="08" selected'), true);
  assert.deepEqual(Array.from(helpers.splitTimeValue("08:30")), ["08", "30"]);
});

test("任職與營運區間判定應包含起訖日", () => {
  const visibility = evaluateModule(
    "renderer-visibility.js",
    "({ isMemberActiveOnDate, doesDateRangeOverlapMonth, doesDateRangeOverlapRange, isDepartmentVisibleInSchedule, isDepartmentOperatingOnDate })",
    {
      toDateString: (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      daysInMonth: (year, month) => new Date(year, month + 1, 0).getDate(),
      getVisibleDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-08-25" })
    }
  );

  const member = { hireDate: "2026-07-02", leaveDate: "2026-07-04" };
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 2), true);
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 4), true);
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 5), false);
  assert.equal(visibility.doesDateRangeOverlapMonth("2026-06-20", "2026-07-01", 2026, 6), true);
  assert.equal(visibility.doesDateRangeOverlapRange("2026-08-25", "", "2026-07-01", "2026-08-25"), true);
  assert.equal(visibility.isDepartmentVisibleInSchedule({ hiddenFromSchedule: false }), true);
  assert.equal(visibility.isDepartmentOperatingOnDate({ startDate: "2026-07-01", endDate: "2026-07-31" }, "2026-07-31"), true);
});

test("狀態正規化工具應保留顏色與排班清理規則", () => {
  const normalization = evaluateModule(
    "renderer-state-normalization.js",
    "({ textColor, autoLeaveTextColor, sanitizeDepartment, sanitizeHoliday, cleanupScheduleEntries })",
    {
      COLORS: [{ hex: "#378ADD" }],
      LEAVE_CATALOG: [{ code: "0010", name: "事假" }],
      LEGACY_LEAVE_NAME_MAP: {},
      uid: (prefix) => `${prefix}-id`,
      normalizeRole: () => "employee",
      normalizeRestWeekday: () => 0,
      createEmptyState: () => ({}),
      toDateObject: () => null,
      normalizeScheduleLoadedRanges: () => []
    }
  );

  assert.equal(normalization.textColor("#ffffff"), "#2b241c");
  assert.equal(normalization.autoLeaveTextColor("#000000"), "#ffffff");
  assert.equal(normalization.sanitizeDepartment({ name: "測試單位" }, 0).name, "測試單位");
  assert.equal(normalization.sanitizeHoliday({ date: "2026-07-12", name: "測試假日" }, 0).date, "2026-07-12");

  const cleaned = normalization.cleanupScheduleEntries({
    A: { shift: "shift-1", leave: "missing", overtime: null },
    B: { shift: "missing", leave: null, overtime: null }
  }, {
    shifts: [{ id: "shift-1" }],
    leaves: [],
    overtime: []
  });
  assert.equal(Boolean(cleaned.A), true);
  assert.equal(Boolean(cleaned.B), false);
});

test("renderer 第二階段拆分應維持核心來源與建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "function reportValidationError(message) {",
    "function isMemberActiveOnDate(member, year, month, day) {",
    "function textColor(hex) {",
    "function normalizeState(payload) {"
  ];
  for (const marker of movedMarkers) assert.equal(renderer.includes(marker), false, `renderer.js 仍包含：${marker}`);

  const moduleOrder = RENDERER_CORE_FILES.map((name) => build.indexOf(`"${name}"`));
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\r?\n/).length < 6800, true);
  assert.equal(readRendererCore(root).includes("function normalizeState(payload)"), true);
});
