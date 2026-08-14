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

test("Native Provider 只依賴身份 Repository，不保留 Supabase 登入 transport", () => {
  const oldProvider = path.join(root, "src", "backend", "providers", "supabase-auth-provider.js");
  const provider = read("src/backend/providers/native-auth-provider.js");
  assert.equal(fs.existsSync(oldProvider), false);
  assert.match(provider, /identityRepository\.authenticate\(login, secret\)/);
  assert.match(provider, /identityRepository\.findEffectiveByEmployeeId\(employeeId\)/);
  assert.match(provider, /identityRepository\.changeCredential\(employeeId, newPassword\)/);
  assert.match(provider, /providerSession: \{ employeeId \}/);
  assert.doesNotMatch(provider, /@local\.invalid|\/auth\/v1\/|\/rest\/v1\/|access_token|refresh_token|apikey|supabase/i);
});

test("正式 API 使用版本化具名路徑，不提供通用動態 CRUD", () => {
  const contract = read("src/backend/api-contract.js");
  assert.match(contract, /const API_PREFIX = `\/api\/v\$\{CONTRACT_VERSION\}`/);
  assert.match(contract, /`\$\{API_PREFIX\}\/auth\/sign-in`/);
  assert.match(contract, /auth\/context/);
  assert.match(contract, /auth\/sign-out/);
  assert.match(contract, /auth\/password/);
  assert.match(contract, /scheduleBootstrap:[\s\S]*method: "GET"[\s\S]*schedule\/bootstrap/);
  assert.match(contract, /scheduleEntries:[\s\S]*method: "GET"[\s\S]*schedule\/entries/);
  assert.match(contract, /scheduleEntriesSave:[\s\S]*method: "PUT"[\s\S]*schedule\/entries/);
  assert.match(contract, /schedulePreferencesSave:[\s\S]*method: "PUT"[\s\S]*schedule\/preferences/);
  assert.match(contract, /settingsReorder:[\s\S]*method: "PUT"[\s\S]*settings\/order/);
  assert.match(contract, /departmentSave:[\s\S]*settings\/department/);
  assert.match(contract, /departmentDelete:[\s\S]*settings\/department\/delete/);
  assert.match(contract, /shiftSave:[\s\S]*settings\/shift/);
  assert.match(contract, /catalogSave:[\s\S]*settings\/catalog/);
  assert.match(contract, /catalogDelete:[\s\S]*settings\/catalog\/delete/);
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

test("Native 身分、權限、班表、設定與主檔 Repository 只使用一般 PostgreSQL 身分參數", () => {
  const files = [
    "src/backend/repositories/native-identity-repository.js",
    "src/backend/repositories/native-access-repository.js",
    "src/backend/repositories/native-schedule-repository.js",
    "src/backend/repositories/native-settings-repository.js",
    "src/backend/repositories/native-master-data-repository.js",
    "src/backend/services/native-schedule-service.js",
    "src/backend/services/native-settings-service.js",
    "src/backend/services/native-master-data-service.js",
    "src/backend/postgres-session-store.js"
  ];
  const source = files.map(read).join("\n");
  assert.doesNotMatch(source, /\/auth\/v1|\/rest\/v1|\/functions\/v1|access_token|refresh_token|apikey|supabaseAnonKey|supabaseUrl|auth\.uid\(\)/i);
  assert.match(read("src/backend/repositories/native-identity-repository.js"), /public\.auth_accounts/);
  assert.match(read("src/backend/repositories/native-access-repository.js"), /\$1::uuid/);
  assert.match(read("src/backend/repositories/native-schedule-repository.js"), /employee\.id = \$1::uuid/);
  assert.match(read("src/backend/repositories/native-settings-repository.js"), /employee\.id = \$1::uuid/);
  assert.match(read("src/backend/repositories/native-master-data-repository.js"), /public\.access_role_groups/);
  assert.match(read("src/backend/postgres-session-store.js"), /sha256/);
});

test("Native 班表寫入必須先驗權限並在單一 Database transaction 內完成", () => {
  const schedule = read("src/backend/repositories/native-schedule-repository.js");
  assert.match(schedule, /async function saveEntries\(employeeId, entries\)/);
  assert.match(schedule, /return database\.transaction\(async \(transaction\) =>/);
  assert.match(schedule, /'schedule_manage' = any/);
  assert.match(schedule, /public\.access_role_groups/);
  assert.match(schedule, /public\.schedule_archives/);
  assert.match(schedule, /delete from public\.schedule_entries/);
  assert.match(schedule, /on conflict\(member_id, work_date\) do update/);
  assert.doesNotMatch(schedule, /auth\.uid\(\)|save_schedule_entries_v3|\/rest\/v1\/rpc/i);
});

test("Native 設定排序必須依權限與適用群組，並使用 Database transaction", () => {
  const settings = read("src/backend/repositories/native-settings-repository.js");
  assert.match(settings, /department_settings/);
  assert.match(settings, /member_settings/);
  assert.match(settings, /schedule_manage/);
  assert.match(settings, /leave_settings/);
  assert.match(settings, /permission_settings/);
  assert.match(settings, /public\.access_role_groups/);
  assert.match(settings, /database\.transaction\(async \(transaction\) =>/);
  assert.doesNotMatch(settings, /auth\.uid\(\)|reorder_settings_v3|save_scheduler_preferences_v3|\/rest\/v1\/rpc/i);
});

test("Native 主檔 CRUD 保留適用群組、封存與軟硬刪除規則", () => {
  const master = read("src/backend/repositories/native-master-data-repository.js");
  assert.match(master, /department_settings/);
  assert.match(master, /schedule_manage/);
  assert.match(master, /leave_settings/);
  assert.match(master, /permission_settings/);
  assert.match(master, /public\.access_role_groups/);
  assert.match(master, /public\.schedule_archives/);
  assert.match(master, /public\.meal_orders/);
  assert.match(master, /array_remove\(schedule_shift_ids/);
  assert.match(master, /database\.transaction\(async \(transaction\) =>/);
  assert.doesNotMatch(master, /auth\.uid\(\)|save_department_v3|delete_department_v3|save_shift_v3|save_catalog_item_v3|delete_catalog_item_v3|\/rest\/v1\/rpc/i);
});

test("Native runtime 必須把權限、班表、設定與主檔 Repository 注入服務", () => {
  const runtime = read("src/backend/native-runtime.js");
  assert.match(runtime, /createNativeAccessRepository/);
  assert.match(runtime, /createNativeScheduleRepository/);
  assert.match(runtime, /createNativeSettingsRepository/);
  assert.match(runtime, /createNativeMasterDataRepository/);
  assert.match(runtime, /createNativeScheduleService/);
  assert.match(runtime, /createNativeSettingsService/);
  assert.match(runtime, /createNativeMasterDataService/);
  assert.match(runtime, /createNativeAuthProvider\(identityRepository, \{ accessRepository \}\)/);
  assert.match(runtime, /schedule: scheduleService/);
  assert.match(runtime, /settings: settingsService/);
  assert.match(runtime, /masterData: masterDataService/);
});

test("福園號密碼雜湊使用 Node crypto scrypt，不依賴 Provider Token", () => {
  const hasher = read("src/backend/auth/password-hasher.js");
  assert.match(hasher, /scrypt/);
  assert.match(hasher, /timingSafeEqual/);
  assert.doesNotMatch(hasher, /access_token|refresh_token|supabase/i);
});
