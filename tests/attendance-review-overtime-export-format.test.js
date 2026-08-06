const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出使用正式 exportRows 十二欄契約", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\s\S]*const exportRows =/);
  assert.match(webApi, /overtime_type_id: "attendance-ledger"/);
  assert.match(webApi, /return exportOvertime\(\{/);
  assert.doesNotMatch(webApi + exporter, /approvedOvertimeRows/);
  assert.match(exporter, /function requireExportRows/);
  assert.match(exporter, /"員工編號",[\s\S]*"加班日期",[\s\S]*"加班時間\(起\)",[\s\S]*"加班時間\(迄\)"/);
  assert.match(spec, /正式唯一格式為 12 欄/);
  assert.match(spec, /2\.5 小時輸出 `0230`/);
});
