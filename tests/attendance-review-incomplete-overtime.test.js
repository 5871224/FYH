const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

const source = fs.readFileSync(path.join(__dirname, "../supabase/functions/attendance-review-groups/index.ts"), "utf8");
const start = source.indexOf("function attendanceIssues(");
const end = source.indexOf("\nfunction hoursToMinutes(", start);
assert.ok(start >= 0 && end > start, "應有正式簽到異常判斷函式");

const attendanceIssues = vm.runInNewContext(
  stripTypeScriptTypes(source.slice(start, end)) + "\nattendanceIssues",
  {
    taipeiDate: () => "2026-10-30",
    shiftMinutes: (value) => {
      const matched = String(value || "").match(/^(\d{1,2}):(\d{2})/);
      return matched ? Number(matched[1]) * 60 + Number(matched[2]) : null;
    },
    punchMinutes: () => null,
    nowMinutes: () => 0,
    locationValue: () => ""
  }
);

const issues = (record, shift = null) => [
  ...attendanceIssues(record, shift, "2026-10-30", "2026-10-30")
];

test("加班時數與備註只有一欄有效時顯示加班不完整", () => {
  assert.deepEqual(issues({ overtime_minutes: 60, note: "" }), ["加班不完整"]);
  assert.deepEqual(issues({ overtime_minutes: null, note: "提前到班" }), ["加班不完整"]);
  assert.deepEqual(issues({ overtime_minutes: 0, note: "協助出貨" }), ["加班不完整"]);
  assert.deepEqual(issues({ overtime_minutes: 30, note: "　 " }), ["加班不完整"]);
});

test("兩欄皆有有效內容或皆無內容時不顯示加班不完整", () => {
  assert.deepEqual(issues({ overtime_minutes: 30, note: "盤點" }), []);
  assert.deepEqual(issues({ overtime_minutes: 0, note: "" }), []);
  assert.deepEqual(issues({ overtime_minutes: null, note: "  " }), []);
});

test("班別時間缺失仍保留加班不完整與既有異常", () => {
  assert.deepEqual(
    issues({ overtime_minutes: 60, note: "" }, { start_time: "", end_time: "" }),
    ["加班不完整", "班別缺少完整上下班時間"]
  );
});
