const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { startServer } = require("../src/web-server");

function createProvider() {
  const context = {
    providerSession: { employeeId: "U1" },
    user: { id: "U1", email: "" },
    profile: { id: "U1", employee_code: "0001", full_name: "測試人員" }
  };
  return {
    health: async () => ({ ready: true }),
    signIn: async () => context,
    getAuthContext: async () => context,
    signOut: async () => ({ ok: true }),
    changePassword: async () => ({ ok: true, providerSession: context.providerSession })
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

async function signIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginAccount: "0001", password: "test", deviceType: "desktop" })
  });
  assert.equal(response.status, 200);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

test("設定 API 的操作者只能來自 HttpOnly Session", async () => {
  const calls = [];
  const settings = {
    saveSchedulerPreferences: async (employeeId, documentId, payload) => {
      calls.push(["preferences", employeeId, documentId, payload]);
      return { ok: true, id: documentId };
    },
    reorderSettings: async (employeeId, category, ids) => {
      calls.push(["reorder", employeeId, category, ids]);
      return { ok: true, category, count: ids.length };
    }
  };

  await withServer({ provider: createProvider(), services: { settings } }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const preferences = { currentYear: 2026, currentMonth: 7, tableView: "member" };

    const preferencesResponse = await fetch(`${baseUrl}/api/v1/schedule/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        userId: "FORGED",
        employeeId: "FORGED",
        documentId: "default",
        settings: preferences
      })
    });
    assert.equal(preferencesResponse.status, 200);
    assert.deepEqual(await preferencesResponse.json(), { ok: true, id: "default" });

    const ids = ["11111111-1111-4111-8111-111111111111"];
    const reorderResponse = await fetch(`${baseUrl}/api/v1/settings/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        userId: "FORGED",
        employeeId: "FORGED",
        category: "department",
        ids
      })
    });
    assert.equal(reorderResponse.status, 200);
    assert.deepEqual(await reorderResponse.json(), { ok: true, category: "department", count: 1 });

    assert.deepEqual(calls, [
      ["preferences", "U1", "default", preferences],
      ["reorder", "U1", "department", ids]
    ]);
  });
});

test("未啟用設定 Service 時明確回 503，不退回 Supabase RPC", async () => {
  await withServer({ provider: createProvider() }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/v1/schedule/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ documentId: "default", settings: {} })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "SETTINGS_SERVICE_UNAVAILABLE");
  });
});
