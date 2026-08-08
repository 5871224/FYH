from pathlib import Path
import re

ROOT = Path('.')

OBSOLETE_FUNCTIONS = [
    'assign_department_group_v1',
    'assign_member_access_v1',
    'delete_department_general_v2',
    'delete_member_account_v3',
    'get_department_directory_v2',
    'get_employee_admin_directory_v2',
    'get_schedule_directory_v2',
    'save_department_attendance_fields_bulk',
    'save_departments_general_v2',
    'save_schedule_entries_bulk',
]


def remove_sql_function(text: str, name: str) -> str:
    pattern = re.compile(rf'create(?:\s+or\s+replace)?\s+function\s+public\.{re.escape(name)}\b', re.I)
    while True:
        match = pattern.search(text)
        if not match:
            break
        start = match.start()
        as_match = re.search(r'\bas\s+(\$[A-Za-z0-9_]*\$)', text[match.end():], re.I)
        if not as_match:
            raise RuntimeError(f'cannot find SQL body delimiter for {name}')
        delimiter = as_match.group(1)
        body_start = match.end() + as_match.end()
        close = text.find(delimiter, body_start)
        if close < 0:
            raise RuntimeError(f'cannot find SQL body end for {name}')
        end = close + len(delimiter)
        while end < len(text) and text[end] in ' \t\r\n':
            end += 1
        if end < len(text) and text[end] == ';':
            end += 1
        while end < len(text) and text[end] in ' \t\r\n':
            end += 1
        text = text[:start] + text[end:]
    return text


def clean_sql_file(path: Path):
    text = path.read_text(encoding='utf-8')
    for name in OBSOLETE_FUNCTIONS:
        text = remove_sql_function(text, name)
        # Transitional drops/grants for APIs that no longer exist are not canonical source.
        text = re.sub(rf'(?im)^.*\b(?:drop\s+function|grant\s+execute\s+on\s+function|revoke\s+.*\s+on\s+function).*\bpublic\.{re.escape(name)}\b.*;\s*$', '', text)
    path.write_text(text.rstrip() + '\n', encoding='utf-8')


for sql_name in ['001_current_schema.sql', '002_current_updates.sql']:
    clean_sql_file(ROOT / 'supabase' / sql_name)

updates_path = ROOT / 'supabase' / '002_current_updates.sql'
updates = updates_path.read_text(encoding='utf-8')
canonical_marker = '-- Canonical permission access architecture'
if canonical_marker in updates:
    updates = updates[:updates.index(canonical_marker)].rstrip() + '\n'
canonical = (ROOT / '.github' / 'access-v3-canonical.sqlpart').read_text(encoding='utf-8').strip()
extra_grants = '''

-- Existing purpose-specific RPCs used by the canonical browser API.
revoke all on function public.get_my_profile_v2() from public,anon;
revoke all on function public.get_group_access_bundle_v1() from public,anon;
revoke all on function public.get_group_entity_map_v1() from public,anon;
revoke all on function public.get_schedule_export_rows_v2(date,date) from public,anon;
revoke all on function public.save_schedule_group_v1(jsonb) from public,anon;
revoke all on function public.delete_schedule_group_v1(uuid,text) from public,anon;
revoke all on function public.reorder_schedule_groups_v1(uuid[]) from public,anon;
revoke all on function public.save_access_role_v1(jsonb) from public,anon;
revoke all on function public.delete_access_role_v1(uuid) from public,anon;
revoke all on function public.validate_member_group_change_v1(text,uuid) from public,anon;
revoke all on function public.get_schedule_archives_v1(uuid) from public,anon;
revoke all on function public.archive_schedule_v1(uuid,date,date) from public,anon;
revoke all on function public.unarchive_schedule_v1(uuid) from public,anon;
revoke all on function public.get_schedule_archive_detail_v1(uuid) from public,anon;

grant execute on function public.get_my_profile_v2() to authenticated,service_role;
grant execute on function public.get_group_access_bundle_v1() to authenticated,service_role;
grant execute on function public.get_group_entity_map_v1() to authenticated,service_role;
grant execute on function public.get_schedule_export_rows_v2(date,date) to authenticated,service_role;
grant execute on function public.save_schedule_group_v1(jsonb) to authenticated,service_role;
grant execute on function public.delete_schedule_group_v1(uuid,text) to authenticated,service_role;
grant execute on function public.reorder_schedule_groups_v1(uuid[]) to authenticated,service_role;
grant execute on function public.save_access_role_v1(jsonb) to authenticated,service_role;
grant execute on function public.delete_access_role_v1(uuid) to authenticated,service_role;
grant execute on function public.validate_member_group_change_v1(text,uuid) to authenticated,service_role;
grant execute on function public.get_schedule_archives_v1(uuid) to authenticated,service_role;
grant execute on function public.archive_schedule_v1(uuid,date,date) to authenticated,service_role;
grant execute on function public.unarchive_schedule_v1(uuid) to authenticated,service_role;
grant execute on function public.get_schedule_archive_detail_v1(uuid) to authenticated,service_role;

revoke all on function public.delete_member_account_v4(uuid) from public,anon,authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
'''.strip()
updates_path.write_text(updates.rstrip() + '\n\n' + canonical + '\n\n' + extra_grants + '\n', encoding='utf-8')

# ---------------------------------------------------------------------------
# CI guards: replace old compatibility assertions with canonical architecture checks.
# ---------------------------------------------------------------------------
(ROOT / 'scripts' / 'check-normalized-storage.js').write_text(r'''const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const webApi = read("src/renderer/web-api.js");
const schema = read("supabase/001_current_schema.sql") + "\n" + read("supabase/002_current_updates.sql");
const sqlFiles = fs.readdirSync(path.join(rootDir, "supabase")).filter((name) => /^\d+_.*\.sql$/i.test(name)).sort();

assert.deepStrictEqual(sqlFiles, ["001_current_schema.sql", "002_current_updates.sql"], "Supabase canonical schema must remain exactly two SQL files");
assert(!schema.includes("scheduler_state"), "legacy scheduler_state blob table must not return");
assert(schema.includes("create table if not exists public.schedule_entries"), "normalized schedule_entries table must exist");
assert(schema.includes("create table if not exists public.set_employee"), "normalized employee table must exist");
assert(schema.includes("create table if not exists public.set_departments"), "normalized department table must exist");
assert(schema.includes("create table if not exists public.set_shift"), "normalized shift table must exist");
assert(schema.includes("create table if not exists public.set_leave"), "normalized leave table must exist");
assert(schema.includes("create table if not exists public.set_overtime"), "normalized overtime table must exist");
assert(schema.includes("deleted_at"), "soft delete columns must remain canonical");

const requiredApis = [
  "get_scheduler_bootstrap_v3",
  "get_schedule_entries_v3",
  "save_schedule_entries_v3",
  "save_shift_v3",
  "save_catalog_item_v3",
  "delete_catalog_item_v3",
  "save_department_v3",
  "delete_department_v3",
  "reorder_settings_v3",
  "save_scheduler_preferences_v3",
  "save_holidays_v3",
  "get_department_attendance_settings_v3",
  "get_employee_admin_directory_v3"
];
for (const name of requiredApis) {
  assert(schema.toLowerCase().includes(`function public.${name}`), `${name} must exist in canonical SQL`);
}
assert(schema.includes("security definer"), "canonical privileged APIs must use SECURITY DEFINER");

const obsoleteApis = [
  "assign_department_group_v1",
  "assign_member_access_v1",
  "delete_department_general_v2",
  "delete_member_account_v3",
  "get_department_directory_v2",
  "get_employee_admin_directory_v2",
  "get_schedule_directory_v2",
  "save_department_attendance_fields_bulk",
  "save_departments_general_v2",
  "save_schedule_entries_bulk"
];
for (const name of obsoleteApis) {
  assert(!new RegExp(`create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${name}\\b`, "i").test(schema), `${name} legacy definition must be removed`);
}

for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "syncCatalogs(", "saveState("]) {
  assert(!webApi.includes(helper), `browser must not keep generic data helper ${helper}`);
}
for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays"]) {
  assert(!webApi.includes(`/rest/v1/${table}`), `browser must not access ${table} directly`);
}
assert(webApi.includes('callRpc("get_scheduler_bootstrap_v3"'), "browser bootstrap must use named v3 RPC");
assert(webApi.includes('callRpc("save_schedule_entries_v3"'), "schedule writes must use named v3 RPC");
assert(webApi.includes('callRpc("save_department_v3"'), "department writes must use named v3 RPC");
assert(webApi.includes('requestFunction("member-auth-admin"'), "member account mutations must use the canonical member-auth-admin Edge Function");

for (const removedEdge of ["catalog-admin", "member-delete-v2", "member-order-v2", "department-attendance-v2"]) {
  assert(!fs.existsSync(path.join(rootDir, "supabase", "functions", removedEdge)), `${removedEdge} obsolete Edge Function must be removed`);
}

for (const table of ["set_employee", "set_departments", "set_shift", "set_leave", "set_overtime", "schedule_entries", "scheduler_settings", "holidays", "meal_orders", "meal_products", "meal_settings", "attendance_days"]) {
  assert(schema.includes(`revoke all privileges on table public.${table} from anon,authenticated;`), `${table} direct browser privileges must be revoked`);
}

console.log("normalized storage and access architecture checks passed");
''', encoding='utf-8')

# Renderer alignment: only canonical Edge Functions are deployable and sensitive fields never use legacy role gates.
p = ROOT / 'scripts' / 'check-renderer-alignment.js'
t = p.read_text(encoding='utf-8')
t = re.sub(r'const expectedEdgeFunctions = \[[\s\S]*?\];', '''const expectedEdgeFunctions = [
  "member-auth-admin",
  "attendance-clock",
  "attendance-ledger",
  "attendance-ledger-export",
  "attendance-review-groups",
  "meal-order",
  "meal-report-v2",
  "meal-cancel-v2"
];''', t, count=1)
t = re.sub(r'\nconst memberDelete = fs\.readFileSync\([\s\S]*?\);', '', t, count=1)
t = re.sub(r'\nassert\(memberDelete\.includes\([\s\S]*?\);', '', t)
t = t.replace('assert(!webApi.includes("role_applies_to_group"), "browser API should not call permission SQL helpers directly");', 'assert(!webApi.includes("hasManagerAccess") && !webApi.includes("hasAdminAccess") && !webApi.includes("ensureManager"), "browser transport must not authorize from legacy role labels");')
p.write_text(t, encoding='utf-8')

# Settings guard: department writes are one named domain RPC.
p = ROOT / 'scripts' / 'check-settings-lists.js'
t = p.read_text(encoding='utf-8')
old = '''assert(
  webApi.includes("function mapDepartmentWriteRow")
    && !webApi.includes("row.attendance_enabled = Boolean(department.attendanceEnabled)")
    && webApi.includes("attendance_enabled: Boolean(department.attendanceEnabled)")
    && webApi.includes("save_department_attendance_fields_bulk"),
  "web api should persist department attendance fields through the admin RPC, not the set_departments upsert"
);'''
new = '''assert(
  webApi.includes('callRpc("save_department_v3"')
    && webApi.includes('callRpc("get_department_attendance_settings_v3"')
    && !webApi.includes("save_department_attendance_fields_bulk")
    && !webApi.includes("mapDepartmentWriteRow"),
  "department general/group/attendance access should use the canonical permission-aware RPCs"
);'''
if old not in t:
    raise RuntimeError('old department settings guard not found')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# Directory contract reflects the canonical bootstrap/admin APIs.
(ROOT / 'tests' / 'member-code-directory.test.js').write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表與管理人員名錄使用正式權限 RPC", () => {
  const webApi = read("src/renderer/web-api.js");
  const sql = read("supabase/002_current_updates.sql");
  assert.match(webApi, /callRpc\("get_scheduler_bootstrap_v3"/);
  assert.match(webApi, /callRpc\("get_employee_admin_directory_v3"/);
  assert.match(sql, /function public\.get_employee_admin_directory_v3\(\)/i);
  assert.doesNotMatch(webApi, /get_schedule_directory_v2|get_employee_admin_directory_v2|get_department_directory_v2/);
});

test("排班儲存只提交 UUID 主鍵，不以工號當外鍵", () => {
  const webApi = read("src/renderer/web-api.js");
  const start = webApi.indexOf("async function saveScheduleCells");
  const end = webApi.indexOf("async function reorderSettings", start);
  const block = webApi.slice(start, end);
  assert.match(block, /member_id: profileMemberId/);
  assert.match(block, /save_schedule_entries_v3/);
  assert.doesNotMatch(block, /employee_code\s*:/);
});
''', encoding='utf-8')

# Dedicated architecture test prevents the old mixed access model from returning.
(ROOT / 'tests' / 'access-architecture.test.js').write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const rendererDir = path.join(root, "src", "renderer");
const rendererSource = fs.readdirSync(rendererDir)
  .filter((name) => /\.(?:js|mjs)$/.test(name))
  .map((name) => read(path.join("src", "renderer", name)))
  .join("\n");

const coreTables = [
  "set_employee", "set_departments", "set_shift", "set_leave", "set_overtime",
  "schedule_entries", "scheduler_settings", "holidays", "schedule_groups",
  "access_roles", "access_role_groups", "schedule_archives", "schedule_archive_entries"
];

test("瀏覽器不得直接 CRUD 核心資料表", () => {
  for (const table of coreTables) {
    assert.doesNotMatch(rendererSource, new RegExp(`/rest/v1/${table}(?:\\?|[\\\"'\\`])`), table);
  }
  for (const helper of ["restSelect(", "restInsert(", "restUpdate(", "restDelete(", "saveState(", "syncCatalogs("]) {
    assert.equal(rendererSource.includes(helper), false, helper);
  }
});

test("權限資料層不得用 runtime monkey patch", () => {
  assert.doesNotMatch(rendererSource, /schedulerApi\.[A-Za-z0-9_]+\s*=\s*(?:async\s+)?function/);
  assert.doesNotMatch(rendererSource, /const\s+original(?:Load|Save|Render|Sync|Normalize)[A-Za-z0-9_]*\s*=/);
  assert.doesNotMatch(rendererSource, /installGroupPermissionArchiveFeature/);
});

test("正式寫入 API 都是具名領域操作", () => {
  const api = read("src/renderer/web-api.js");
  for (const rpc of [
    "save_schedule_entries_v3", "save_shift_v3", "save_catalog_item_v3", "delete_catalog_item_v3",
    "save_department_v3", "delete_department_v3", "reorder_settings_v3", "save_scheduler_preferences_v3", "save_holidays_v3"
  ]) assert.match(api, new RegExp(`callRpc\\(\\"${rpc}\\"`));
  assert.match(api, /requestFunction\("member-auth-admin"/);
});

test("舊通用 API 與重複 Edge Function 不得存在", () => {
  const deploy = read("scripts/deploy-edge-functions.ps1");
  for (const name of ["catalog-admin", "member-delete-v2", "member-order-v2", "department-attendance-v2"]) {
    assert.equal(fs.existsSync(path.join(root, "supabase", "functions", name)), false, name);
    assert.equal(deploy.includes(`\"${name}\"`), false, name);
  }
});
''', encoding='utf-8')

# ---------------------------------------------------------------------------
# Documentation: describe the single access path, not old implementation names.
# ---------------------------------------------------------------------------
p = ROOT / 'README.md'
t = p.read_text(encoding='utf-8')
start = t.index('## Edge Functions')
end = t.index('## 測試資料', start)
replacement = '''## 權限與資料存取架構

瀏覽器不直接 CRUD 核心資料表。正式資料流固定為：

`瀏覽器 → 具名 RPC / Edge Function → 權限與適用群組檢查 → 資料表`

- 核心班表、人員、單位、班別、假別與設定的讀寫使用具名 `SECURITY DEFINER` RPC。
- 人員登入帳號的新增、修改、重設密碼與刪除統一由 `member-auth-admin` 處理。
- 簽到與訂餐使用各自的 Edge Function；Edge Function 以 `access_role_id`、權限項目與適用群組判斷，不以舊 `admin/manager` 文字角色做授權。
- `anon` / `authenticated` 不具核心資料表直接權限；RLS 保留為第二層防護。
- 不使用通用整包 `saveState`、資料表名稱型 REST helper、runtime monkey patch 或舊版相容橋接。

## Edge Functions

- `member-auth-admin`：人員登入帳號新增、修改、密碼重設、軟刪除與權限角色驗證。
- `attendance-clock`：本人打卡。
- `attendance-ledger`：本人簽到簿資料。
- `attendance-review-groups`：依 `attendance_review` 與適用群組進行簽到審核、編輯與歷程查詢。
- `attendance-ledger-export`：依 `attendance_review` 與適用群組匯出已審簽到資料。
- `meal-order`：訂餐與訂餐管理。
- `meal-report-v2`：訂餐統計報表。
- `meal-cancel-v2`：訂餐取消。

'''
t = t[:start] + replacement + t[end:]
p.write_text(t, encoding='utf-8')

p = ROOT / '規格書.md'
t = p.read_text(encoding='utf-8')
start = t.index('## 9.2 Edge Functions')
end = t.index('## 9.3 PC 桌面版部署', start)
replacement = '''## 9.2 權限與資料存取架構

正式系統採單一路徑，不保留舊版通用存取方式：

1. 瀏覽器不得直接對核心資料表執行 `SELECT / INSERT / UPDATE / DELETE`。
2. 班表、人員、單位、班別、假別、群組、角色與系統設定，只能透過具名 RPC 或對應 Edge Function 存取。
3. 需要讀寫受保護主檔的 RPC 使用 `SECURITY DEFINER`，並在函式內先以 `auth.uid()` 驗證功能權限與適用群組。
4. `authenticated` 是 Supabase/PostgreSQL 的登入角色，不等同系統「管理員」；最高權限也不得靠資料表 GRANT 繞過應用權限。
5. 應用權限唯一來源為 `set_employee.access_role_id` → `access_roles.permissions`，再搭配 `access_role_groups` 判斷適用群組。
6. 舊欄位 `set_employee.role` 只保留必要的歷史／顯示相容資料，不作為功能授權依據。
7. RLS 保留為第二層資料庫防護，但不是前端功能授權來源；`anon` 與 `authenticated` 不授予核心資料表直接權限。
8. 不使用通用 `restSelect/restInsert/restUpdate/restDelete`、整包 `saveState/syncCatalogs`、動態資料表名稱 CRUD 或 runtime monkey patch。
9. 不保留已被正式 API 取代的舊 RPC／Edge Function；每個領域只有一個正式寫入入口。
10. 人員登入帳號新增、修改、重設密碼與刪除統一由 `member-auth-admin` 負責；其中權限角色、適用群組、單位與排班班別皆由伺服器驗證。
11. 班表讀取使用 `get_scheduler_bootstrap_v3` 與 `get_schedule_entries_v3`；班表寫入使用 `save_schedule_entries_v3`。
12. 單位、班別、假別／加班、排序、週期設定與假日各使用明確的具名 RPC，不再透過全狀態同步間接寫入。

目前 Edge Functions：

- `member-auth-admin`
- `attendance-clock`
- `attendance-ledger`
- `attendance-review-groups`
- `attendance-ledger-export`
- `meal-order`
- `meal-report-v2`
- `meal-cancel-v2`

簽到審核與匯出以 `attendance_review` 權限及角色適用群組限制資料範圍，不以 `admin/manager` 字串判斷。

'''
t = t[:start] + replacement + t[end:]
p.write_text(t, encoding='utf-8')

p = ROOT / 'AGENTS.md'
t = p.read_text(encoding='utf-8')
needle = '11. `main` workflow 必須只有 `.github/workflows/deploy-pages.yml`。\n'
addition = '''12. 瀏覽器不得直接 CRUD 核心資料表；資料層只允許具名 RPC / Edge Function。
13. 不得新增通用 `restSelect/restInsert/restUpdate/restDelete`、整包 `saveState/syncCatalogs` 或依資料表名稱分派的寫入器。
14. 權限判斷以 `access_role_id + access_roles.permissions + access_role_groups` 為唯一來源，不得用 `set_employee.role` 的 `admin/manager` 字串授權。
15. 需要受保護主檔的 mutation RPC 必須 `SECURITY DEFINER`，並在函式內先驗證 `auth.uid()`、功能權限與適用群組。
16. 資料存取架構不得以後載入 script、runtime monkey patch 或 API wrapper 覆寫修補；必須直接修改正式模組。
'''
if addition not in t:
    if needle not in t: raise RuntimeError('AGENTS insertion marker missing')
    t = t.replace(needle, needle + addition, 1)
p.write_text(t, encoding='utf-8')

print('canonical permission architecture sources finalized')
