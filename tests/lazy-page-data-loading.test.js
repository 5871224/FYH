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
  const publishedApp = read("docs/app.js");
  assert.doesNotMatch(records, /loadRecordsPageWithReview/);
  assert.match(records, /recordsState\.activeTab === "review"/);
  assert.match(webApi, /requestFunction\("attendance-review-groups"/);
  assert.match(publishedApp, /attendance-review-groups/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});
