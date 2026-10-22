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
  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
  return exporter;
}

const exporter = loadExporter();

test("正式請假匯出排除休例假、隱藏單位與無假別資料", () => {
  const rows = exporter.getLeaveExportRows({
    state: { departments: [{ id: "hidden", hiddenFromSchedule: true }] },
    exportRows: [
      { employee_code: "A001", work_date: "2026-07-17", home_department_id: "visible", leave_type_id: "leave-1", leave_code: "0010", leave_name: "事假", leave_reason: "家庭因素", leave_all_day: true },
      { employee_code: "A002", work_date: "2026-07-18", home_department_id: "visible", leave_type_id: "leave-2", leave_code: "0020", leave_name: "病假", leave_all_day: false, leave_start_time: "08:05:00", leave_end_time: "12:30:00" },
      { employee_code: "A003", work_date: "2026-07-19", home_department_id: "visible", leave_type_id: "leave-rest", leave_code: "0036", leave_name: "例假" },
      { employee_code: "A004", work_date: "2026-07-20", home_department_id: "hidden", leave_type_id: "leave-hidden", leave_code: "0010", leave_name: "事假" },
      { employee_code: "A005", work_date: "2026-07-21", home_department_id: "visible", leave_type_id: null, leave_code: "0010", leave_name: "事假" }
    ]
  });
  assert.deepEqual(rows, [
    ["A001", "20260717", "20260717", "", "", "0010", "家庭因素"],
    ["A002", "20260718", "20260718", "0805", "1230", "0020", "病假"]
  ]);
});

test("正式加班匯出輸出十二欄時間與休息區段", () => {
  const rows = exporter.getOvertimeExportRows({
    exportRows: [{
      employee_code: "A001",
      work_date: "2026-07-17",
      overtime_type_id: "ot-1",
      overtime_start_time: "18:00:00",
      overtime_end_time: "21:30:00",
      overtime_use_rest_1: true,
      overtime_rest_1_start_time: "19:00:00",
      overtime_rest_1_end_time: "19:30:00",
      overtime_use_rest_2: false
    }]
  });
  assert.deepEqual(rows, [["A001", "20260717", "1800", "2130", 0, 1, "1900", "1930", 0, "", "", ""]]);
});

test("正式 SAP 休例假匯出套用代碼並排除日薪人員", () => {
  const rows = exporter.getSapLeaveExportRows({
    exportRows: [
      { employee_name: "王小明", employee_code: "A001", work_date: "2026-07-17", pay_by_day: false, leave_type_id: "leave-rest", leave_code: "0047", leave_name: "休息日" },
      { employee_name: "陳小華", employee_code: "A002", work_date: "2026-07-18", pay_by_day: false, leave_type_id: "leave-off", leave_code: "", leave_name: "例假" },
      { employee_name: "日薪人員", employee_code: "A003", work_date: "2026-07-19", pay_by_day: true, leave_type_id: "leave-rest", leave_code: "0047", leave_name: "休息日" }
    ]
  });
  assert.deepEqual(rows, [
    ["王小明", "A001", "20260717", "20260717", "REST"],
    ["陳小華", "A002", "20260718", "20260718", "OFF"]
  ]);
});

test("SAP CSV 保留 BOM 並正確跳脫逗號與雙引號", () => {
  const csv = exporter.buildSapLeaveCsvContent({
    exportRows: [{ employee_name: '王,小"明', employee_code: "A001", work_date: "2026-05-02", pay_by_day: false, leave_type_id: "rest", leave_code: "0047", leave_name: "休息日" }]
  });
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(csv.includes('"王,小""明"'), true);
  assert.equal(csv.includes("A001,20260502,20260502,REST"), true);
});

test("簽到審核匯出 Excel：缺班別粉紅，例假及休息日加班黃色，正常班別不變", async () => {
  class FakeRow {
    constructor(values) { this.values = values; this.cells = new Map(); }
    getCell(index) {
      if (!this.cells.has(index)) this.cells.set(index, {value:this.values[index-1]});
      return this.cells.get(index);
    }
    eachCell(callback) {
      this.values.forEach((value, index) => {if (value !== undefined && value !== "") callback(this.getCell(index+1), index+1);});
    }
  }
  class FakeSheet {
    constructor(){this.rows=[];this.columns=[];}
    addRow(values){const row=new FakeRow(values);this.rows.push(row);return row;}
    getRow(index){return this.rows[index-1];}
    eachRow(callback){this.rows.forEach((row,index)=>callback(row,index+1));}
  }
  class FakeWorkbook {
    constructor(){this.sheet=new FakeSheet();}
    addWorksheet(){return this.sheet;}
  }
  const prev=global.ExcelJS;
  global.ExcelJS={Workbook:FakeWorkbook};
  const previousWindow=global.window;
  global.window={ExcelJS:global.ExcelJS};
  try {
    const workbook=await exporter.createOvertimeWorkbook({
      attendanceReview:true,
      exportRows:[
        {employee_code:"001",employee_name:"缺班",work_date:"2026-10-01",overtime_type_id:"attendance-ledger",overtime_start_time:"00:00",overtime_end_time:"03:30",missingScheduledShift:true},
        {employee_code:"002",employee_name:"正常",work_date:"2026-10-01",overtime_type_id:"attendance-ledger",overtime_start_time:"10:30",overtime_end_time:"11:30"},
        {employee_code:"003",employee_name:"例假加班",work_date:"2026-10-02",overtime_type_id:"attendance-rest-day",overtime_start_time:"08:00",overtime_end_time:"17:00"},
        {employee_code:"004",employee_name:"休息日加班",work_date:"2026-10-03",overtime_type_id:"attendance-rest-day",overtime_start_time:"08:00",overtime_end_time:"17:00"},
        {employee_code:"005",employee_name:"缺班別優先",work_date:"2026-10-04",overtime_type_id:"attendance-rest-day",overtime_start_time:"00:00",overtime_end_time:"03:30",missingScheduledShift:true}
      ]
    });
    const missing=workbook.sheet.getRow(2), normal=workbook.sheet.getRow(3);
    const offDay=workbook.sheet.getRow(4), restDay=workbook.sheet.getRow(5), missingPriority=workbook.sheet.getRow(6);
    assert.equal(missing.values.length,15);
    assert.equal(missing.getCell(1).value,"缺班");
    assert.equal(missing.getCell(3).value,"四");
    assert.equal(missing.getCell(4).value,"");
    assert.equal(missing.getCell(6).value,"0000");
    assert.equal(missing.getCell(7).value,"0330");
    for(let i=1;i<=15;i++) assert.equal(missing.getCell(i).fill?.fgColor?.argb,"FFFFE4EC");
    for(let i=1;i<=15;i++) {
      assert.equal(normal.getCell(i).fill,undefined);
      assert.equal(offDay.getCell(i).fill?.fgColor?.argb,"FFFFF2CC");
      assert.equal(restDay.getCell(i).fill?.fgColor?.argb,"FFFFF2CC");
      assert.equal(missingPriority.getCell(i).fill?.fgColor?.argb,"FFFFE4EC");
    }
  } finally {
    if(prev===undefined) delete global.ExcelJS;
    else global.ExcelJS=prev;
    if(previousWindow===undefined) delete global.window;
    else global.window=previousWindow;
  }
});
