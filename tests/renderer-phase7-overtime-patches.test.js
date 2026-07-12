const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 以整併前最終載入後的實際打卡與加班畫面作為回歸基準。
const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "src", "renderer", "renderer-overtime-employee.js");

function evaluate(state = {}) {
  const source = fs.readFileSync(modulePath, "utf8");
  const context = {
    attendanceOvertimeState: { expanded: false, loading: false, status: null, error: "", dates: [], ...state },
    getTodayDateString: () => "2026-07-12",
    escapeHtml: String,
    formatClockTime: () => "08:30",
    getOvertimeStatusLabel: (status) => status === "approved" ? "已核准" : status === "returned" ? "退回" : "待審",
    isLoggedIn: () => true,
    renderAll: () => {},
    showInfoMessage: () => {},
    confirmAction: async () => true,
    window: { schedulerApi: {} },
    document: { addEventListener: () => {}, getElementById: () => null },
    HTMLSelectElement: class {}
  };
  return { context, api: vm.runInNewContext(source + "\n;({ formatClockButtonStatus, renderTodayOvertimePanel, renderOvertimeEstimate })", context) };
}

test("打卡按鈕狀態應保留時間、單位與打卡方式", () => {
  const { api } = evaluate();
  const text = api.formatClockButtonStatus({ clock_in_at: "2026-07-12T00:30:00Z", clock_in_department_name_snapshot: "門市", clock_in_source: "GPS" }, "in");
  assert.equal(text, "08:30 在【門市】打卡 (GPS)");
  assert.equal(api.formatClockButtonStatus({}, "out"), "尚未打卡");
});

test("加班面板收合時應只顯示勾選入口", () => {
  const { api } = evaluate({ expanded: false });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes("overtime-request-toggle-only"), true);
  assert.equal(html.includes("overtimeWorkDate"), false);
});

test("可申請加班時應保留日期、估算、雙欄時數與備註", () => {
  const { api } = evaluate({
    expanded: true,
    selectedWorkDate: "2026-07-11",
    dates: [{ workDate: "2026-07-10" }],
    status: {
      shift: { name: "早班", start_time: "8:00", end_time: "17:00" },
      attendance: { clock_in_at: "2026-07-11T00:00:00Z", clock_out_at: "2026-07-11T10:00:00Z" },
      eligibility: { eligible: true, earlyHours: 0.5, lateHours: 1, totalHours: 1.5 }
    }
  });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes('id="overtimeWorkDate"'), true);
  assert.equal(html.includes("2026-07-11") && html.includes("2026-07-10"), true);
  assert.equal(html.includes("overtime-estimate-text") && html.includes("估算 1.5 小時"), true);
  assert.equal(html.includes("overtime-hours-grid") && html.includes('id="overtimeEmployeeNote" type="text"'), true);
});

test("既有申請應保留打卡異動警告與刪除規則", () => {
  const { api } = evaluate({
    expanded: true,
    selectedWorkDate: "2026-07-11",
    status: { request: { status: "returned", total_overtime_hours: 2, early_overtime_hours: 1, late_overtime_hours: 1, attendance_changed_warning: true } }
  });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes("打卡時間已異動，需重新審核"), true);
  assert.equal(html.includes("data-delete-today-overtime"), true);
});

test("員工加班應只有一個正式模組且不再覆蓋全域函式", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-overtime-employee.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-clock-page-refinement.js")), false);
  assert.equal(build.includes("renderer-overtime-employee.js"), true);
  assert.equal(build.includes("v2-overtime-employee.js") || build.includes("v2-clock-page-refinement.js"), false);
  ["formatClockButtonStatus", "loadTodayAttendanceOvertime", "submitTodayOvertimeRequest", "deleteTodayOvertimeRequest", "renderTodayOvertimePanel"].forEach((name) => {
    assert.equal(source.includes(name + " = function"), false);
    assert.equal((source.match(new RegExp("function " + name + "\\b", "g")) || []).length, 1);
    assert.equal(renderer.includes("function " + name), false);
  });
});
