const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("登入帳密錯誤只顯示中文提示，不顯示 Supabase JSON", () => {
  const auth = read("src/renderer/renderer-auth-actions.js");
  const start = auth.indexOf("function getSignInErrorMessage");
  const end = auth.indexOf("function getSignInInputError", start);
  const api = vm.runInNewContext(auth.slice(start, end) + "\n;({ getSignInErrorMessage })");
  const message = api.getSignInErrorMessage({
    message: '{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}'
  });
  assert.equal(message, "工號或密碼有誤");
  assert.equal(message.includes("{"), false);
  assert.match(auth, /authErrorMessage = getSignInErrorMessage\(error\)/);
});

test("登入工號嚴格驗證，不得自動修剪或吃掉全型與其他字元", () => {
  const auth = read("src/renderer/renderer-auth-actions.js");
  const start = auth.indexOf("function getSignInInputError");
  const end = auth.indexOf("async function handleSignIn", start);
  const api = vm.runInNewContext(auth.slice(start, end) + "\n;({ getSignInInputError })");

  assert.equal(api.getSignInInputError("1234", "0000"), "");
  assert.equal(api.getSignInInputError("AB-12_3.4", "0000"), "");
  assert.equal(api.getSignInInputError("1234Ａ", "0000"), "工號格式錯誤");
  assert.equal(api.getSignInInputError("1234中", "0000"), "工號格式錯誤");
  assert.equal(api.getSignInInputError("1234 ", "0000"), "工號格式錯誤");
  assert.equal(api.getSignInInputError(" 1234", "0000"), "工號格式錯誤");
  assert.equal(api.getSignInInputError("1234　", "0000"), "工號格式錯誤");

  const handleStart = auth.indexOf("async function handleSignIn");
  const handleEnd = auth.indexOf("async function handleSignOut", handleStart);
  const handleBlock = auth.slice(handleStart, handleEnd);
  assert.match(handleBlock, /loginAccount"\)\?\.value \|\| ""/);
  assert.doesNotMatch(handleBlock, /loginAccount"\)\?\.value\.trim\(\)/);

  const webApi = read("src/renderer/web-api.js");
  const emailStart = webApi.indexOf("function buildLocalLoginEmail");
  const emailEnd = webApi.indexOf('["pointerdown", "keydown", "touchstart"]', emailStart);
  const emailBlock = webApi.slice(emailStart, emailEnd);
  assert.match(emailBlock, /\^\[A-Za-z0-9\._-\]\+\$/);
  assert.doesNotMatch(emailBlock, /replace\(\/\[\^a-z0-9\._-\]\+\/g/);

  const signInStart = webApi.indexOf("async function signIn(loginAccount, password)");
  const signInEnd = webApi.indexOf("async function signOut", signInStart);
  const signInBlock = webApi.slice(signInStart, signInEnd);
  assert.match(signInBlock, /const employeeCode = String\(loginAccount \?\? ""\)/);
  assert.doesNotMatch(signInBlock, /employeeCode = String\(loginAccount[^\n]*\.trim\(\)/);
});

test("登入密碼必須保持原字串，不得 trim、replace 或 normalize", () => {
  const auth = read("src/renderer/renderer-auth-actions.js");
  const handleStart = auth.indexOf("async function handleSignIn");
  const handleEnd = auth.indexOf("async function handleSignOut", handleStart);
  const handleBlock = auth.slice(handleStart, handleEnd);
  assert.match(handleBlock, /const password = document\.getElementById\("loginPassword"\)\?\.value \|\| ""/);
  assert.match(handleBlock, /schedulerApi\.signIn\(loginAccount, password\)/);
  assert.doesNotMatch(handleBlock, /password[^\n]*(?:trim|replace|normalize)\s*\(/);

  const webApi = read("src/renderer/web-api.js");
  const signInStart = webApi.indexOf("async function signIn(loginAccount, password)");
  const signInEnd = webApi.indexOf("async function signOut", signInStart);
  const signInBlock = webApi.slice(signInStart, signInEnd);
  assert.match(signInBlock, /body: JSON\.stringify\(\{\s*email,\s*password\s*\}\)/);
  assert.doesNotMatch(signInBlock, /password[^\n]*(?:trim|replace|normalize)\s*\(/);
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
