const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定手機、平板與觸控 Mac 的正式 Session 儲存與閒置期限規則。
const root = path.resolve(__dirname, "..");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const webApi = fs.readFileSync(webApiPath, "utf8");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function createSessionApi({ userAgent, maxTouchPoints = 0, mobile = false, coarse = true, width = 1024, height = 768 }) {
  const start = webApi.indexOf("function normalizeSession");
  const end = webApi.indexOf("function buildHeaders", start);
  assert.ok(start >= 0 && end > start);
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const context = {
    navigator: { userAgent, maxTouchPoints, userAgentData: { mobile } },
    window: {
      matchMedia: () => ({ matches: coarse }),
      screen: { width, height },
      innerWidth: width,
      innerHeight: height
    },
    localStorage,
    sessionStorage,
    Date
  };
  const prefix = `let currentSession = null;
let currentProfile = null;
const sessionStorageKey = "scheduler.test.session";
const mobileSessionMaxIdleMs = 48 * 60 * 60 * 1000;
const desktopSessionMaxIdleMs = 30 * 60 * 1000;
`;
  const api = vm.runInNewContext(prefix + webApi.slice(start, end) + "\n;({ isTabletDevice, isPhoneDevice, getSessionStore, getSessionMaxIdleMs, persistSession })", context);
  return { api, localStorage, sessionStorage, key: "scheduler.test.session" };
}

test("iPad、觸控 Mac 與 Android 平板應使用電腦版 Session 規則", () => {
  const devices = [
    { userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", maxTouchPoints: 5 },
    { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", maxTouchPoints: 5 },
    { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel Tablet)", maxTouchPoints: 10 }
  ];
  devices.forEach((device) => {
    const { api, sessionStorage } = createSessionApi(device);
    assert.equal(api.isTabletDevice(), true);
    assert.equal(api.isPhoneDevice(), false);
    assert.equal(api.getSessionStore(), sessionStorage);
    assert.equal(api.getSessionMaxIdleMs(), 30 * 60 * 1000);
  });
});

test("手機仍使用 localStorage 與 48 小時期限", () => {
  const { api, localStorage } = createSessionApi({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
    maxTouchPoints: 5,
    mobile: true,
    width: 390,
    height: 844
  });
  assert.equal(api.isTabletDevice(), false);
  assert.equal(api.isPhoneDevice(), true);
  assert.equal(api.getSessionStore(), localStorage);
  assert.equal(api.getSessionMaxIdleMs(), 48 * 60 * 60 * 1000);
});

test("正式 Session 寫入只保留目前裝置應使用的儲存區", () => {
  const { api, localStorage, sessionStorage, key } = createSessionApi({
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
    maxTouchPoints: 5
  });
  localStorage.setItem(key, "stale");
  api.persistSession({ access_token: "token", user: { id: "U1" } });
  assert.notEqual(sessionStorage.getItem(key), null);
  assert.equal(localStorage.getItem(key), null);
});

test("平板 Session 應由正式 web-api 管理而非包裝所有 API", () => {
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-tablet-session.js")), false);
  assert.equal(build.includes("v2-tablet-session.js"), false);
  assert.equal(webApi.includes('["pointerdown", "keydown", "touchstart"]'), true);
  assert.equal(webApi.includes("lastActivityWriteAt < 15000"), true);
  assert.equal(webApi.includes("migrateLegacyTabletSession"), false);
});
