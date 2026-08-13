const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核可維護共用常用備註，個人記錄可選擇或自由輸入", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const events = read("src/renderer/renderer-records-events.js");
  const api = read("src/renderer/web-api.js");
  const review = read("supabase/functions/attendance-review-groups/index.ts");
  const ledger = read("supabase/functions/attendance-ledger/index.ts");
  const schema = read("supabase/001_current_schema.sql");

  assert.match(views, /data-attendance-common-notes="true">常用備註<\/button>/);
  assert.match(views, /list="personalAttendanceCommonNotes"/);
  assert.match(views, /<datalist id="personalAttendanceCommonNotes">/);
  assert.match(actions, /attendanceCommonNotesInput/);
  assert.match(actions, /data-save-attendance-common-notes="true">儲存<\/button>/);
  assert.match(actions, /split\(\/\\r\?\\n\//);
  assert.match(events, /openAttendanceCommonNotesModal/);
  assert.match(events, /saveAttendanceCommonNotes/);
  assert.match(api, /action: "common_notes_save"/);
  assert.match(review, /attendance_common_notes/);
  assert.match(ledger, /attendance_common_notes/);
  assert.match(schema, /attendance_common_notes text not null default ''/);
});

test("個人未審紀錄不限當日可修改工時與備註，且個人頁移除訂餐欄", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const ledger = read("supabase/functions/attendance-ledger/index.ts");
  const personalSection = views.split("function renderPersonalRecordsSection", 2)[1]
    .split("function renderMealReportSection", 2)[0];

  assert.match(ledger, /editable: !row\?\.reviewed_at/);
  assert.equal(ledger.includes("workDate !== today"), false);
  assert.match(ledger, /!employedOn\(actor, workDate\)/);
  assert.match(ledger, /if \(old\.reviewed_at\) throw new Error\("此日簽到紀錄已審，無法修改"\)/);
  assert.equal(personalSection.includes("personal-record-meal-col"), false);
  assert.equal(personalSection.includes(">訂餐<"), false);
  assert.match(personalSection, /colspan="8"/);
});
