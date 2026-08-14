const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核匯出使用正式 exportRows 十二欄契約並納入休例日排班", () => {
  const webApi = read("src/renderer/web-api.js");
  const exporter = read("src/renderer/browser-exporter.js");
  const edge = read("supabase/functions/attendance-ledger-export/index.ts");
  const spec = read("規格書.md");

  assert.match(webApi, /async function exportAttendanceReview[\s\S]*const exportRows\s*=/);
  assert.match(webApi, /row\.restDayScheduled/);
  assert.match(webApi, /scheduledShiftStartTime/);
  assert.match(webApi, /scheduledShiftEndTime/);
  assert.match(webApi, /overtime_type_id:\s*"attendance-rest-day"/);
  assert.match(webApi, /overtime_type_id:\s*"attendance-ledger"/);
  assert.match(webApi, /return exportOvertime\(\{/);
  assert.doesNotMatch(webApi + exporter, /approvedOvertimeRows/);
  assert.match(edge, /schedule_entries/);
  assert.match(edge, /set_shift/);
  assert.match(edge, /set_leave/);
  assert.match(edge, /code === "0036"/);
  assert.match(edge, /code === "0047"/);
  assert.match(edge, /name === "例假"/);
  assert.match(edge, /name === "休息日"/);
  assert.match(exporter, /function requireExportRows/);
  assert.match(exporter, /"員工編號",[\s\S]*"加班日期",[\s\S]*"加班時間\(起\)",[\s\S]*"加班時間\(迄\)"/);
  assert.match(spec, /正式唯一格式為 12 欄/);
  assert.match(spec, /2\.5 小時輸出 `0230`/);
  assert.match(spec, /例假.*休息日.*班別.*視為加班/);
  assert.match(spec, /只適用簽到審核.*匯出加班/);
});
