const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");

function readBoundaryScript() {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const boundary = scripts.find((source) => source.includes('Object.defineProperty(window, "schedulerApi"'));
  assert.ok(boundary, "找不到 schedulerApi 通用後端門面");
  return boundary;
}

function installProvider(provider) {
  const context = {
    window: {},
    Object,
    Set,
    String,
    Promise,
    Error
  };
  vm.runInNewContext(readBoundaryScript(), context);
  context.window.schedulerApi = provider;
  return context.window.schedulerApi;
}

function signedInContext() {
  return {
    session: { user: { id: "U1", email: "u1@example.invalid", internal: "hidden" } },
    profile: { id: "U1", employee_code: "0001", full_name: "測試人員" }
  };
}

test("一般 API 遇到 JWT 過期只重新初始化一次並只重試原請求一次", async () => {
  let initializeCount = 0;
  let requestCount = 0;
  const provider = {
    initializeAuth: async () => {
      initializeCount += 1;
      return signedInContext();
    },
    getAuthContext: () => signedInContext(),
    signIn: async () => signedInContext(),
    signOut: async () => ({ session: null, profile: null }),
    changePassword: async () => ({ ok: true }),
    loadState: async () => {
      requestCount += 1;
      if (requestCount === 1) throw new Error("JWT expired");
      return { ok: true };
    }
  };
  const api = installProvider(provider);

  assert.deepEqual(await api.loadState(), { ok: true });
  assert.equal(initializeCount, 1);
  assert.equal(requestCount, 2);
});

test("非登入錯誤不得觸發重新登入或重試", async () => {
  let initializeCount = 0;
  let requestCount = 0;
  const provider = {
    initializeAuth: async () => {
      initializeCount += 1;
      return signedInContext();
    },
    getAuthContext: () => signedInContext(),
    signIn: async () => signedInContext(),
    signOut: async () => ({ session: null, profile: null }),
    changePassword: async () => ({ ok: true }),
    saveScheduleCell: async () => {
      requestCount += 1;
      throw new Error("權限不足");
    }
  };
  const api = installProvider(provider);

  await assert.rejects(api.saveScheduleCell({}), /權限不足/);
  assert.equal(initializeCount, 0);
  assert.equal(requestCount, 1);
});

test("initializeAuth 本身失敗時不得遞迴刷新", async () => {
  let initializeCount = 0;
  const provider = {
    initializeAuth: async () => {
      initializeCount += 1;
      throw new Error("JWT expired");
    },
    getAuthContext: () => ({ session: null, profile: null }),
    signIn: async () => signedInContext(),
    signOut: async () => ({ session: null, profile: null }),
    changePassword: async () => ({ ok: true })
  };
  const api = installProvider(provider);

  await assert.rejects(api.initializeAuth(), /JWT expired/);
  assert.equal(initializeCount, 1);
});

test("通用門面不向畫面公開 Provider Session 且隱藏底層實作名稱", async () => {
  const provider = {
    initializeAuth: async () => signedInContext(),
    getAuthContext: () => signedInContext(),
    signIn: async () => signedInContext(),
    signOut: async () => ({ session: null, profile: null }),
    changePassword: async () => ({ ok: true }),
    getAppInfo: async () => ({ databasePath: "provider-private", backend: "provider-private", updatedAt: "2026-08-13" })
  };
  const api = installProvider(provider);
  const auth = api.getAuthContext();
  const info = await api.getAppInfo();

  assert.equal(auth.authenticated, true);
  assert.equal(auth.session, undefined);
  assert.deepEqual(Object.keys(auth.user).sort(), ["email", "id"]);
  assert.equal(Object.isFrozen(auth), true);
  assert.equal(info.databasePath, "福園號資料服務");
  assert.equal(info.backend, "fyh-api");
  assert.equal(info.updatedAt, "2026-08-13");
});
