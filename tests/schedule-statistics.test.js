const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (name) => fs.readFileSync(path.join(__dirname, "../src/renderer", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function setup() {
  const state = {
    rules: { monthStartDay: 26 },
    departments: [{ id: "visible", name: "一般單位", groupId: "g" }, { id: "support", name: "支援單位", groupId: "g" }, { id: "hidden", name: "隱藏單位", groupId: "g", hiddenFromSchedule: true }, { id: "other-dept", name: "其他群組單位", groupId: "other" }],
    shifts: [{ id: "shift", applicableDeptId: "visible" }, { id: "support-shift", applicableDeptId: "support" }, { id: "hidden-shift", applicableDeptId: "hidden" }],
    leaves: [{ id: "rest", code: "0047" }],
    members: [
      { id: "a", code: "001", name: "同名人員", groupId: "g", deptId: "visible", hireDate: "2026-01-01" },
      { id: "b", code: "002", name: "同名人員", groupId: "g", deptId: "visible", hireDate: "2026-10-26", leaveDate: "2026-10-26" },
      { id: "zero", code: "003", name: "未排班", groupId: "g", deptId: "" },
      { id: "future", code: "004", groupId: "g", hireDate: "2026-10-27" },
      { id: "left", groupId: "g", leaveDate: "2026-10-25" },
      { id: "hidden", groupId: "g", deptId: "hidden" },
      { id: "other", code: "901", name: "其他群組員工", groupId: "other", deptId: "other-dept" },
      { id: "deleted", groupId: "g", deleted: true }
    ]
  };
  const schedule = {
    a_2026_9_25: { shift: "shift" },
    a_2026_9_26: { shift: "support-shift", leave: "rest", overtime: "overtime" },
    a_2026_9_27: { shift: "hidden-shift" },
    a_2026_9_28: { overtime: "overtime" },
    b_2026_9_26: { shift: "shift" },
    zero_2026_9_26: { leave: "rest" },
    hidden_2026_9_26: { shift: "shift" },
    other_2026_9_26: { shift: "shift" },
    deleted_2026_9_26: { shift: "shift" }
  };
  const button = { disabled: false, addEventListener: (_type, handler) => { button.click = handler; } };
  const inputs = { exportPeriodStart: { value: "2026-10-26" }, exportPeriodEnd: { value: "2026-10-28" } };
  const context = {
    state, groupFeatureState: { currentGroupId: "g", catalog: { departments: state.departments, members: state.members } },
    getAllGroups: () => [{ id: "g", name: "門市" }, { id: "other", name: "工廠" }],
    syncCurrentScopeIntoCatalog: () => {},
    document: { getElementById: (id) => id === "exportScheduleStatisticsButton" ? button : inputs[id] },
    window: { schedulerApi: {
      loadScheduleEntries: async (range) => { context.loaded = range; return { schedule }; },
      loadScheduleExportRows: async () => { context.authorized += 1; return []; }
    } },
    authorized: 0,
    requireCommonUiPermission: () => true,
    requireCurrentGroupUiPermission: () => true,
    hasGroupPermission: () => true,
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    openEntityListModal: (config) => { context.modal = config; },
    openDateRangeActionModal: (config) => { context.rangeModal = config; },
    getVisibleDateRange: () => ({ startDate: inputs.exportPeriodStart.value, endDate: inputs.exportPeriodEnd.value }),
    getTodayDateString: () => "2026-10-13",
    reportValidationError: (message) => { context.error = message; },
    showInfoMessage: (message) => { context.error = message; },
    setSaveStatus: () => {}
  };
  vm.createContext(context);
  vm.runInContext(["renderer-date-utils.js", "renderer-visibility.js", "renderer-export-actions.js"].map(read).join("\n"), context);
  context.getVisibleDateRange = () => ({ startDate: inputs.exportPeriodStart.value, endDate: inputs.exportPeriodEnd.value });
  return { context, state, button, inputs };
}

test("上班日統計按人員計算區間首尾與例休排班，保留零日並排除其他群組及隱藏單位", async () => {
  const { context } = setup();
  const { headers, rows } = await context.buildWorkdayStatisticsRows("2026-10-26", "2026-10-28");
  assert.deepEqual(plain(headers), ["工號", "姓名", "一般單位", "支援單位", "隱藏單位", "日數合計"]);
  assert.deepEqual(plain(rows), [
    ["001", "同名人員", 0, 1, 1, 2],
    ["002", "同名人員", 1, 0, 0, 1],
    ["003", "未排班", 0, 0, 0, 0],
    ["004", "", 0, 0, 0, 0]
  ]);
  assert.equal(context.loaded.startDate, "2026-10-26");
  assert.equal(context.loaded.endDate, "2026-10-28");
  assert.deepEqual(Array.from(context.loaded.members, (member) => member.id), ["a", "b", "zero", "future", "left", "deleted"]);
});

test("人數統計只採起算日當天在職，當天到離職皆計入，同名人員分別列出", () => {
  const { context } = setup();
  const { date, rows } = context.buildHeadcountStatistics(2026, 10);
  assert.equal(date, "2026-10-26");
  assert.deepEqual(plain(rows), [
    ["門市", "一般單位", "同名人員", "001", "2026-01-01", ""],
    ["門市", "一般單位", "同名人員", "002", "2026-10-26", "2026-10-26"],
    ["門市", "", "未排班", "003", "", ""],
    ["工廠", "其他群組單位", "其他群組員工", "901", "", ""]
  ]);
});

test("起算日超過月底時使用月底，涵蓋平年、閏年及跨年月份並拒絕無效輸入", () => {
  const { context, state } = setup();
  state.rules.monthStartDay = 31;
  for (const [year, month, expected] of [[2026, 2, "2026-02-28"], [2024, 2, "2024-02-29"], [2026, 12, "2026-12-31"], [2027, 1, "2027-01-31"]]) {
    assert.equal(context.buildHeadcountStatistics(year, month).date, expected);
  }
  for (const [year, month] of [[0, 1], [2026, 0], [2026, 13], [2026.5, 1], [2026, NaN]]) {
    assert.throws(() => context.buildHeadcountStatistics(year, month), /有效的年份/);
  }
  assert.equal(context.parseExportDate("2026-02-29"), null);
  assert.equal(context.parseExportDate("2026-04-31"), null);
});

test("統計入口沿用區間介面，拒絕無權限及後端匯出授權失敗", async () => {
  const { context } = setup();
  context.openExportPeriodDialog("workday-statistics");
  assert.equal(context.rangeModal.startDate, "2026-10-26");
  assert.equal(context.rangeModal.endDate, "2026-10-28");
  context.requireCommonUiPermission = () => false;
  await context.runPeriodExport("workday-statistics");
  assert.equal(context.authorized, 0);
  assert.equal(context.loaded, undefined);
  context.requireCommonUiPermission = () => true;
  context.window.schedulerApi.loadScheduleExportRows = async () => { throw new Error("沒有匯出權限"); };
  await context.runPeriodExport("workday-statistics");
  assert.equal(context.error, "統計失敗：沒有匯出權限");
  assert.equal(context.loaded, undefined);
  assert.equal(context.modal, undefined);
});

test("統計結果與 Excel 共用相同資料，工號保留前導零、日數為數字並顯示空結果", async () => {
  const { context, state, button } = setup();
  let workbook;
  class Workbook {
    constructor() { workbook = this; this.rows = []; }
    addWorksheet(name, options) {
      this.name = name; this.options = options;
      this.sheet = { addRow: (row) => this.rows.push(row), getRow: () => ({}), getColumn: () => ({}) };
      return this.sheet;
    }
  }
  context.window.schedulerBrowserExporter = { ensureExcelJS: async () => ({ Workbook }) };
  context.downloadScheduleWorkbook = async (_workbook, fileName) => { context.fileName = fileName; };
  await context.runPeriodExport("workday-statistics");
  assert.equal(context.authorized, 1);
  assert.match(context.modal.body, /<td>001<\/td><td>同名人員<\/td><td>0<\/td><td>1<\/td><td>1<\/td><td>2<\/td>/);
  await button.click({ currentTarget: button });
  assert.equal(workbook.name, "統計上班日");
  assert.equal(workbook.options.views[0].ySplit, 2);
  assert.equal(workbook.options.views[0].xSplit, 2);
  assert.deepEqual(plain(workbook.rows[1]), ["工號", "姓名", "一般單位", "支援單位", "隱藏單位", "日數合計"]);
  assert.equal(workbook.rows[2][0], "001");
  assert.equal(workbook.rows[2][3], 1);
  assert.equal(workbook.rows[2][5], 2);
  assert.equal(workbook.rows[0][0], "2026-10-26 ～ 2026-10-28；人員數：4");
  assert.equal(context.fileName, "統計上班日_20261026-20261028.xlsx");
  assert.equal(button.disabled, false);
  state.members = [];
  context.groupFeatureState.catalog.members = [];
  const result = context.buildHeadcountStatistics(2026, 10);
  context.showScheduleStatisticsResult("統計人數", `統計日期：${result.date}`, ["工號"], result.rows, "empty.xlsx");
  assert.match(context.modal.description, /人員數：0/);
  assert.match(context.modal.body, /目前沒有符合條件的人員/);
});

test("人數統計不限目前群組，但不能包含沒有查看權限的群組", () => {
  const { context, state } = setup();
  state.members = state.members.filter((member) => member.groupId === "g");
  state.departments = state.departments.filter((department) => department.groupId === "g");
  assert.deepEqual(plain(context.buildHeadcountStatistics(2026, 10).rows.map((row) => row[3])), ["001", "002", "003", "901"]);
  context.hasGroupPermission = (groupId, permission) => groupId === "g" && permission === "schedule_view";
  assert.deepEqual(plain(context.buildHeadcountStatistics(2026, 10).rows.map((row) => row[3])), ["001", "002", "003"]);
});
