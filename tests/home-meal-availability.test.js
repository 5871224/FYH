const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("首頁只讀最小群組資格，不在登入後預載完整班表", () => {
  const config = read("src/renderer/app-config.js");
  const pageData = read("src/renderer/renderer-page-data.js");
  const publishedConfig = read("docs/app-config.js");
  const publishedApp = read("docs/app.js");

  assert.equal(publishedConfig, config, "發布設定載入器必須與來源一致");
  assert.doesNotMatch(config, /page-lazy-data|login-fast-home/);

  const homeStart = pageData.indexOf("async function initializeAuthenticatedHome");
  const scheduleStart = pageData.indexOf("async function ensureScheduleApplicationLoaded", homeStart);
  const homeBlock = pageData.slice(homeStart, scheduleStart);
  assert.match(homeBlock, /getGroupAccessBundle\(\)/, "登入階段只取得角色、適用群組與群組訂餐資格");
  assert.match(homeBlock, /getAppInfo\(\)/);
  assert.doesNotMatch(homeBlock, /loadState\(\)|loadScheduleEntries/);

  const scheduleBlock = pageData.slice(scheduleStart);
  assert.match(scheduleBlock, /window\.schedulerApi\.loadState\(\)/, "完整班表只在進入班表時載入");
  assert.match(publishedApp, /async function ensureScheduleApplicationLoaded\(\)/);
});
