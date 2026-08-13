const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");

function readSchedulerApiBoundaryScript() {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const boundary = scripts.find((source) => source.includes('Object.defineProperty(window, "schedulerApi"'));
  assert.ok(boundary, "找不到 schedulerApi 後端門面");
  return boundary;
}

function createFacade(rawContext) {
  const context = {
    window: {},
    Object,
    Set,
    String,
    Promise
  };
  vm.runInNewContext(readSchedulerApiBoundaryScript(), context);
  const provider = {
    initializeAuth: async () => rawContext,
    signIn: async () => rawContext,
    signOut: async () => ({ session: null, profile: null }),
    getAuthContext: () => rawContext,
    ping: (value) => `pong:${value}`
  };
  context.window.schedulerApi = provider;
  return { api: context.window.schedulerApi, provider };
}

test("登入結果不得把 Access Token 或 Refresh Token 暴露給 renderer", async () => {
  const rawContext = {
    session: {
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      expires_at: 9999999999,
      user: { id: "U1", email: "u1@local.invalid", provider_metadata: "internal" }
    },
    profile: { id: "U1", employee_code: "0001", full_name: "測試人員" }
  };
  const { api, provider } = createFacade(rawContext);
  const auth = await api.initializeAuth();

  assert.equal(provider.getAuthContext().session.access_token, "access-secret");
  assert.equal(auth.session.access_token, undefined);
  assert.equal(auth.session.refresh_token, undefined);
  assert.equal(auth.session.expires_at, undefined);
  assert.deepEqual(Object.keys(auth.session), ["user"]);
  assert.deepEqual(Object.keys(auth.user).sort(), ["email", "id"]);
  assert.equal(auth.user.id, "U1");
  assert.equal(auth.user.email, "u1@local.invalid");
  assert.equal(auth.user.provider_metadata, undefined);
  assert.equal(auth.profile.employee_code, "0001");
});

test("同步登入狀態與一般 API 也必須經過同一個唯讀門面", () => {
  const rawContext = {
    session: {
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      user: { id: "U2", email: "u2@local.invalid" }
    },
    profile: { id: "U2", employee_code: "0002" }
  };
  const { api } = createFacade(rawContext);
  const auth = api.getAuthContext();

  assert.equal(auth.session.access_token, undefined);
  assert.equal(auth.user.id, "U2");
  assert.equal(api.ping("ok"), "pong:ok");
  assert.equal(Object.isFrozen(api), true);
  assert.equal(Object.isFrozen(auth), true);
  assert.equal(Object.isFrozen(auth.session), true);
  assert.equal(Object.isFrozen(auth.user), true);
});
