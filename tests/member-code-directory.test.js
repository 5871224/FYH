const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("具有人員設定權限的班表目錄應回傳工號", () => {
  const sql = read("supabase/002_current_updates.sql");
  const start = sql.indexOf("drop function if exists public.get_schedule_directory_v2()");
  const end = sql.indexOf("create or replace function public.get_employee_admin_directory_v2()", start);
  const block = sql.slice(start, end);

  assert.ok(start >= 0 && end > start, "缺少正式班表人員目錄函式");
  assert.match(block, /returns table\(id uuid,employee_code text,/);
  assert.match(block, /has_access_permission\(auth\.uid\(\),'member_settings'\)/);
  assert.match(block, /then employee_code else null::text end/);
  assert.match(block, /grant execute on function public\.get_schedule_directory_v2\(\) to authenticated,service_role/);
});

test("前端人員資料映射應保留 RPC 回傳的工號", () => {
  const webApi = read("src/renderer/web-api.js");
  assert.match(webApi, /code:\s*String\(row\?\.employee_code\s*\|\|\s*""\)/);
});
