const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createRequestHandler, resolveStaticPath, startServer } = require("../src/web-server");
const { createMemorySessionStore } = require("../src/backend/session-store");
const { createUnconfiguredProvider } = require("../src/backend/providers/unconfigured-provider");

function createMockProvider() {
  const providerSession = {
    access_token: "access-secret",
    refresh_token: "refresh-secret",
    expires_at: 9999999999
  };
  const context = {
    providerSession,
    user: { id: "U1", email: "u1@local.invalid", internal: "hidden" },
    profile: { id: "U1", employee_code: "0001", full_name: "測試人員" }
  };
  const calls = { signIn: 0, context: 0, signOut: 0, password: 0 };
  return {
    calls,
    provider: {
      health: async () => ({ ready: true }),
      signIn: async ({ loginAccount, password }) => {
        calls.signIn += 1;
        assert.equal(loginAccount, "0001");
        assert.equal(password, "pw");
        return context;
      },
      getAuthContext: async (session) => {
        calls.context += 1;
        assert.equal(session.access_token, "access-secret");
        return context;
      },
      signOut: async (session) => {
        calls.signOut += 1;
        assert.equal(session.refresh_token, "refresh-secret");
        return { ok: true };
      },
      changePassword: async (session, password) => {
        calls.password += 1;
        assert.equal(session.access_token, "access-secret");
        assert.equal(password, "new-pw");
        return { ok: true, providerSession: session };
      }
    }
  };
}

async function withServer(options, callback) {
  const server = startServer(0, { ...options, log: false, secureCookies: false });
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function cookieFrom(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

test("/api/v1/health 使用福園號通用服務名稱與契約版本", async () => {
  const { provider } = createMockProvider();
  await withServer({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "fyh-api",
      contractVersion: 1,
      ready: true
    });
  });
});

test("登入後只把 HttpOnly 不透明 Session ID 放到瀏覽器，不回傳 Provider Token", async () => {
  const { provider, calls } = createMockProvider();
  await withServer({ provider }, async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginAccount: "0001", password: "pw", deviceType: "phone" })
    });
    assert.equal(loginResponse.status, 200);
    const setCookie = loginResponse.headers.get("set-cookie") || "";
    assert.match(setCookie, /^fyh_session=/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Max-Age=172800/);
    const loginBody = await loginResponse.json();
    assert.equal(loginBody.authenticated, true);
    assert.deepEqual(Object.keys(loginBody.user).sort(), ["email", "id"]);
    assert.equal(loginBody.user.internal, undefined);
    assert.doesNotMatch(JSON.stringify(loginBody), /access-secret|refresh-secret|access_token|refresh_token/);

    const cookie = cookieFrom(loginResponse);
    const contextResponse = await fetch(`${baseUrl}/api/v1/auth/context`, {
      headers: { Cookie: cookie }
    });
    assert.equal(contextResponse.status, 200);
    assert.match(contextResponse.headers.get("set-cookie") || "", /Max-Age=172800/);
    const context = await contextResponse.json();
    assert.equal(context.authenticated, true);
    assert.equal(context.profile.employee_code, "0001");
    assert.doesNotMatch(JSON.stringify(context), /access-secret|refresh-secret|access_token|refresh_token/);

    const passwordResponse = await fetch(`${baseUrl}/api/v1/auth/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ newPassword: "new-pw" })
    });
    assert.equal(passwordResponse.status, 200);
    assert.deepEqual(await passwordResponse.json(), { ok: true });

    const signOutResponse = await fetch(`${baseUrl}/api/v1/auth/sign-out`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    assert.equal(signOutResponse.status, 200);
    assert.match(signOutResponse.headers.get("set-cookie") || "", /Max-Age=0/);
    assert.equal((await signOutResponse.json()).authenticated, false);

    assert.deepEqual(calls, { signIn: 1, context: 1, signOut: 1, password: 1 });
  });
});

test("沒有後端 Session 時受保護 API 一律回 401", async () => {
  const { provider } = createMockProvider();
  await withServer({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/context`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "AUTH_REQUIRED", message: "請先登入" }
    });
  });
});

test("畸形 Cookie 不得讓未登入請求變成 500", async () => {
  const { provider } = createMockProvider();
  await withServer({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/context`, {
      headers: { Cookie: "fyh_session=%ZZ; other=ok" }
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "AUTH_REQUIRED");
  });
});

test("靜態檔只能解析在 renderer 根目錄內", () => {
  assert.match(resolveStaticPath("/index.html"), /renderer[\\/]index\.html$/);
  assert.equal(resolveStaticPath("../renderer-private/secret.txt"), null);
  assert.equal(resolveStaticPath("../../package.json"), null);
});

test("未設定 Provider 時健康檢查仍可用，登入明確回 503", async () => {
  await withServer({ provider: createUnconfiguredProvider() }, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ready, false);

    const login = await fetch(`${baseUrl}/api/v1/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginAccount: "0001", password: "pw" })
    });
    assert.equal(login.status, 503);
    assert.equal((await login.json()).error.code, "BACKEND_PROVIDER_NOT_CONFIGURED");
  });
});

test("舊 /api/health 不再是正式端點", async () => {
  const { provider } = createMockProvider();
  await withServer({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "API_ROUTE_NOT_FOUND");
  });
});

test("Session Store 維持手機 48 小時、桌機與平板 30 分鐘閒置規則", () => {
  let now = 1_000_000;
  let nextId = 0;
  const store = createMemorySessionStore({ now: () => now, idFactory: () => `S${nextId++}` });
  const phone = store.create({ value: 1 }, { deviceType: "phone" });
  const desktop = store.create({ value: 2 }, { deviceType: "desktop" });
  assert.equal(phone.expiresAt - phone.createdAt, 48 * 60 * 60 * 1000);
  assert.equal(desktop.expiresAt - desktop.createdAt, 30 * 60 * 1000);

  now += 31 * 60 * 1000;
  assert.equal(store.read(desktop.id), null);
  assert.notEqual(store.read(phone.id), null);
});

test("production 切換前必須提供可持久化 Session Store", () => {
  const { provider } = createMockProvider();
  assert.throws(() => createRequestHandler({
    provider,
    env: { NODE_ENV: "production" }
  }), /persistent sessionStore/);
});
