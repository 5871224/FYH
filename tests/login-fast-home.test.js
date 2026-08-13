const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("登入首頁與班表延後載入由正式 bundle 模組提供", () => {
  const config = read("src/renderer/app-config.js");
  const pageData = read("src/renderer/renderer-page-data.js");
  const build = read("scripts/build-js.js");
  assert.doesNotMatch(config, /login-fast-home|page-lazy-data/);
  assert.match(build, /renderer-page-data\.js/);
  assert.match(pageData, /async function initializeAuthenticatedHome/);
  assert.match(pageData, /async function ensureScheduleApplicationLoaded/);
  assert.doesNotMatch(pageData, /schedulerApi\.[A-Za-z0-9_]+\s*=/);
  assert.doesNotMatch(pageData, /currentSession|authContext\?\.session/);
  assert.match(pageData, /applyAuthContext\(authContext\)/);
});

test("登入成功後直接沿用 signIn 回傳身分，不重做 initializeAuth", () => {
  const auth = read("src/renderer/renderer-auth-actions.js");
  const start = auth.indexOf("async function handleSignIn");
  const end = auth.indexOf("async function handleSignOut", start);
  const block = auth.slice(start, end);
  assert.match(block, /const authContext = await window\.schedulerApi\.signIn/);
  assert.match(block, /await initializeAuthenticatedHome\(authContext\)/);
  assert.doesNotMatch(block, /schedulerApi\.initializeAuth\s*\(/);
  assert.doesNotMatch(block, /await loadApp\(\)/);
});

test("首頁初始化只取得 appInfo 與權限，不讀完整班表", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  const start = pageData.indexOf("async function initializeAuthenticatedHome");
  const end = pageData.indexOf("async function ensureScheduleApplicationLoaded", start);
  const block = pageData.slice(start, end);
  assert.match(block, /getAppInfo\(\)/);
  assert.match(block, /getGroupAccessBundle\(\)/);
  assert.doesNotMatch(block, /loadState\(\)/);
  assert.doesNotMatch(block, /loadScheduleEntries/);
});

test("班表完整資料只在正式 ensureScheduleApplicationLoaded 載入", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  const events = read("src/renderer/renderer-events-click.js");
  assert.match(pageData, /const payload = await window\.schedulerApi\.loadState\(\)/);
  assert.match(pageData, /initializeGroupPermissionState\(payload\)/);
  assert.match(events, /await ensureScheduleApplicationLoaded\(\)/);
  assert.match(events, /showScheduleLoadingIndicator/);
});
