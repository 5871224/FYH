const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadExporter() {
  const oldWindow = global.window;
  global.window = {};
  const modulePath = path.resolve(__dirname, "../src/renderer/browser-exporter.js");
  delete require.cache[modulePath];
  require(modulePath);
  const exporter = global.window.schedulerBrowserExporter;
  if (oldWindow === undefined) delete global.window;
  else global.window = oldWindow;
  return exporter;
}

test("特殊出勤匯出欄序、四碼時間、台灣打卡時間及休息日標記", () => {
  const rows = loadExporter().getSpecialAttendanceExportRows([
    {
      user_id: "member-1", employee_code: "0008", employee_name: "門市-王小明",
      work_date: "2026-11-04", shift: { start_time: "08:30:00", end_time: "17:30:00" },
      clock_in_at: "2026-11-04T00:25:00Z", clock_out_at: "2026-11-04T09:32:00Z",
      scheduleSegments: [{ category: "leave", code: "0047", name: "休息日" }]
    },
    {
      user_id: "member-2", employee_code: "0099", employee_name: "工廠-陳小姐",
      work_date: "2026-11-05", shift: { start_time: "22:30:00", end_time: "07:30:00" },
      clock_in_at: null, clock_out_at: null, scheduleSegments: []
    },
    { user_id: "member-3", employee_code: "0100", work_date: "2026-11-06", shift: null }
  ], [{ id: "member-1", full_name: "王小明" }, { id: "member-2", full_name: "陳小姐" }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    restDay: true,
    values: ["王小明", "0008", "20261104", "0830", "0830", "0001", "1", "1230", "1330", "", "", "0825", "1732"]
  });
  assert.deepEqual(rows[1], {
    restDay: false,
    values: ["陳小姐", "0099", "20261105", "2230", "2230", "0001", "1", "0230", "0330", "", "", "", ""]
  });
});

test("特殊出勤 Excel 只將休息日整列上亮黃底色，所有欄均保留文字格式", async () => {
  class FakeRow {
    constructor(values) { this.values = values; this.cells = new Map(); }
    getCell(index) {
      if (!this.cells.has(index)) this.cells.set(index, { value: this.values[index - 1] });
      return this.cells.get(index);
    }
    eachCell(callback) { this.values.forEach((value, index) => { if (value !== undefined && value !== "") callback(this.getCell(index + 1), index + 1); }); }
  }
  class FakeSheet {
    constructor() { this.rows = []; this.columns = []; }
    addRow(values) { const row = new FakeRow(values); this.rows.push(row); return row; }
    getRow(index) { return this.rows[index - 1]; }
    eachRow(callback) { this.rows.forEach((row, index) => callback(row, index + 1)); }
  }
  class FakeWorkbook {
    constructor() { this.sheet = new FakeSheet(); }
    addWorksheet() { return this.sheet; }
  }
  const oldExcel = global.ExcelJS, oldWindow = global.window;
  global.ExcelJS = { Workbook: FakeWorkbook };
  global.window = { ExcelJS: global.ExcelJS };
  try {
    const book = await loadExporter().createSpecialAttendanceWorkbook([
      { user_id: "A", employee_code: "0001", employee_name: "甲", work_date: "2026-11-04", shift: { start_time: "09:00:00" }, scheduleSegments: [{ category: "leave", code: "0047" }] },
      { user_id: "B", employee_code: "0002", employee_name: "乙", work_date: "2026-11-05", shift: { start_time: "10:00:00" }, scheduleSegments: [] }
    ], []);
    assert.deepEqual(book.sheet.getRow(1).values, [
      "姓名", "員工編號", "日期", "開始時間", "結束時間", "出勤類型", "補貼類型",
      "休息1-開始", "休息1-結束", "休息2-開始", "休息2-結束", "上班打卡", "下班打卡"
    ]);
    assert.equal(book.sheet.getRow(2).values.length, 13);
    for (let column = 1; column <= 13; column += 1) {
      const headerFill = book.sheet.getRow(1).getCell(column).fill;
      if ([1, 12, 13].includes(column)) {
        assert.equal(headerFill, undefined, `第 ${column} 欄標題應無底色`);
      } else {
        assert.equal(headerFill?.fgColor?.argb, "FFF3EBD8", `第 ${column} 欄標題應為原有匯出米色`);
      }
    }
    for (let column = 1; column <= 13; column += 1) {
      assert.equal(book.sheet.getRow(2).getCell(column).fill?.fgColor?.argb, "FFFFFF00");
      assert.equal(book.sheet.getRow(2).getCell(column).numFmt, "@");
      assert.equal(book.sheet.getRow(3).getCell(column).fill, undefined);
      assert.equal(book.sheet.getRow(3).getCell(column).numFmt, "@");
    }
  } finally {
    if (oldExcel === undefined) delete global.ExcelJS;
    else global.ExcelJS = oldExcel;
    if (oldWindow === undefined) delete global.window;
    else global.window = oldWindow;
  }
});

test("簽到簿 Excel 與列印使用相同十欄、星期、班別、打卡地點及狀態", () => {
  const rows = loadExporter().getAttendanceReviewWorkbookRows([
    {
      work_date: "2026-11-04", employee_name: "王小明",
      scheduleSegments: [{ name: "休息日" }, { name: "早班" }],
      shiftName: "早班", shiftTime: "08:30～17:30",
      clock_in_at: "2026-11-04T00:25:00Z",
      clock_out_at: "2026-11-04T09:32:00Z",
      clock_in_location: { name: "門市" }, clock_out_location: { name: "門市" },
      regularHours: 8, overtimeHours: 1.5, note: "支援", issues: ["遲到"],
      reviewed: true
    }
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], [
    "2026-11-04\n三", "王小明", "休息日 / 早班", "早班\n08:30～17:30",
    "上班 08:25（門市）\n下班 17:32（門市）",
    8, 1.5, "支援", "遲到", "已審"
  ]);
});
