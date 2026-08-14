const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Native 人員管理不得依賴 Supabase Auth/RPC/JWT", () => {
  const source = [
    read("src/backend/repositories/native-member-repository.js"),
    read("src/backend/services/native-member-service.js")
  ].join("\n");
  assert.doesNotMatch(source, /auth\.uid\(\)|\/auth\/v1|\/rest\/v1|\/functions\/v1|access_token|refresh_token|apikey|supabase/i);
  assert.match(source, /public\.auth_accounts/);
  assert.match(source, /public\.auth_sessions/);
  assert.match(source, /public\.schedule_archives|is_schedule_date_archived/);
  assert.match(source, /database\.transaction\(async \(transaction\) =>/);
});

test("Native 新增人員在同一 Repository transaction 建立人員與登入帳號", () => {
  const source = read("src/backend/repositories/native-member-repository.js");
  assert.match(source, /insert into public\.set_employee/);
  assert.match(source, /insert into public\.auth_accounts/);
  assert.match(source, /password_hash/);
  assert.match(source, /MEMBER_CODE_DUPLICATE/);
  assert.doesNotMatch(source, /@local\.invalid|buildLoginEmail|member-auth-admin/);
});

test("人員 API 使用具名版本化路徑", () => {
  const contract = read("src/backend/api-contract.js");
  assert.match(contract, /membersDirectory:[\s\S]*method: "GET"[\s\S]*\/members/);
  assert.match(contract, /memberSave:[\s\S]*method: "PUT"[\s\S]*\/members/);
  assert.match(contract, /members\/group-change\/validate/);
  assert.match(contract, /members\/password\/reset/);
  assert.match(contract, /members\/delete/);
});

test("Native runtime 注入 member Repository 與 Service", () => {
  const runtime = read("src/backend/native-runtime.js");
  assert.match(runtime, /createNativeMemberRepository/);
  assert.match(runtime, /createNativeMemberService/);
  assert.match(runtime, /members: memberService/);
});
