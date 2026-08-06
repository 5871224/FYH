const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出加班沿用既有十二欄格式", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\s\S]*Number\(row\.overtimeHours\) > 0/);
  assert.match(webApi, /approvedOvertimeRows: overtimeRows/);
  assert.match(webApi, /exporter\.createOvertimeWorkbook/);
  assert.equal(webApi.includes('addWorksheet("已審加班")'), false);
  assert.match(exporter, /"員工編號",[\s\S]*"加班日期",[\s\S]*"加班時間\(起\)",[\s\S]*"加班時間\(迄\)"/);
  assert.match(exporter, /row\.employee_code[\s\S]*"0000",[\s\S]*formatApprovedOvertimeDuration/);
  assert.match(spec, /沿用既有 12 欄格式/);
  assert.match(spec, /2\.5 小時輸出 `0230`/);
});
