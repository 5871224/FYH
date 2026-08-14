const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Native 群組與角色管理不得依賴 Supabase RPC/JWT", () => {
  const source = [
    read("src/backend/repositories/native-group-role-repository.js"),
    read("src/backend/services/native-group-role-service.js")
  ].join("\n");
  assert.doesNotMatch(source, /auth\.uid\(\)|\/auth\/v1|\/rest\/v1|\/functions\/v1|access_token|refresh_token|apikey|supabase/i);
  assert.match(source, /public\.schedule_groups/);
  assert.match(source, /public\.access_roles/);
  assert.match(source, /public\.access_role_groups/);
  assert.match(source, /database\.transaction\(async \(transaction\) =>/);
});

test("群組刪除維持未封存班表刪除與歷史主檔 soft delete 規則", () => {
  const source = read("src/backend/repositories/native-group-role-repository.js");
  assert.match(source, /delete from public\.schedule_entries/);
  assert.match(source, /not public\.is_schedule_date_archived/);
  assert.match(source, /set_config\('fyh\.group_delete', 'on', true\)/);
  assert.match(source, /update public\.set_employee[\s\S]*group_id = null/);
  assert.match(source, /update public\.set_shift[\s\S]*deleted_at = now\(\)/);
  assert.match(source, /update public\.set_departments[\s\S]*deleted_at = now\(\)/);
  assert.match(source, /update public\.schedule_groups[\s\S]*status = 'inactive'/);
});

test("角色權限仍保護最後權限管理帳號與最後權限設定角色", () => {
  const source = read("src/backend/repositories/native-group-role-repository.js");
  assert.match(source, /LAST_PRIVILEGED_ACCOUNT/);
  assert.match(source, /LAST_PERMISSION_ROLE/);
  assert.match(source, /ACCESS_ROLE_IN_USE/);
  assert.match(source, /permission_settings/);
});

test("群組與角色 API 使用具名版本化路徑", () => {
  const contract = read("src/backend/api-contract.js");
  assert.match(contract, /accessBundle:[\s\S]*method: "GET"[\s\S]*\/access/);
  assert.match(contract, /settings\/group/);
  assert.match(contract, /settings\/group\/delete/);
  assert.match(contract, /settings\/groups\/order/);
  assert.match(contract, /settings\/access-role/);
  assert.match(contract, /settings\/access-role\/delete/);
});

test("Native runtime 注入 groupRoles Repository 與 Service", () => {
  const runtime = read("src/backend/native-runtime.js");
  assert.match(runtime, /createNativeGroupRoleRepository/);
  assert.match(runtime, /createNativeGroupRoleService/);
  assert.match(runtime, /groupRoles: groupRoleService/);
});
