const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { detectDeviceType, formatSessionCookie } = require("../src/backend/api-router.js");
const { getSessionIdleMs } = require("../src/backend/session-store.js");

// Session 已由 FYH Backend 以 HttpOnly Cookie 與伺服器端 store 管理；前端不保存 Token/Session。
const root = path.resolve(__dirname, "..");
const webApi = fs.readFileSync(path.join(root, "src", "renderer", "web-api.js"), "utf8");

function requestFor(userAgent, extraHeaders = {}) {
  return { headers: { "user-agent": userAgent, ...extraHeaders } };
}

test("iPad、觸控平板與 Android 平板應使用電腦版 Session 期限", () => {
  const devices = [
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
    "Mozilla/5.0 (Linux; Android 15; Pixel Tablet)",
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Safari/537.36"
  ];
  devices.forEach((userAgent) => {
    assert.equal(detectDeviceType(requestFor(userAgent), {}), "tablet");
    assert.equal(getSessionIdleMs("tablet"), 30 * 60 * 1000);
  });
  assert.equal(getSessionIdleMs("desktop"), 30 * 60 * 1000);
});

test("手機仍使用 48 小時伺服器端 Session 期限", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile";
  assert.equal(detectDeviceType(requestFor(userAgent), {}), "phone");
  assert.equal(getSessionIdleMs("phone"), 48 * 60 * 60 * 1000);
  const cookie = formatSessionCookie("opaque-session", { deviceType: "phone", secure: true });
  assert.match(cookie, /fyh_session=opaque-session/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=172800/);
  assert.match(cookie, /Secure/);
});

test("正式 Session 只由 Backend Cookie 管理，renderer 不保存 access token", () => {
  assert.match(webApi, /credentials:\s*"include"/);
  assert.doesNotMatch(webApi, /localStorage|sessionStorage|access_token|refresh_token|persistSession|normalizeSession/);
  const tabletCookie = formatSessionCookie("opaque-session", { deviceType: "tablet" });
  assert.match(tabletCookie, /HttpOnly/);
  assert.doesNotMatch(tabletCookie, /Max-Age=/);
});

test("裝置判斷與閒置期限由正式 Backend 管理而非後載入補丁", () => {
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const router = fs.readFileSync(path.join(root, "src", "backend", "api-router.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-tablet-session.js")), false);
  assert.equal(build.includes("v2-tablet-session.js"), false);
  assert.match(router, /function detectDeviceType\(request,body=\{\}\)/);
  assert.match(router, /await sessionStore\.touch\(id\)/);
  assert.doesNotMatch(webApi, /lastActivityWriteAt|migrateLegacyTabletSession|pointerdown.*keydown.*touchstart/);
});
