const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(relative) { return fs.readFileSync(path.join(__dirname, "..", relative), "utf8"); }
const page = source("src/renderer/renderer-records-page.js");
const views = source("src/renderer/renderer-records-views.js");
const events = source("src/renderer/renderer-records-events.js");
const actions = source("src/renderer/renderer-records-actions.js");
const webApi = source("src/renderer/web-api.js");
const ledger = source("supabase/functions/attendance-ledger/index.ts");
const review = source("supabase/functions/attendance-review-groups/index.ts");
const ledgerExport = source("supabase/functions/attendance-ledger-export/index.ts");

test("個人記錄與簽到審核預設日期降冪並可切換", () => {
  assert.match(page, /sortDirection:\s*"desc"/);
  assert.match(page, /sortDirection:\s*filters\.sortDirection === "asc" \? "asc" : "desc"/);
  assert.match(views, /data-record-date-sort/);
  assert.match(views, /renderRecordsDateSortButton\(filters\.sortDirection, "personal"\)/);
  assert.match(views, /renderRecordsDateSortButton\(filters\.sortDirection, "review"\)/);
  assert.match(events, /dataset\.recordDateSort === "personal"/);
  assert.match(events, /dataset\.recordDateSort === "review"/);
  assert.match(ledger, /sortDirection === "asc" \? a\.localeCompare\(b\) : b\.localeCompare\(a\)/);
  assert.match(review, /const dateCompare = sortDirection === "asc"/);
});

test("正常異常欄留白，只有異常才顯示文字", () => {
  assert.doesNotMatch(views, /join\("、"\) \|\| "正常"/);
  assert.doesNotMatch(actions, /join\("、"\) \|\| "正常"/);
});

test("遲到第六分鐘起、提早超過三十分鐘才早退", () => {
  for (const text of [ledger, review]) {
    assert.match(text, /inMinutes !== null && inMinutes >= start \+ 6/);
    assert.match(text, /outMinutes !== null && outMinutes < end - 30/);
    assert.match(text, /!hasIn && \(past \|\| \(sameDay && now >= start \+ 1\)\)/);
    assert.match(text, /!hasOut && \(past \|\| \(sameDay && now >= end \+ 1\)\)/);
  }
});

test("簽到審核群組篩選前後端一致並套用匯出", () => {
  assert.match(views, /data-attendance-review-filter="groupId"/);
  assert.match(views, /getSelectableGroups/);
  assert.match(events, /field === "groupId"/);
  assert.match(actions, /groupId: filters\.groupId/);
  assert.match(webApi, /groupId: filters\.groupId \|\| ""/);
  assert.match(ledgerExport, /requestedGroupId/);
  assert.match(ledgerExport, /allowedGroups\.has\(groupId\) && \(!requestedGroupId \|\| groupId === requestedGroupId\)/);
});

test("SAP 例休假匯出檔名使用 sap例休假", () => {
  assert.match(webApi, /makeRangeExportFileName\("sap例休假", payload, "csv"\)/);
  assert.doesNotMatch(webApi, /makeRangeExportFileName\("sap請假", payload, "csv"\)/);
});
