const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const webApiPath = path.join(rendererDir, "web-api.js");
const tabletPath = path.join(rendererDir, "v2-tablet-session.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");
const alignmentPath = path.join(root, "scripts", "check-v2-alignment.js");
const testPath = path.join(root, "tests", "renderer-phase7-tablet-session.test.js");

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`找不到取代位置：${label}`);
  }
  return source.replace(before, after);
}

let webApi = fs.readFileSync(webApiPath, "utf8");

const oldDeviceBlock = `  function isPhoneDevice() {
    const userAgent = navigator.userAgent || "";
    const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
      || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
    return Boolean(
      navigator.userAgentData?.mobile
        || narrowTouch
        || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent))
    );
  }

  function getSessionStore() {
    return isPhoneDevice() ? localStorage : sessionStorage;
  }

  function getSessionMaxIdleMs() {
    return isPhoneDevice() ? mobileSessionMaxIdleMs : desktopSessionMaxIdleMs;
  }`;

const newDeviceBlock = `  function isTabletDevice() {
    const userAgent = navigator.userAgent || "";
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const isIPad = /iPad/i.test(userAgent)
      || (/Macintosh/i.test(userAgent) && touchPoints > 1);
    const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent);
    return Boolean(isIPad || isAndroidTablet || /Tablet|Silk/i.test(userAgent));
  }

  function isPhoneDevice() {
    const userAgent = navigator.userAgent || "";
    const isTablet = isTabletDevice();
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
    return Boolean(
      navigator.userAgentData?.mobile
        || narrowTouch
        || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent))
    );
  }

  function getSessionStore() {
    return isPhoneDevice() ? localStorage : sessionStorage;
  }

  function getSessionMaxIdleMs() {
    return isPhoneDevice() ? mobileSessionMaxIdleMs : desktopSessionMaxIdleMs;
  }`;
webApi = replaceRequired(webApi, oldDeviceBlock, newDeviceBlock, "裝置與 Session 儲存判定");

webApi = replaceRequired(
  webApi,
  `  function readStoredSession() {`,
  `  function migrateLegacyTabletSession() {
    if (!isTabletDevice()) {
      return;
    }
    const tabSession = sessionStorage.getItem(sessionStorageKey);
    const legacySession = localStorage.getItem(sessionStorageKey);
    if (!tabSession && legacySession) {
      sessionStorage.setItem(sessionStorageKey, legacySession);
    }
    localStorage.removeItem(sessionStorageKey);
  }

  function readStoredSession() {`,
  "舊平板 Session 遷移"
);

const oldPersistSession = `  function persistSession(session) {
    currentSession = normalizeSession(session);
    if (currentSession) {
      getSessionStore().setItem(sessionStorageKey, JSON.stringify({
        session: currentSession,
        lastActivityAt: Date.now(),
        device: isPhoneDevice() ? "phone" : "desktop"
      }));
    } else {
      localStorage.removeItem(sessionStorageKey);
      sessionStorage.removeItem(sessionStorageKey);
    }
  }`;

const newPersistSession = `  function persistSession(session) {
    currentSession = normalizeSession(session);
    if (currentSession) {
      const store = getSessionStore();
      const otherStore = store === localStorage ? sessionStorage : localStorage;
      store.setItem(sessionStorageKey, JSON.stringify({
        session: currentSession,
        lastActivityAt: Date.now(),
        device: isTabletDevice() ? "tablet" : isPhoneDevice() ? "phone" : "desktop"
      }));
      otherStore.removeItem(sessionStorageKey);
    } else {
      localStorage.removeItem(sessionStorageKey);
      sessionStorage.removeItem(sessionStorageKey);
    }
  }`;
webApi = replaceRequired(webApi, oldPersistSession, newPersistSession, "正式 Session 寫入");

const oldTouchSession = `  function touchSession() {
    if (currentSession) {
      persistSession(currentSession);
    }
  }`;

const newTouchSession = `  let lastActivityWriteAt = 0;

  function touchSession(force = false) {
    if (!currentSession) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastActivityWriteAt < 15000) {
      return;
    }
    persistSession(currentSession);
    lastActivityWriteAt = now;
  }`;
webApi = replaceRequired(webApi, oldTouchSession, newTouchSession, "Session 活動時間更新");

webApi = replaceRequired(
  webApi,
  `  async function initializeAuth() {
    persistSession(readStoredSession());`,
  `  async function initializeAuth() {
    migrateLegacyTabletSession();
    persistSession(readStoredSession());`,
  "登入初始化的舊 Session 遷移"
);

webApi = replaceRequired(
  webApi,
  `  setInterval(() => {
    if (isSessionIdleExpired()) {
      expireSession();
    }
  }, 60 * 1000);`,
  `  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, () => touchSession(), {
      capture: true,
      passive: eventName === "touchstart"
    });
  });
  window.addEventListener("focus", () => touchSession());

  setInterval(() => {
    if (isSessionIdleExpired()) {
      expireSession();
    }
  }, 60 * 1000);`,
  "Session 活動事件"
);
fs.writeFileSync(webApiPath, webApi);

if (!fs.existsSync(tabletPath)) {
  throw new Error("找不到待整併的 v2-tablet-session.js");
}
fs.unlinkSync(tabletPath);

let build = fs.readFileSync(buildPath, "utf8");
build = replaceRequired(build, `  "v2-tablet-session.js",\n`, "", "JavaScript 建置清單");
fs.writeFileSync(buildPath, build);

let finalCheck = fs.readFileSync(finalCheckPath, "utf8");
finalCheck = replaceRequired(finalCheck, `  "src/renderer/v2-tablet-session.js",\n`, "", "V2 最終必要檔案");
const oldFinalSessionBlock = `const sourceApi = read("src/renderer/v2-tablet-session.js");
const sourceApp = read("src/renderer/app.js");
const publishedApp = read("docs/app.js");
assert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(!sourceApi.includes("safeDepartmentColumns") && !sourceApi.includes("runManagerSafeWrite") && !sourceApi.includes("managerSafeFetch"), "前端仍使用攔截 fetch 的補丁式權限控制");
assert(sourceApi.includes("installTabletSessionCompatibility"), "平板登入 Session 規則未同步修正");
assert(sourceApi.includes("isAndroidTablet"), "Android 平板 Session 判斷缺失");
assert(sourceApi.includes("isIPad"), "iPad Session 判斷缺失");
assert(sourceApi.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");

const { readRendererCore } = require("./renderer-core-source.js");
const sourceRenderer = readRendererCore(root);
const sourceWebApi = read("src/renderer/web-api.js");`;
const newFinalSessionBlock = `const sourceWebApi = read("src/renderer/web-api.js");
const sourceApp = read("src/renderer/app.js");
const publishedApp = read("docs/app.js");
assert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(!exists("src/renderer/v2-tablet-session.js"), "平板 Session 仍依賴後載入相容層");
assert(!sourceWebApi.includes("safeDepartmentColumns") && !sourceWebApi.includes("runManagerSafeWrite") && !sourceWebApi.includes("managerSafeFetch"), "前端仍使用攔截 fetch 的補丁式權限控制");
assert(sourceWebApi.includes("function isTabletDevice"), "平板裝置判定未移入正式 web-api");
assert(sourceWebApi.includes("isAndroidTablet"), "Android 平板 Session 判斷缺失");
assert(sourceWebApi.includes("isIPad"), "iPad Session 判斷缺失");
assert(sourceWebApi.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");
assert(sourceWebApi.includes("migrateLegacyTabletSession"), "舊平板 Session 遷移缺失");

const { readRendererCore } = require("./renderer-core-source.js");
const sourceRenderer = readRendererCore(root);`;
finalCheck = replaceRequired(finalCheck, oldFinalSessionBlock, newFinalSessionBlock, "V2 最終平板 Session 檢查");
finalCheck = replaceRequired(
  finalCheck,
  `assert(sourceApp.includes("installTabletSessionCompatibility") && sourceApp.includes("installV2MealUi") && sourceApp.includes("installV2RecordsUi"), "JavaScript bundle 缺少必要 V2 模組");`,
  `assert(sourceApp.includes("function isTabletDevice") && sourceApp.includes("installV2MealUi") && sourceApp.includes("installV2RecordsUi"), "JavaScript bundle 缺少必要正式模組");`,
  "V2 bundle 必要模組"
);
fs.writeFileSync(finalCheckPath, finalCheck);

let alignment = fs.readFileSync(alignmentPath, "utf8");
alignment = replaceRequired(alignment, `  "src/renderer/v2-tablet-session.js",\n`, "", "V2 alignment 必要檔案");
const oldAlignmentSessionBlock = `const sourceApi = read("src/renderer/v2-tablet-session.js");
const sourceWebApi = read("src/renderer/web-api.js");
assert(!sourceApi.includes("safeDepartmentColumns") && !sourceApi.includes("runManagerSafeWrite") && !sourceApi.includes("managerSafeFetch"), "Front-end still uses fetch interception as a permission boundary");`;
const newAlignmentSessionBlock = `const sourceWebApi = read("src/renderer/web-api.js");
assert(!exists("src/renderer/v2-tablet-session.js"), "Tablet session still depends on a late-loaded compatibility module");
assert(!sourceWebApi.includes("safeDepartmentColumns") && !sourceWebApi.includes("runManagerSafeWrite") && !sourceWebApi.includes("managerSafeFetch"), "Front-end still uses fetch interception as a permission boundary");`;
alignment = replaceRequired(alignment, oldAlignmentSessionBlock, newAlignmentSessionBlock, "V2 alignment 平板 Session 檢查");
fs.writeFileSync(alignmentPath, alignment);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  const prefix = \`let currentSession = null;
let currentProfile = null;
const sessionStorageKey = "scheduler.test.session";
const mobileSessionMaxIdleMs = 48 * 60 * 60 * 1000;
const desktopSessionMaxIdleMs = 30 * 60 * 1000;
\`;
  const api = vm.runInNewContext(prefix + webApi.slice(start, end) + "\\n;({ isTabletDevice, isPhoneDevice, getSessionStore, getSessionMaxIdleMs, migrateLegacyTabletSession, persistSession })", context);
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

test("舊平板 localStorage Session 應遷移到目前分頁", () => {
  const { api, localStorage, sessionStorage, key } = createSessionApi({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
    maxTouchPoints: 5
  });
  const legacy = JSON.stringify({ session: { access_token: "token", user: { id: "U1" } }, lastActivityAt: Date.now() });
  localStorage.setItem(key, legacy);
  api.migrateLegacyTabletSession();
  assert.equal(sessionStorage.getItem(key), legacy);
  assert.equal(localStorage.getItem(key), null);
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
  assert.equal(webApi.includes("migrateLegacyTabletSession();"), true);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("Tablet session rules merged into canonical web-api");
