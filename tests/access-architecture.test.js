const test = require("node:test");
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
    assert.equal(rendererSource.includes("/rest/v1/" + table), false, table);
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

test("本人 Edge Function 必須拒絕已軟刪除帳號", () => {
  for (const file of [
    "supabase/functions/attendance-clock/index.ts",
    "supabase/functions/attendance-ledger/index.ts",
    "supabase/functions/meal-order/index.ts",
    "supabase/functions/meal-cancel-v2/index.ts"
  ]) {
    const source = read(file);
    assert.match(source, /deleted_at/, `${file} 缺少 deleted_at 驗證`);
    assert.match(source, /\.is\(\"deleted_at\", null\)/, `${file} 未限制有效人員資料列`);
  }
});

test("打卡地點只能使用本人所屬群組的有效單位", () => {
  const source = read("supabase/functions/attendance-clock/index.ts");
  assert.match(source, /\.eq\(\"group_id\", groupId\)/);
  assert.match(source, /\.eq\(\"attendance_enabled\", true\)/);
  assert.match(source, /\.is\(\"deleted_at\", null\)/);
  assert.match(source, /resolveClockLocation\(ctx, req, body, profile\.group_id\)/);
});

test("正式 SQL 最終守門使用權限項目而非文字角色", () => {
  const sql = read("supabase/002_current_updates.sql");
  const marker = sql.lastIndexOf("-- 2026-08-08 全系統權限守門收斂");
  assert.notEqual(marker, -1, "缺少全系統權限守門收斂區段");
  const finalSecurity = sql.slice(marker);
  assert.match(finalSecurity, /has_access_permission\(p_user_id,'permission_settings'\)/);
  assert.match(finalSecurity, /drop trigger if exists protect_admin_member_trigger/);
  assert.match(finalSecurity, /drop trigger if exists trg_protect_last_effective_admin_v2/);
  assert.match(finalSecurity, /drop trigger if exists attendance_days_touch_updated_at/);
  assert.match(finalSecurity, /has_access_permission\(auth\.uid\(\),'meal_admin'\)/);
  assert.match(finalSecurity, /has_access_permission\(auth\.uid\(\),'leave_settings'\)/);
  assert.doesNotMatch(finalSecurity, /role\.legacy_role\s+in\s*\('admin','manager'\)/);
  assert.doesNotMatch(finalSecurity, /employee\.role\s*=\s*'admin'/);
});

test("角色更新必須保護最後一位有效權限管理帳號", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.match(sql, /系統必須保留至少一個有效的權限管理帳號/);
  assert.match(sql, /'permission_settings'=any\(coalesce\(v_existing\.permissions/);
  assert.match(sql, /e\.access_role_id<>v_id/);
});
