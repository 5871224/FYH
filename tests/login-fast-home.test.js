const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function createRuntime(authContext) {
  let renderCalls = 0;
  const runtime = {
    console,
    currentSession: null,
    currentProfile: null,
    state: { old: true },
    appView: "schedule",
    authModalOpen: true,
    authErrorMessage: "舊錯誤",
    createEmptyState: () => ({ empty: true }),
    resetLoadedUserRuntimeState: () => {},
    renderAll: () => {
      renderCalls += 1;
    },
    syncCoreActionsMenu: () => {}
  };
  runtime.window = runtime;
  vm.createContext(runtime);
  vm.runInContext(read("src/renderer/login-fast-home.mjs"), runtime);
  return {
    runtime,
    authContext,
    getRenderCalls: () => renderCalls
  };
}

test("登入快速首頁模組同步發布並由 app-config 載入", () => {
  const loader = read("src/renderer/app-config.js");
  const source = read("src/renderer/login-fast-home.mjs");
  const docsLoader = read("docs/app-config.js");
  const docsSource = read("docs/login-fast-home.mjs");

  assert.equal(docsLoader, loader, "發布設定載入器必須與來源一致");
  assert.equal(docsSource, source, "發布登入快速首頁模組必須與來源一致");
  assert.match(loader, /login-fast-home\.mjs\?v=20260731-login-fast-home/);
  assert.doesNotThrow(() => new Function(source), "登入快速首頁模組必須可解析");
});

test("登入成功後沿用已取得的身分並先顯示首頁", async () => {
  const authContext = {
    session: { user: { id: "user-1" } },
    profile: { id: "user-1", name: "測試人員" }
  };
  const { runtime, getRenderCalls } = createRuntime(authContext);
  let initializeCalls = 0;

  runtime.schedulerApi = {
    signIn: async () => authContext,
    initializeAuth: async () => {
      initializeCalls += 1;
      return authContext;
    },
    signOut: async () => true
  };

  await runtime.schedulerApi.signIn("001", "password");
  const initialized = await runtime.schedulerApi.initializeAuth();

  assert.equal(initialized, authContext);
  assert.equal(initializeCalls, 0, "登入後不得再次查詢相同身分");
  assert.equal(getRenderCalls(), 1, "完整資料載入前應先顯示首頁");
  assert.equal(runtime.currentSession, authContext.session);
  assert.equal(runtime.currentProfile, authContext.profile);
  assert.deepEqual(runtime.state, { empty: true });
  assert.equal(runtime.appView, "home");
  assert.equal(runtime.authModalOpen, false);
  assert.equal(runtime.authErrorMessage, "");
});

test("既有登入狀態仍執行正常初始化並先顯示首頁", async () => {
  const authContext = {
    session: { user: { id: "user-2" } },
    profile: { id: "user-2", name: "已登入人員" }
  };
  const { runtime, getRenderCalls } = createRuntime(authContext);
  let initializeCalls = 0;

  runtime.schedulerApi = {
    initializeAuth: async () => {
      initializeCalls += 1;
      return authContext;
    }
  };

  await runtime.schedulerApi.initializeAuth();

  assert.equal(initializeCalls, 1);
  assert.equal(getRenderCalls(), 1);
  assert.equal(runtime.currentSession, authContext.session);
});
