const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const formalFiles = [
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js",
  "src/renderer/renderer-period-exports.js"
];
const formalSource = formalFiles.map(read).join("\n");

test("記錄與管理畫面不再依賴後載入補丁", () => {
  for (const file of ["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"]) {
    assert.equal(fs.existsSync(path.join(root, "src/renderer", file)), false);
    assert.doesNotMatch(read("scripts/build-js.js"), new RegExp(file.replace(".", "\\.")));
  }
});

test("記錄主要函式各只有一份正式宣告", () => {
  for (const name of ["loadRecordsPage", "renderPersonalRecordsSection", "renderMealReportSection", "renderOvertimeReviewSection", "renderAttendanceAdminSection", "openAttendanceEditModal", "reviewOvertime"]) {
    const matches = formalSource.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, "g")) || [];
    assert.equal(matches.length, 1, `${name} 應只有一份正式實作`);
    assert.doesNotMatch(formalSource, new RegExp(`${name}\\s*=\\s*(?:async\\s+)?function`));
  }
});

test("正式 web API 使用 V2 記錄與管理端點且沒有同名重複宣告", () => {
  const api = read("src/renderer/web-api.js");
  for (const endpoint of ["personal-records-v2", "meal-report-v2", "meal-cancel-v2", "attendance-admin-list-v2", "attendance-admin-action-v2", "attendance-overtime-admin-list", "attendance-overtime-admin-action"]) {
    assert.match(api, new RegExp(endpoint));
  }
  for (const name of ["getOvertimeReviewList", "reviewOvertimeRequest", "createAdminOvertimeRequest", "getAttendanceAdminRecords"]) {
    const matches = api.match(new RegExp(`async\\s+function\\s+${name}\\s*\\(`, "g")) || [];
    assert.equal(matches.length, 1, `web-api 的 ${name} 不得重複宣告`);
  }
});

test("分頁、批次審核、即時篩選與完整訂餐匯出仍存在", () => {
  assert.match(formalSource, /data-v2-personal-page/);
  assert.match(formalSource, /data-v2-overtime-batch/);
  assert.match(formalSource, /scheduleRecordsReload/);
  assert.match(read("src/renderer/web-api.js"), /report\?\.exportDetails/);
});
