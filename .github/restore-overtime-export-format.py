from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8-sig")


def write(path, text):
    Path(path).write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


web_api_path = "src/renderer/web-api.js"
web_api = read(web_api_path)
pattern = re.compile(
    r"  async function exportAttendanceReview\(filters = \{\}\) \{.*?\n  \}\n\n  async function exportMembers",
    re.S,
)
replacement = '''  async function exportAttendanceReview(filters = {}) {
    ensureManager();
    const result = await requestFunction("attendance-ledger-export", {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId || ""
    });
    const overtimeRows = (Array.isArray(result.rows) ? result.rows : [])
      .filter((row) => Number(row.overtimeHours) > 0)
      .map((row) => ({
        employee_code: row.employee_code || "",
        work_date: row.work_date || "",
        total_overtime_hours: Number(row.overtimeHours)
      }));
    if (!overtimeRows.length) return { canceled: true, empty: true };
    const workbook = await exporter.createOvertimeWorkbook({
      approvedOvertimeRows: overtimeRows
    });
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = `匯出加班_${filters.fromDate || ""}-${filters.toDate || ""}.xlsx`;
    downloadBlob(blob, fileName);
    return { canceled: false, empty: false, filePath: fileName };
  }

  async function exportMembers'''
web_api, count = pattern.subn(replacement, web_api, count=1)
if count != 1:
    raise RuntimeError("找不到唯一的 exportAttendanceReview 區段")
write(web_api_path, web_api)

spec_path = "規格書.md"
spec = read(spec_path)
old_spec = '''## 3.4 簽到簿匯出

1. `attendance-ledger-export` 依日期、人員及正式權限匯出。
2. 匯出必須直接讀取正式資料，不依賴目前前端頁面記憶體。
3. 匯出時間使用 `Asia/Taipei`。
4. 大型匯出顯示進度，逾時不得產生假成功檔案。'''
new_spec = '''## 3.4 簽到簿匯出

1. `attendance-ledger-export` 依日期、人員及正式權限匯出。
2. 匯出必須直接讀取正式資料，不依賴目前前端頁面記憶體。
3. 匯出時間使用 `Asia/Taipei`。
4. 大型匯出顯示進度，逾時不得產生假成功檔案。
5. 簽到審核的「匯出加班」只輸出已審且加班時數大於 0 的資料，並沿用既有 12 欄格式：員工編號、加班日期、加班時間(起)、加班時間(迄)、前一日、加班補貼類型、休息1(起)、休息1(迄)、支薪1、休息2(起)、休息2(迄)、支薪2。
6. 每筆簽到加班資料的加班時間(起)固定輸出 `0000`，加班時間(迄)以四碼時分輸出加班總時數，例如 2.5 小時輸出 `0230`；前一日固定為 `0`、加班補貼類型固定為 `1`，兩組休息欄位留空。'''
if old_spec not in spec:
    raise RuntimeError("找不到規格書簽到簿匯出區段")
write(spec_path, spec.replace(old_spec, new_spec, 1))

test_path = Path("tests/attendance-review-overtime-export-format.test.js")
test_path.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出加班沿用既有十二欄格式", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\\s\\S]*Number\\(row\\.overtimeHours\\) > 0/);
  assert.match(webApi, /approvedOvertimeRows: overtimeRows/);
  assert.match(webApi, /exporter\\.createOvertimeWorkbook/);
  assert.equal(webApi.includes('addWorksheet("已審加班")'), false);
  assert.match(exporter, /"員工編號",[\\s\\S]*"加班日期",[\\s\\S]*"加班時間\\(起\\)",[\\s\\S]*"加班時間\\(迄\\)"/);
  assert.match(exporter, /row\\.employee_code[\\s\\S]*"0000",[\\s\\S]*formatApprovedOvertimeDuration/);
  assert.match(spec, /沿用既有 12 欄格式/);
  assert.match(spec, /2\\.5 小時輸出 `0230`/);
});
''', encoding="utf-8")
