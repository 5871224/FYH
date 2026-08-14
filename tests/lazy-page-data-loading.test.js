const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首頁與班表資料載入使用正式模組，不靠後載入攔截器", () => {
  const config = read("src/renderer/app-config.js");
  const pageData = read("src/renderer/renderer-page-data.js");
  const events = read("src/renderer/renderer-events-click.js");
  assert.doesNotMatch(config, /page-lazy-data|login-fast-home/);
  assert.doesNotMatch(pageData, /stopImmediatePropagation|addEventListener\("click"/);
  assert.doesNotMatch(pageData, /schedulerApi\.[A-Za-z0-9_]+\s*=/);
  assert.match(events, /await ensureScheduleApplicationLoaded\(\)/);
});

test("簽到簿群組審核 API 由正式 web-api 提供", () => {
  const records = read("src/renderer/renderer-records-page.js");
  const webApi = read("src/renderer/web-api.js");
  assert.match(records, /hasPermission\("attendance_review"\)/);
  assert.match(records, /getAttendanceReviewList/);
  assert.match(webApi, /getAttendanceReviewList[\s\S]*?request\("\/api\/v1\/attendance\/review\/list",\{method:"POST",body:filters\}\)/);
  assert.doesNotMatch(webApi, /requestFunction\("attendance-review-groups"/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});

test("簽到審核讀寫使用具名 FYH API，不再用 action 型 Edge Function transport", () => {
  const webApi = read("src/renderer/web-api.js");
  assert.match(webApi, /getAttendanceReviewList[\s\S]*?\/api\/v1\/attendance\/review\/list/);
  assert.match(webApi, /saveAttendanceReviewRecord[\s\S]*?\/api\/v1\/attendance\/review\/record/);
  assert.match(webApi, /setAttendanceReviewed[\s\S]*?\/api\/v1\/attendance\/review\/set/);
  assert.match(webApi, /getAttendanceHistory[\s\S]*?\/api\/v1\/attendance\/review\/history/);
  assert.doesNotMatch(webApi, /attendance-review-groups|retryTransientOnce|\brequestFunction\s*\(/);
});

test("人員設定先顯示載入畫面，再延遲讀取管理欄位", () => {
  const memberSettings = read("src/renderer/renderer-settings-member.js");
  const block = memberSettings.match(/async function openMemberSettings\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(block, /hasPermission\("member_settings"\)/);
  assert.match(block, /讀取人員資料中/);
  assert.ok(block.indexOf("openEntityListModal({") < block.indexOf("await ensureManagerDirectoryLoaded()"));
  assert.match(block, /開啟人員設定失敗/);
});
