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

test("主檔 API 的操作者只能來自 HttpOnly Session", async () => {
  const calls = [];
  const masterData = {
    saveDepartment: async (employeeId, department) => {
      calls.push(["saveDepartment", employeeId, department]);
      return { ok: true, id: department.id, groupId: department.groupId };
    },
    deleteDepartment: async (employeeId, departmentId) => {
      calls.push(["deleteDepartment", employeeId, departmentId]);
      return { ok: true, deleted: true, id: departmentId };
    },
    saveShift: async (employeeId, shift) => {
      calls.push(["saveShift", employeeId, shift]);
      return { ok: true, id: shift.id, groupId: "GROUP-1" };
    },
    saveCatalogItem: async (employeeId, category, item) => {
      calls.push(["saveCatalog", employeeId, category, item]);
      return { ok: true, id: item.id, category, restored: false };
    },
    deleteCatalogItem: async (employeeId, category, itemId) => {
      calls.push(["deleteCatalog", employeeId, category, itemId]);
      return { ok: true, deleted: true, category, itemId };
    }
  };

  await withServer({ provider: createProvider(), services: { masterData } }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const department = { id: "D1", groupId: "G1", name: "單位" };
    const shift = { id: "S1", applicableDepartmentId: "D1", name: "早班" };
    const item = { id: "L1", code: "A", name: "假別" };

    const requests = [
      ["/api/v1/settings/department", "PUT", { userId: "FORGED", department }],
      ["/api/v1/settings/department/delete", "POST", { employeeId: "FORGED", departmentId: "D1" }],
      ["/api/v1/settings/shift", "PUT", { userId: "FORGED", shift }],
      ["/api/v1/settings/catalog", "PUT", { employeeId: "FORGED", category: "leave", item }],
      ["/api/v1/settings/catalog/delete", "POST", { userId: "FORGED", category: "leave", itemId: "L1" }]
    ];

    for (const [path, method, body] of requests) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 200);
    }

    assert.deepEqual(calls, [
      ["saveDepartment", "U1", department],
      ["deleteDepartment", "U1", "D1"],
      ["saveShift", "U1", shift],
      ["saveCatalog", "U1", "leave", item],
      ["deleteCatalog", "U1", "leave", "L1"]
    ]);
  });
});

test("未啟用主檔 Service 時明確回 503，不退回 Supabase RPC", async () => {
  await withServer({ provider: createProvider() }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/v1/settings/department/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ departmentId: "D1" })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "MASTER_DATA_SERVICE_UNAVAILABLE");
  });
});
