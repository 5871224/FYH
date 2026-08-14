const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { startServer } = require("../src/web-server");

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

function createProvider() {
  const context = {
    providerSession: { employeeId: ACTOR_ID },
    user: { id: ACTOR_ID, email: "" },
    profile: { id: ACTOR_ID, employee_code: "0001", full_name: "管理員" }
  };
  return {
    health: async () => ({ ready: true }),
    signIn: async () => context,
    getAuthContext: async () => context,
    signOut: async () => ({ ok: true }),
    changePassword: async () => ({ ok: true, providerSession: context.providerSession })
  };
}

async function withServer(groupRoles, callback) {
  const server = startServer(0, {
    provider: createProvider(),
    services: { groupRoles },
    secureCookies: false,
    log: false
  });
  await once(server, "listening");
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function signIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginAccount: "0001", password: "pw" })
  });
  assert.equal(response.status, 200);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function request(baseUrl, path, method, cookie, body) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("群組與角色 API 一律採用 Session actor，不接受 Body 冒用 userId", async () => {
  const calls = [];
  const groupRoles = {
    getAccessBundle: async (actorId) => {
      calls.push(["bundle", actorId]);
      return { actor: {}, groups: [], roles: [] };
    },
    saveGroup: async (actorId, group) => {
      calls.push(["group-save", actorId, group.name]);
      return { ok: true };
    },
    deleteGroup: async (actorId, groupId, confirmName) => {
      calls.push(["group-delete", actorId, groupId, confirmName]);
      return { ok: true };
    },
    reorderGroups: async (actorId, ids) => {
      calls.push(["group-order", actorId, ids]);
      return { ok: true };
    },
    saveRole: async (actorId, role) => {
      calls.push(["role-save", actorId, role.name]);
      return { ok: true };
    },
    deleteRole: async (actorId, roleId) => {
      calls.push(["role-delete", actorId, roleId]);
      return { ok: true };
    }
  };

  await withServer(groupRoles, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const groupId = "22222222-2222-4222-8222-222222222222";
    const roleId = "33333333-3333-4333-8333-333333333333";

    assert.equal((await fetch(`${baseUrl}/api/v1/access?userId=FORGED`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await request(baseUrl, "/api/v1/settings/group", "PUT", cookie, {
      userId: "FORGED", group: { name: "門市" }
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/v1/settings/group/delete", "POST", cookie, {
      employeeId: "FORGED", groupId, confirmName: "門市"
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/v1/settings/groups/order", "PUT", cookie, {
      userId: "FORGED", groupIds: [groupId]
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/v1/settings/access-role", "PUT", cookie, {
      userId: "FORGED", role: { name: "主管" }
    })).status, 200);
    assert.equal((await request(baseUrl, "/api/v1/settings/access-role/delete", "POST", cookie, {
      userId: "FORGED", roleId
    })).status, 200);

    assert.deepEqual(calls, [
      ["bundle", ACTOR_ID],
      ["group-save", ACTOR_ID, "門市"],
      ["group-delete", ACTOR_ID, groupId, "門市"],
      ["group-order", ACTOR_ID, [groupId]],
      ["role-save", ACTOR_ID, "主管"],
      ["role-delete", ACTOR_ID, roleId]
    ]);
  });
});
