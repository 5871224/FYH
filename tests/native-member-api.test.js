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

async function withServer(services, callback) {
  const server = startServer(0, {
    provider: createProvider(),
    services,
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

async function jsonRequest(baseUrl, path, method, cookie, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return response;
}

test("人員 API 一律採用 HttpOnly Session 身分，不接受 Body 冒用 userId", async () => {
  const calls = [];
  const members = {
    getDirectory: async (employeeId) => {
      calls.push(["directory", employeeId]);
      return [{ id: "M1", employee_code: "A01" }];
    },
    saveMember: async (employeeId, member, previousEmployeeCode) => {
      calls.push(["save", employeeId, member.employeeCode, previousEmployeeCode]);
      return { ok: true, created: false };
    },
    validateGroupChange: async (employeeId, code, groupId) => {
      calls.push(["validate", employeeId, code, groupId]);
      return { ok: true };
    },
    resetPassword: async (employeeId, code, password) => {
      calls.push(["reset", employeeId, code, password]);
      return { ok: true, selfReset: false };
    },
    deleteMember: async (employeeId, code, currentPassword) => {
      calls.push(["delete", employeeId, code, currentPassword]);
      return { ok: true, deleted: true, selfDelete: false };
    }
  };

  await withServer({ members }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);

    const directory = await fetch(`${baseUrl}/api/v1/members?userId=FORGED`, {
      headers: { Cookie: cookie }
    });
    assert.equal(directory.status, 200);
    assert.equal((await directory.json())[0].employee_code, "A01");

    const saved = await jsonRequest(baseUrl, "/api/v1/members", "PUT", cookie, {
      userId: "FORGED",
      member: { employeeCode: "A01" },
      previousEmployeeCode: "OLD"
    });
    assert.equal(saved.status, 200);

    const validated = await jsonRequest(baseUrl, "/api/v1/members/group-change/validate", "POST", cookie, {
      employeeId: "FORGED",
      employeeCode: "A01",
      newGroupId: "G2"
    });
    assert.equal(validated.status, 200);

    const reset = await jsonRequest(baseUrl, "/api/v1/members/password/reset", "POST", cookie, {
      userId: "FORGED",
      employeeCode: "A01",
      password: "0000"
    });
    assert.equal(reset.status, 200);

    const deleted = await jsonRequest(baseUrl, "/api/v1/members/delete", "POST", cookie, {
      userId: "FORGED",
      employeeCode: "A01",
      currentPassword: "pw"
    });
    assert.equal(deleted.status, 200);

    assert.deepEqual(calls, [
      ["directory", ACTOR_ID],
      ["save", ACTOR_ID, "A01", "OLD"],
      ["validate", ACTOR_ID, "A01", "G2"],
      ["reset", ACTOR_ID, "A01", "0000"],
      ["delete", ACTOR_ID, "A01", "pw"]
    ]);
  });
});

test("重設自己的密碼或刪除自己時清除目前 Session Cookie", async () => {
  const members = {
    getDirectory: async () => [],
    saveMember: async () => ({ ok: true }),
    validateGroupChange: async () => ({ ok: true }),
    resetPassword: async () => ({ ok: true, selfReset: true }),
    deleteMember: async () => ({ ok: true, deleted: true, selfDelete: true })
  };

  await withServer({ members }, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const reset = await jsonRequest(baseUrl, "/api/v1/members/password/reset", "POST", cookie, {
      employeeCode: "0001"
    });
    assert.equal(reset.status, 200);
    assert.match(reset.headers.get("set-cookie") || "", /Max-Age=0/);

    const cookie2 = await signIn(baseUrl);
    const deleted = await jsonRequest(baseUrl, "/api/v1/members/delete", "POST", cookie2, {
      employeeCode: "0001",
      currentPassword: "pw"
    });
    assert.equal(deleted.status, 200);
    assert.match(deleted.headers.get("set-cookie") || "", /Max-Age=0/);
  });
});
