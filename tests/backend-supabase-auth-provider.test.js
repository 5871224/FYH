const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseAuthProvider } = require("../src/backend/providers/supabase-auth-provider");

function response(status, payload) {
  return new Response(payload === undefined ? undefined : JSON.stringify(payload), {
    status,
    headers: payload === undefined ? {} : { "Content-Type": "application/json" }
  });
}

test("Supabase Auth Adapter 在伺服器端處理工號假 Email 與 Token", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/token?grant_type=password")) {
      const body = JSON.parse(options.body);
      assert.equal(body.email, "ab-001@local.invalid");
      assert.equal(body.password, "pw");
      return response(200, {
        access_token: "A1",
        refresh_token: "R1",
        expires_at: 9999999999,
        user: { id: "U1", email: "ab-001@local.invalid" }
      });
    }
    if (url.endsWith("/rest/v1/rpc/get_my_profile_v3")) {
      assert.equal(options.headers.Authorization, "Bearer A1");
      return response(200, [{ id: "U1", employee_code: "AB 001", full_name: "測試" }]);
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const provider = createSupabaseAuthProvider({
    baseUrl: "https://provider.example",
    anonKey: "public-key",
    fetchImpl
  });
  const result = await provider.signIn({ loginAccount: "AB 001", password: "pw" });

  assert.equal(result.user.id, "U1");
  assert.equal(result.profile.employee_code, "AB 001");
  assert.equal(result.providerSession.access_token, "A1");
  assert.equal(calls.length, 2);
});

test("Supabase Auth Adapter 過期時只在 Provider 內刷新 Token", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(url);
    if (url.endsWith("/auth/v1/token?grant_type=refresh_token")) {
      assert.deepEqual(JSON.parse(options.body), { refresh_token: "R1" });
      return response(200, {
        access_token: "A2",
        refresh_token: "R2",
        expires_at: 9999999999,
        user: { id: "U1", email: "u1@local.invalid" }
      });
    }
    if (url.endsWith("/rest/v1/rpc/get_my_profile_v3")) {
      assert.equal(options.headers.Authorization, "Bearer A2");
      return response(200, [{ id: "U1", employee_code: "0001" }]);
    }
    throw new Error(`unexpected url: ${url}`);
  };
  const provider = createSupabaseAuthProvider({
    baseUrl: "https://provider.example",
    anonKey: "public-key",
    fetchImpl,
    now: () => 2_000_000
  });

  const result = await provider.getAuthContext({
    access_token: "A1",
    refresh_token: "R1",
    expires_at: 1,
    user: { id: "U1", email: "u1@local.invalid" }
  });

  assert.equal(result.providerSession.access_token, "A2");
  assert.equal(result.providerSession.refresh_token, "R2");
  assert.deepEqual(calls, [
    "https://provider.example/auth/v1/token?grant_type=refresh_token",
    "https://provider.example/rest/v1/rpc/get_my_profile_v3"
  ]);
});
