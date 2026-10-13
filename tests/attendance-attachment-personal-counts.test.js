const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("個人紀錄同時帶回附件數量，即使該天沒有打卡紀錄", () => {
  const source = read("supabase/functions/attendance-ledger/index.ts");
  assert.match(source, /from\("attendance_attachments"\)\.select\("work_date"\)/);
  assert.match(source, /\.eq\("owner_id", actor\.id\)\.eq\("status", "ready"\)/);
  assert.match(source, /attachmentCounts\.set\(attachment\.work_date,/);
  assert.match(source, /ownerId: actor\.id,/);
  assert.match(source, /attachmentCount: attachmentCounts\.get\(date\) \|\| 0,/);
});

test("個人紀錄不須再依賴額外的附件數量請求", () => {
  const views = read("src/renderer/renderer-records-views.js");
  const page = read("src/renderer/renderer-records-page.js");
  assert.match(views, /renderAttachmentCell\(record\.ownerId \|\| attachmentOwner\(\),record\.date,[^\n]*record\.attachmentCount\)/);
  const fn = page.split("async function loadRecordsPage",2)[1].split("async function loadAttendanceReview",2)[0];
  assert.doesNotMatch(fn, /await refreshAttachmentCounts\(/);
});

test("當日兩個附件顯示迴紋針 2，即使已審仍可查看", () => {
  const source = read("src/renderer/renderer-attachments.js");
  const ctx = {
    recordsState:{attachmentCounts:{}},
    ensureRecordsState(){},
    getTodayDateString(){return "2026-10-13";},
    addDaysToDateString(){return "2026-09-13";},
    escapeHtml(value){return String(value);},
    window:{schedulerApi:{getAuthContext(){return {session:{user:{id:"user-aaa"}}};}}}
  };
  vm.runInNewContext(source,ctx,{timeout:1000});
  const html=ctx.renderAttachmentCell("user-aaa","2026-10-13",false,2);
  assert.match(html,/data-att-day="user-aaa:2026-10-13"/);
  assert.match(html,/<sup>2<\/sup>/);
  assert.doesNotMatch(html,/data-att-upload=/);
  assert.doesNotMatch(ctx.renderAttachmentCell("user-aaa","2026-10-13",true,0),/data-att-day=/);
});
