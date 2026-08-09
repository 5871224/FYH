from pathlib import Path
import re


def replace_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 replacement, got {count}")
    return updated


# 1) Browser pagination: do not depend on HTTP Range for POST RPC calls.
api_path = Path("src/renderer/web-api.js")
api = api_path.read_text(encoding="utf-8")
api_pattern = r'''  const RPC_PAGE_SIZE = 1000;\n\n  function parseContentRangeTotal\(value\) \{.*?\n  \}\n\n  async function callRpcAllRows\(functionName, payload = \{\}\) \{.*?\n  \}\n'''
api_replacement = '''  const RPC_PAGE_SIZE = 500;\n\n  async function callRpcAllRows(functionName, payload = {}) {\n    const rows = [];\n    let offset = 0;\n    while (true) {\n      const page = await callRpc(functionName, {\n        ...payload,\n        p_offset: offset,\n        p_limit: RPC_PAGE_SIZE\n      }) || [];\n      if (!Array.isArray(page)) {\n        throw new Error(`${functionName} 回傳格式錯誤`);\n      }\n      rows.push(...page);\n      if (page.length < RPC_PAGE_SIZE) {\n        break;\n      }\n      offset += page.length;\n    }\n    return rows;\n  }\n'''
api = replace_once(api, api_pattern, api_replacement, "web-api explicit RPC pagination", flags=re.S)
api_path.write_text(api, encoding="utf-8")


# 2) Canonical SQL: pagination is part of the RPC contract itself.
sql_path = Path("supabase/002_current_updates.sql")
sql = sql_path.read_text(encoding="utf-8")
sql_pattern = r'''create or replace function public\.get_schedule_entries_v3\(p_start_date date,p_end_date date\)\nreturns setof public\.schedule_entries\nlanguage sql\nstable\nsecurity definer\nset search_path=public,pg_catalog\nas \$\$\n.*?\n\$\$;\n\ncreate or replace function public\.save_schedule_entries_v3'''
sql_replacement = '''drop function if exists public.get_schedule_entries_v3(date,date);\ncreate or replace function public.get_schedule_entries_v3(\n  p_start_date date,\n  p_end_date date,\n  p_offset integer,\n  p_limit integer\n)\nreturns setof public.schedule_entries\nlanguage sql\nstable\nsecurity definer\nset search_path=public,pg_catalog\nas $$\n  with actor as materialized (\n    select employee.access_role_id\n    from public.set_employee employee\n    join public.access_roles role on role.id=employee.access_role_id\n    where employee.id=(select auth.uid())\n      and employee.deleted_at is null\n      and 'schedule_view'=any(coalesce(role.permissions,'{}'::text[]))\n      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)\n    limit 1\n  ),\n  allowed_groups as materialized (\n    select role_group.group_id\n    from actor\n    join public.access_role_groups role_group on role_group.role_id=actor.access_role_id\n  )\n  select entry.*\n  from public.schedule_entries entry\n  join allowed_groups allowed on allowed.group_id=entry.group_id\n  where p_start_date is not null\n    and p_end_date is not null\n    and p_start_date<=p_end_date\n    and entry.work_date between p_start_date and p_end_date\n  order by entry.work_date,entry.member_id,entry.id\n  limit least(greatest(coalesce(p_limit,500),1),500)\n  offset greatest(coalesce(p_offset,0),0)\n$$;\n\ncreate or replace function public.save_schedule_entries_v3'''
sql = replace_once(sql, sql_pattern, sql_replacement, "canonical schedule RPC pagination", flags=re.S)
sql = sql.replace(
    "revoke all on function public.get_schedule_entries_v3(date,date) from public,anon;",
    "revoke all on function public.get_schedule_entries_v3(date,date,integer,integer) from public,anon;"
)
sql = sql.replace(
    "grant execute on function public.get_schedule_entries_v3(date,date) to authenticated,service_role;",
    "grant execute on function public.get_schedule_entries_v3(date,date,integer,integer) to authenticated,service_role;"
)
if "get_schedule_entries_v3(date,date)" in sql:
    raise SystemExit("old two-argument schedule RPC signature remains in canonical SQL")
sql_path.write_text(sql, encoding="utf-8")


# 3) Regression tests: explicit RPC paging, not HTTP Range headers.
test_path = Path("tests/schedule-eight-week-loading.test.js")
test = test_path.read_text(encoding="utf-8")
old_test = r'''test("目前八週班表 RPC 必須分頁讀到全部列，不受單次回傳上限截斷", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /const RPC_PAGE_SIZE = 1000/);
  assert.match(api, /async function callRpcAllRows\(functionName, payload = \{\}\)/);
  assert.match(api, /"Range-Unit": "items"/);
  assert.match(api, /Range: `\$\{offset\}-\$\{offset \+ RPC_PAGE_SIZE - 1\}`/);
  assert.match(api, /parseContentRangeTotal\(response\.headers\.get\("Content-Range"\)\)/);
  assert.match(api, /offset \+= page\.length/);
});'''
new_test = r'''test("目前八週班表 RPC 必須以明確 offset/limit 分頁讀到全部列", () => {
  const api = read("src/renderer/web-api.js");
  const sql = read("supabase/002_current_updates.sql");
  assert.match(api, /const RPC_PAGE_SIZE = 500/);
  assert.match(api, /async function callRpcAllRows\(functionName, payload = \{\}\)/);
  assert.match(api, /p_offset: offset/);
  assert.match(api, /p_limit: RPC_PAGE_SIZE/);
  assert.match(api, /if \(page\.length < RPC_PAGE_SIZE\)/);
  assert.match(api, /offset \+= page\.length/);
  assert.doesNotMatch(api, /Range-Unit|Content-Range|parseContentRangeTotal/);
  assert.match(sql, /get_schedule_entries_v3\(\s*p_start_date date,\s*p_end_date date,\s*p_offset integer,\s*p_limit integer\s*\)/);
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit,500\),1\),500\)/);
  assert.match(sql, /offset greatest\(coalesce\(p_offset,0\),0\)/);
});'''
if test.count(old_test) != 1:
    raise SystemExit(f"schedule pagination test marker count={test.count(old_test)}")
test = test.replace(old_test, new_test, 1)
test_path.write_text(test, encoding="utf-8")


# 4) Spec: the pagination contract is server-side and explicit.
spec_path = Path("規格書.md")
spec = spec_path.read_text(encoding="utf-8")
old_spec = "- 目前 56 天內的班表資料筆數不得受單次 REST／RPC 回傳列數上限截斷；前端必須分頁讀取直到取得該 56 天的全部班表列。"
new_spec = "- 目前 56 天內的班表資料筆數不得受單次 REST／RPC 回傳列數上限截斷；`get_schedule_entries_v3` 必須以 `p_offset`／`p_limit` 明確分頁，每頁最多 500 筆，前端持續讀取直到不足一頁為止；不得依賴 HTTP Range header 作為 RPC 翻頁機制。"
if spec.count(old_spec) != 1:
    raise SystemExit(f"spec pagination marker count={spec.count(old_spec)}")
spec = spec.replace(old_spec, new_spec, 1)
spec_path.write_text(spec, encoding="utf-8")

print("explicit schedule RPC pagination patch applied")
