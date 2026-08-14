const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  const publishedApp = read("docs/app.js");
  assert.match(records, /hasPermission\("attendance_review"\)/);
  assert.match(records, /getAttendanceReviewList/);
  assert.match(webApi, /requestFunction\("attendance-review-groups"/);
  assert.match(publishedApp, /attendance-review-groups/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});

test("簽到審核只在讀取清單遇到暫時性閘道錯誤時重試一次", async () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function requestFunction");
  const end = webApi.indexOf("\n  function isUuid", start);
  const requestFunctionSource = webApi.slice(start, end).trim();
  let calls = 0;
  const responses = [
    { ok: false, status: 503, text: async () => '{"message":"temporary"}' },
    { ok: true, status: 200, text: async () => '{"ok":true}' }
  ];
  const requestFunction = vm.runInNewContext(`(${requestFunctionSource})`, {
    assertSessionActive() {},
    baseUrl: "https://example.test",
    buildHeaders: () => ({}),
    fetch: async () => responses[calls++],
    readError: async (response) => response.text(),
    touchSession() {},
    setTimeout: (resolve) => resolve()
  });

  const result = await requestFunction("attendance-review-groups", { action: "review_list" }, { retryTransientOnce: true });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
  assert.match(webApi, /retryTransientOnce && attempt === 0 && \[502, 503, 504\]\.includes\(response\.status\)/);
  assert.match(webApi, /\{ action: "review_list", \.\.\.filters \},\s*\{ retryTransientOnce: true \}/);
  for (const action of ["review_save", "review_set", "history"]) {
    const call = webApi.match(new RegExp(`requestFunction\\(\\"attendance-review-groups\\", \\{ action: \\"${action}\\"[^;]+`))?.[0] || "";
    assert.doesNotMatch(call, /retryTransientOnce/, `${action} 不得自動重送`);
  }
});

test("人員設定先顯示載入畫面，再延遲讀取管理欄位", () => {
  const memberSettings = read("src/renderer/renderer-settings-member.js");
  const block = memberSettings.match(/async function openMemberSettings\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(block, /hasPermission\("member_settings"\)/);
  assert.match(block, /讀取人員資料中/);
  assert.ok(block.indexOf("openEntityListModal({") < block.indexOf("await ensureManagerDirectoryLoaded()"));
  assert.match(block, /開啟人員設定失敗/);
});
