const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首頁初始化只載入最小權限資料，完整班表延後到進入班表", () => {
  const config = read("src/renderer/app-config.js");
  const lazy = read("src/renderer/page-lazy-data.mjs");
  const docsConfig = read("docs/app-config.js");
  const docsLazy = read("docs/page-lazy-data.mjs");

  assert.equal(config, docsConfig);
  assert.equal(lazy, docsLazy);
  assert.match(config, /page-lazy-data\.mjs\?v=20260807-permission-tags-loading/);
  assert.doesNotMatch(config, /DOMContentLoaded|reloadGroupApplicationState/);
  assert.match(lazy, /get_group_access_bundle_v1/);
  assert.match(lazy, /if \(!pageData\.bootstrapActive\)/);
  assert.match(lazy, /await reloadGroupApplicationState\(\)/);
  assert.match(lazy, /button\[data-home-action="schedule"\]/);
  assert.match(lazy, /stopImmediatePropagation/);
});

test("簽到簿只讀目前頁籤，群組審核 API 由正式模組直接提供", () => {
  const records = read("src/renderer/renderer-records-page.js");
  const webApi = read("src/renderer/web-api.js");
  const docsApi = read("docs/web-api.js");

  assert.equal(webApi, docsApi);
  assert.doesNotMatch(records, /loadRecordsPageWithReview/);
  assert.match(records, /recordsState\.activeTab === "review"/);
  assert.match(webApi, /requestFunction\("attendance-review-groups"/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});
