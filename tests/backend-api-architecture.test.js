const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("通用 Backend API 核心不得依賴 Supabase transport 名稱", () => {
  const files = [
    "src/backend/api-contract.js",
    "src/backend/api-router.js",
    "src/backend/errors.js",
    "src/backend/session-store.js",
    "src/web-server.js"
  ];
  const source = files.map(read).join("\n");
  assert.doesNotMatch(source, /supabase|\/auth\/v1\/|\/rest\/v1\/|access_token|refresh_token|apikey/i);
});

test("Provider 專用登入細節只存在 backend/providers", () => {
  const provider = read("src/backend/providers/supabase-auth-provider.js");
  assert.match(provider, /@local\.invalid/);
  assert.match(provider, /\/auth\/v1\/token\?grant_type=password/);
  assert.match(provider, /\/rest\/v1\/rpc\/get_my_profile_v3/);
  assert.match(provider, /access_token/);
  assert.match(provider, /refresh_token/);
});

test("正式 API 使用版本化具名路徑，不提供通用動態 CRUD", () => {
  const contract = read("src/backend/api-contract.js");
  assert.match(contract, /const API_PREFIX = `\/api\/v\$\{CONTRACT_VERSION\}`/);
  assert.match(contract, /`\$\{API_PREFIX\}\/auth\/sign-in`/);
  assert.match(contract, /auth\/context/);
  assert.match(contract, /auth\/sign-out/);
  assert.match(contract, /auth\/password/);
  assert.doesNotMatch(contract, /restSelect|restInsert|restUpdate|restDelete|tableName|operationName/);
});

test("一般 PostgreSQL 資料層不得依賴 Supabase HTTP transport", () => {
  const files = [
    "src/backend/db/database.js",
    "src/backend/db/postgres.js",
    "src/backend/repositories/auth-account-repository.js"
  ];
  const source = files.map(read).join("\n");
  assert.doesNotMatch(source, /\/auth\/v1|\/rest\/v1|\/functions\/v1|apikey|supabaseAnonKey|supabaseUrl/i);
  assert.match(read("src/backend/repositories/auth-account-repository.js"), /lower\(account\.login_account\) = \$1/);
  assert.match(read("src/backend/repositories/auth-account-repository.js"), /password_hash = \$2/);
});

test("福園號密碼雜湊使用 Node crypto scrypt，不依賴 Provider Token", () => {
  const hasher = read("src/backend/auth/password-hasher.js");
  assert.match(hasher, /scrypt/);
  assert.match(hasher, /timingSafeEqual/);
  assert.doesNotMatch(hasher, /access_token|refresh_token|supabase/i);
});
