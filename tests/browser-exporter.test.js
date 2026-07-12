const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadExporter() {
  const previousWindow = global.window;
  global.window = {};
  const modulePath = path.resolve(__dirname, "../src/renderer/browser-exporter.js");
  delete require.cache[modulePath];
  require(modulePath);
  const exporter = global.window.schedulerBrowserExporter;
  if (previousWindow === undefined) {
    delete global.window;
  } else {
    global.window = previousWindow;
  }
  return exporter;
}

const exporter = loadExporter();

test("官方請假匯出應排除休例假、隱藏單位與無假別資料", () => {
  const rows = exporter.getLeaveExportRows({
    state: {
      departments: [{ id: "hidden", hiddenFromSchedule: true }]
    },
    exportRows: [
      {
        employee_code: "A001",
        work_date: "2026-07-17",
        home_department_id: "visible",
        leave_type_id: "leave-1",
        leave_code: "0010",
        leave_name: "事假",
        leave_reason: "家庭因素",
        leave_all_day: true
      },
      {
        employee_code: "A002",
        work_date: "2026-07-18",
        home_department_id: "visible",
        leave_type_id: "leave-2",
        leave_code: "0020",
        leave_name: "病假",
        leave_all_day: false,
        leave_start_time: "08:05:00",
        leave_end_time: "12:30:00"
      },
      {
        employee_code: "A003",
        work_date: "2026-07-19",
        home_department_id: "visible",
        leave_type_id: "leave-rest",
        leave_code: "0036",
        leave_name: "例假"
      },
      {
        employee_code: "A004",
        work_date: "2026-07-20",
        home_department_id: "hidden",
        leave_type_id: "leave-hidden",
        leave_code: "0010",
        leave_name: "事假"
      },
      {
        employee_code: "A005",
        work_date: "2026-07-21",
        home_department_id: "visible",
        leave_type_id: null,
        leave_code: "0010",
        leave_name: "事假"
      }
    ]
  });

  assert.deepEqual(rows, [
    ["A001", "20260717", "20260717", "", "", "0010", "家庭因素"],
    ["A002", "20260718", "20260718", "0805", "1230", "0020", "病假"]
  ]);
});

test("官方加班匯出應正確輸出時間與休息區段", () => {
  const rows = exporter.getOvertimeExportRows({
    exportRows: [
      {
        employee_code: "A001",
        work_date: "2026-07-17",
        overtime_type_id: "ot-1",
        overtime_start_time: "18:00:00",
        overtime_end_time: "21:30:00",
        overtime_use_rest_1: true,
        overtime_rest_1_start_time: "19:00:00",
        overtime_rest_1_end_time: "19:30:00",
        overtime_use_rest_2: false
      },
      {
        employee_code: "A002",
        work_date: "2026-07-18",
        overtime_type_id: null,
        overtime_start_time: "18:00:00",
        overtime_end_time: "20:00:00"
      }
    ]
  });

  assert.deepEqual(rows, [[
    "A001", "20260717", "1800", "2130", 0, 1,
    "1900", "1930", 0,
    "", "", ""
  ]]);
});

test("SAP 休例假匯出應套用代碼並排除日薪人員", () => {
  const rows = exporter.getSapLeaveExportRows({
    exportRows: [
      {
        employee_name: "王小明",
        employee_code: "A001",
        work_date: "2026-07-17",
        pay_by_day: false,
        leave_type_id: "leave-rest",
        leave_code: "0047",
        leave_name: "休息日"
      },
      {
        employee_name: "陳小華",
        employee_code: "A002",
        work_date: "2026-07-18",
        pay_by_day: false,
        leave_type_id: "leave-off",
        leave_code: "",
        leave_name: "例假"
      },
      {
        employee_name: "日薪人員",
        employee_code: "A003",
        work_date: "2026-07-19",
        pay_by_day: true,
        leave_type_id: "leave-rest",
        leave_code: "0047",
        leave_name: "休息日"
      }
    ]
  });

  assert.deepEqual(rows, [
    ["王小明", "A001", "20260717", "20260717", "REST"],
    ["陳小華", "A002", "20260718", "20260718", "OFF"]
  ]);
});

test("舊格式匯出應依到職與離職日期限制資料", () => {
  const rows = exporter.getSapLeaveExportRows({
    year: 2026,
    month: 4,
    state: {
      members: [{
        id: "member-1",
        name: "測試人員",
        code: "A001",
        hireDate: "2026-05-02",
        leaveDate: "2026-05-03",
        payByDay: false
      }],
      leaves: [{ id: "rest", name: "休息日", code: "0047" }],
      schedule: {
        member-1_2026_4_1: { leave: "rest" },
        member-1_2026_4_2: { leave: "rest" },
        member-1_2026_4_3: { leave: "rest" },
        member-1_2026_4_4: { leave: "rest" }
      }
    }
  });

  assert.deepEqual(rows, [
    ["測試人員", "A001", "20260502", "20260502", "REST"],
    ["測試人員", "A001", "20260503", "20260503", "REST"]
  ]);
});

test("SAP CSV 應保留 BOM 並正確跳脫逗號與雙引號", () => {
  const csv = exporter.buildSapLeaveCsvContent({
    year: 2026,
    month: 4,
    state: {
      members: [{
        id: "member-1",
        name: "王,小\"明",
        code: "A001",
        hireDate: "",
        leaveDate: "",
        payByDay: false
      }],
      leaves: [{ id: "rest", name: "休息日", code: "0047" }],
      schedule: {
        member-1_2026_4_2: { leave: "rest" }
      }
    }
  });

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(csv.includes('"王,小""明"'), true);
  assert.equal(csv.includes("A001,20260502,20260502,REST"), true);
});
