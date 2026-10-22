const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核加班 Excel 將姓名放第一欄，星期後帶入當天排班單位", async () => {
  const exporter = read("src/renderer/browser-exporter.js");
  const start = exporter.indexOf("  async function createOvertimeWorkbook(payload) {");
  const end = exporter.indexOf("  async function createLeaveWorkbook(payload) {", start);
  assert.ok(start >= 0 && end > start, "找不到加班匯出函式");

  class Sheet {
    constructor() { this.rows = []; this.columns = []; }
    addRow(values) {
      const cells = new Map();
      const row = {
        values,
        getCell(index) {
          if (!cells.has(index)) cells.set(index, {});
          return cells.get(index);
        }
      };
      this.rows.push(row);
      return row;
    }
    getRow(index) { return this.rows[index - 1]; }
  }
  class Workbook {
    addWorksheet() { return this.sheet = new Sheet(); }
  }
  const createOvertimeWorkbook = new Function(
    "ExcelJS", "ensureExcelJS", "getOvertimeExportRows", "applySheetBorder",
    exporter.slice(start, end) + "; return createOvertimeWorkbook;"
  )({ Workbook }, async () => {}, (payload) => payload.mockOvertimeRows, () => {});

  const overtimeValues = ["A001", "20261022", "1000", "1100", 0, 1, "", "", "", "", "", ""];
  const payload = {
    attendanceReview: true,
    exportRows: [{
      employee_code: "A001",
      employee_name: "測試員工",
      work_date: "2026-10-22",
      scheduled_department_name: "門市二部",
      overtime_type_id: "attendance-ledger",
      missingScheduledShift: true
    }],
    mockOvertimeRows: [overtimeValues]
  };
  const workbook = await createOvertimeWorkbook(payload);
  const sheet = workbook.sheet;
  assert.deepEqual(sheet.rows[0].values, [
    "姓名", "員工編號", "星期", "單位", "加班日期", "加班時間(起)",
    "加班時間(迄)", "前一日", "加班補貼類型", "休息1(起)",
    "休息1(迄)", "支薪1", "休息2(起)", "休息2(迄)", "支薪2"
  ]);
  assert.deepEqual(sheet.rows[1].values, [
    "測試員工", "A001", "四", "門市二部", ...overtimeValues.slice(1)
  ]);
  assert.equal(sheet.columns.length, 15);
  assert.equal(sheet.columns[0].width, 18);
  assert.equal(sheet.columns[3].width, 18);
  assert.ok(sheet.rows[1].getCell(15).fill, "粉紅底色須覆蓋新增單位欄及所有資料欄");

  const normal = await createOvertimeWorkbook({
    attendanceReview: false,
    exportRows: payload.exportRows,
    mockOvertimeRows: [overtimeValues]
  });
  assert.equal(normal.sheet.rows[0].values.length, 12, "其他既有加班匯出不可更改欄序");
  assert.equal(normal.sheet.rows[0].values[0], "員工編號");
});

test("簽到審核單位由當天班表班別或支援單位取得，未排班不套用所屬單位", () => {
  const edge = read("supabase/functions/attendance-ledger-export/index.ts");
  const webApi = read("src/renderer/web-api.js");
  const spec = read("規格書.md");
  assert.match(edge, /shift_type_id,leave_type_id,support_department_id/);
  assert.match(edge, /id,start_time,end_time,applicable_department_id/);
  assert.match(edge, /schedule\?\.support_department_id \|\| shift\.applicable_department_id/);
  assert.match(edge, /const scheduledDepartmentId = shift/);
  assert.match(edge, /scheduledShiftDepartmentName: scheduleContext\.departments\.get\(scheduledDepartmentId\)\?\.name/);
  assert.equal((webApi.match(/scheduled_department_name: row\.scheduledShiftDepartmentName \|\| ""/g) || []).length, 3);
  assert.match(spec, /當天未排班別時留空/);
  assert.equal(read("src/renderer/app.js"), read("docs/app.js"), "正式版 bundle 必須同步");
});
