from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        if new in content:
            return content
        raise RuntimeError(f"找不到 {label}")
    return content.replace(old, new, 1)


DIRECTORY_FUNCTIONS_SQL = r'''
create or replace function public.get_my_profile_v2()
returns table (
  id uuid,
  employee_code text,
  full_name text,
  role text,
  home_department_id uuid,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  schedule_department_ids text[],
  monthly_rest_days integer,
  fixed_rest_weekday integer,
  schedule_shift_ids uuid[],
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    employee.id,
    employee.employee_code,
    employee.full_name,
    employee.role,
    employee.home_department_id,
    employee.position_name,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.created_at,
    employee.updated_at,
    employee.schedule_department_ids,
    employee.monthly_rest_days,
    employee.fixed_rest_weekday,
    employee.schedule_shift_ids,
    employee.sort_order
  from public.set_employee employee
  where employee.id = auth.uid()
$$;

create or replace function public.get_schedule_directory_v2()
returns table (
  id uuid,
  full_name text,
  home_department_id uuid,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  is_active boolean,
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with actor as (
    select public.is_effective_user(auth.uid()) as effective
  )
  select
    employee.id,
    employee.full_name,
    employee.home_department_id,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.sort_order
  from actor
  cross join public.set_employee employee
  where actor.effective
    and employee.is_active
  order by employee.sort_order, employee.full_name, employee.id
$$;

create or replace function public.get_employee_admin_directory_v2()
returns table (
  id uuid,
  employee_code text,
  full_name text,
  role text,
  home_department_id uuid,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  schedule_department_ids text[],
  monthly_rest_days integer,
  fixed_rest_weekday integer,
  schedule_shift_ids uuid[],
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with actor as (
    select public.is_manager(auth.uid()) as manager_access
  )
  select
    employee.id,
    employee.employee_code,
    employee.full_name,
    employee.role,
    employee.home_department_id,
    employee.position_name,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.created_at,
    employee.updated_at,
    employee.schedule_department_ids,
    employee.monthly_rest_days,
    employee.fixed_rest_weekday,
    employee.schedule_shift_ids,
    employee.sort_order
  from actor
  cross join public.set_employee employee
  where actor.manager_access
    and employee.is_active
  order by employee.sort_order, employee.full_name, employee.id
$$;

revoke all on function public.get_my_profile_v2() from public, anon;
revoke all on function public.get_schedule_directory_v2() from public, anon;
revoke all on function public.get_employee_admin_directory_v2() from public, anon;
grant execute on function public.get_my_profile_v2() to authenticated, service_role;
grant execute on function public.get_schedule_directory_v2() to authenticated, service_role;
grant execute on function public.get_employee_admin_directory_v2() to authenticated, service_role;
'''.strip()

# 1. Database source of truth.
schema_path = "supabase/001_current_schema.sql"
schema = read(schema_path).rstrip()
schema_marker = "-- 人員資料依本人、共同班表與管理用途分流"
if schema_marker not in schema:
    schema += f'''\n\n\nbegin;\n\n{schema_marker}\n{DIRECTORY_FUNCTIONS_SQL}\n\ncommit;\n'''
write(schema_path, schema)

updates_path = "supabase/002_current_updates.sql"
updates = read(updates_path).rstrip()
updates_marker = "區段 22：依頁面用途拆分人員資料 RPC"
if updates_marker not in updates:
    updates += f'''\n\n\n-- ============================================================================================\n-- {updates_marker}\n-- ============================================================================================\n\nbegin;\n\n{DIRECTORY_FUNCTIONS_SQL}\n\ncommit;\n\n\n-- ============================================================================================\n-- 區段 23：移除混合用途的舊人員名錄 RPC\n-- ============================================================================================\n\nbegin;\n\nrevoke all on function public.get_employee_directory_v2() from public, anon, authenticated, service_role;\ndrop function if exists public.get_employee_directory_v2();\n\ncommit;\n'''
write(updates_path, updates)

# 2. Front-end API: identity, shared schedule directory, and manager directory are separate.
web_path = "src/renderer/web-api.js"
web = read(web_path)
web = replace_once(
    web,
    '''  async function getEmployeeDirectoryRows() {\n    return await restRpc("get_employee_directory_v2", {}, { auth: true }) || [];\n  }\n\n  async function getDepartmentDirectoryRows() {''',
    '''  async function getMyProfileRow() {\n    const rows = await restRpc("get_my_profile_v2", {}, { auth: true }) || [];\n    return rows[0] || null;\n  }\n\n  async function getScheduleDirectoryRows() {\n    return await restRpc("get_schedule_directory_v2", {}, { auth: true }) || [];\n  }\n\n  async function getEmployeeAdminDirectoryRows() {\n    ensureManager();\n    return await restRpc("get_employee_admin_directory_v2", {}, { auth: true }) || [];\n  }\n\n  async function getDepartmentDirectoryRows() {''',
    "人員 RPC helper",
)
web = replace_once(
    web,
    '''  async function fetchProfile(userId) {\n    const rows = await getEmployeeDirectoryRows();\n    return rows.find((row) => row.id === userId) || null;\n  }''',
    '''  async function fetchProfile(userId) {\n    const profile = await getMyProfileRow();\n    return profile?.id === userId ? profile : null;\n  }''',
    "本人 profile 查詢",
)
old_load = '''      const [\n        settingsRows,\n        departmentRows,\n        profileRows,\n        shiftRows,\n        leaveRows,\n        overtimeRows,\n        holidayRows\n      ] = await Promise.all([\n        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),\n        getDepartmentDirectoryRows(),\n        getEmployeeDirectoryRows(),\n        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),\n        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),\n        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),\n        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })\n      ]);\n\n      const settings = settingsRows?.[0] || {};'''
new_load = '''      const managerAccess = hasManagerAccess(currentProfile?.role);\n      const [\n        settingsRows,\n        departmentRows,\n        scheduleProfileRows,\n        adminProfileRows,\n        shiftRows,\n        leaveRows,\n        overtimeRows,\n        holidayRows\n      ] = await Promise.all([\n        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),\n        getDepartmentDirectoryRows(),\n        getScheduleDirectoryRows(),\n        managerAccess ? getEmployeeAdminDirectoryRows() : Promise.resolve([]),\n        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),\n        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),\n        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),\n        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })\n      ]);\n\n      const adminProfilesById = new Map((adminProfileRows || []).map((row) => [row.id, row]));\n      const profileRows = (scheduleProfileRows || []).map((row) => ({\n        ...(adminProfilesById.get(row.id) || {}),\n        ...row\n      }));\n      const settings = settingsRows?.[0] || {};'''
web = replace_once(web, old_load, new_load, "loadState 人員來源")
web = web.replace("getEmployeeDirectoryRows()", "getEmployeeAdminDirectoryRows()")
if "get_employee_directory_v2" in web or "getEmployeeDirectoryRows" in web:
    raise RuntimeError("web-api.js 仍引用舊人員名錄")
write(web_path, web)

# 3. Resolve current user by immutable id; employee schedule rows no longer need fake employee codes.
renderer_path = "src/renderer/renderer.js"
renderer = read(renderer_path)
renderer = replace_once(
    renderer,
    '    code: member?.code || `M${String(fallbackIndex + 1).padStart(3, "0")}`,',
    '    code: member?.code || "",',
    "人員工號預設值",
)
renderer = replace_once(
    renderer,
    '''function resolveCurrentMember() {\n  if (!currentProfile?.employee_code) {\n    return null;\n  }\n  return state.members.find((member) => member.code === currentProfile.employee_code) || null;\n}''',
    '''function resolveCurrentMember() {\n  if (currentProfile?.id) {\n    const byId = state.members.find((member) => member.id === currentProfile.id);\n    if (byId) return byId;\n  }\n  if (!currentProfile?.employee_code) return null;\n  return state.members.find((member) => member.code === currentProfile.employee_code) || null;\n}''',
    "目前登入人員解析",
)
write(renderer_path, renderer)

# 4. Remove fetch interception patches; the correct RPC now defines the boundary.
v2_path = "src/renderer/v2-api.js"
v2 = read(v2_path)
start_marker = "  function stripAttendanceFields(value) {"
end_marker = "  api.getEmployeeOvertimeDates ="
start = v2.find(start_marker)
end = v2.find(end_marker)
if start < 0 or end < 0 or end <= start:
    if "safeDepartmentColumns" in v2 or "runManagerSafeWrite" in v2:
        raise RuntimeError("找不到 v2-api 權限補丁區段")
else:
    replacement = '''  const originalLoadState = api.loadState;\n  api.loadState = async function loadV2State() {\n    const state = await originalLoadState();\n\n    if (api.getAuthContext?.().profile?.role === "admin") {\n      const result = await callFunction("department-attendance-v2", {});\n      const byDepartment = new Map((result.settings || []).map((row) => [row.departmentId, row]));\n      state.departments = (state.departments || []).map((department) => {\n        const settings = byDepartment.get(department.id);\n        return settings ? {\n          ...department,\n          address: settings.address || "",\n          latitude: settings.latitude ?? "",\n          longitude: settings.longitude ?? "",\n          publicIp: settings.publicIp || "",\n          attendanceEnabled: Boolean(settings.attendanceEnabled)\n        } : department;\n      });\n    }\n\n    if (api.getAuthContext?.().session?.access_token) {\n      try {\n        const result = await callFunction("member-order-v2", { action: "list" });\n        state.members = applyMemberOrder(state.members, result.memberIds);\n      } catch {\n        // Keep database sort order until member-order-v2 is available.\n      }\n    }\n    return state;\n  };\n\n'''
    v2 = v2[:start] + replacement + v2[end:]
if "safeDepartmentColumns" in v2 or "runManagerSafeWrite" in v2 or "managerSafeFetch" in v2:
    raise RuntimeError("v2-api.js 仍保留 fetch 攔截權限補丁")
write(v2_path, v2)

# 5. Repository checks.
normalized_path = "scripts/check-normalized-storage.js"
normalized = read(normalized_path)
normalized = replace_once(
    normalized,
    '''assert(webApi.includes('restRpc("get_department_directory_v2"'), "loadState should use the safe department directory RPC");\nassert(webApi.includes('restRpc("get_employee_directory_v2"'), "loadState should use the safe employee directory RPC");''',
    '''assert(webApi.includes('restRpc("get_department_directory_v2"'), "loadState should use the safe department directory RPC");\nassert(webApi.includes('restRpc("get_my_profile_v2"'), "auth should use the self profile RPC");\nassert(webApi.includes('restRpc("get_schedule_directory_v2"'), "schedule should use the shared operational directory RPC");\nassert(webApi.includes('restRpc("get_employee_admin_directory_v2"'), "member settings should use the manager directory RPC");\nassert(!webApi.includes("get_employee_directory_v2"), "web api should not use the retired mixed-purpose employee directory RPC");''',
    "normalized RPC assertions",
)
normalized = replace_once(
    normalized,
    'assert(schema.includes("create or replace function public.is_admin(p_user_id uuid)"), "schema should expose an admin helper");',
    'assert(schema.includes("create or replace function public.is_admin(p_user_id uuid)"), "schema should expose an admin helper");\nassert(schema.includes("create or replace function public.get_my_profile_v2()") && schema.includes("create or replace function public.get_schedule_directory_v2()") && schema.includes("create or replace function public.get_employee_admin_directory_v2()"), "current schema should create separated employee data RPCs");',
    "schema directory assertions",
)
write(normalized_path, normalized)

final_path = "scripts/check-v2-final.js"
final = read(final_path)
final = replace_once(
    final,
    'assert(hardenedAccess.includes("get_employee_directory_v2"), "缺少安全人員名錄 RPC");',
    'assert(hardenedAccess.includes("get_my_profile_v2") && hardenedAccess.includes("get_schedule_directory_v2") && hardenedAccess.includes("get_employee_admin_directory_v2"), "缺少分用途人員資料 RPC");\nassert(hardenedAccess.includes("drop function if exists public.get_employee_directory_v2"), "混合用途舊人員名錄 RPC 尚未移除");',
    "V2 backend directory assertions",
)
final = replace_once(
    final,
    'assert(sourceApi.includes("safeDepartmentColumns"), "一般單位查詢仍可能包含敏感打卡欄位");',
    'assert(!sourceApi.includes("safeDepartmentColumns") && !sourceApi.includes("runManagerSafeWrite") && !sourceApi.includes("managerSafeFetch"), "前端仍使用攔截 fetch 的補丁式權限控制");',
    "V2 fetch interception assertion",
)
final = replace_once(
    final,
    'assert(sourceWebApi.includes("get_employee_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未改用安全名錄 RPC");',
    'assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未依用途使用安全名錄 RPC");\nassert(!sourceWebApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊人員名錄 RPC");',
    "V2 frontend directory assertions",
)
old_schedule_assertions = '''const scheduleDirectorySql = databaseUpdates.slice(databaseUpdates.lastIndexOf("區段 21：所有角色使用相同班表人員有效期間"));\nassert(scheduleDirectorySql.includes("target.hire_date,") && !scheduleDirectorySql.includes("then target.hire_date else null"), "所有角色班表名錄一致性缺失：到職日仍依角色遮罩");\nassert(scheduleDirectorySql.includes("target.leave_date,") && !scheduleDirectorySql.includes("then target.leave_date else null"), "所有角色班表名錄一致性缺失：離職日仍依角色遮罩");\nassert(scheduleDirectorySql.includes("target.pay_by_day,") && scheduleDirectorySql.includes("target.schedule_shift_ids,"), "所有角色班表名錄一致性缺失：班表必要人員屬性仍依角色不同");'''
new_schedule_assertions = '''const scheduleDirectorySql = databaseUpdates.slice(databaseUpdates.lastIndexOf("區段 22：依頁面用途拆分人員資料 RPC"));\nassert(scheduleDirectorySql.includes("get_my_profile_v2") && scheduleDirectorySql.includes("get_schedule_directory_v2") && scheduleDirectorySql.includes("get_employee_admin_directory_v2"), "人員資料用途分流 migration 缺失");\nassert(scheduleDirectorySql.includes("employee.hire_date") && scheduleDirectorySql.includes("employee.leave_date") && scheduleDirectorySql.includes("employee.pay_by_day"), "共同班表名錄缺少一致顯示欄位");\nassert(!scheduleDirectorySql.includes("case when actor.manager_access or employee.id = actor.id then employee.hire_date"), "共同班表名錄仍依角色遮罩顯示欄位");'''
final = replace_once(final, old_schedule_assertions, new_schedule_assertions, "班表名錄一致性 assertions")
final = replace_once(
    final,
    'assert(authoritativeSpec.includes("固定 IP、原始 GPS、精準度與距離只供管理員及後端服務使用"), "正式規格書缺少敏感打卡資料規則");',
    'assert(authoritativeSpec.includes("單位打卡設定中的地址、座標與固定對外 IP") && authoritativeSpec.includes("個別打卡紀錄的原始 GPS"), "正式規格書未區分打卡設定與個人定位稽核資料");',
    "打卡資料分類規格 assertion",
)
final = replace_once(
    final,
    'assert(authoritativeSpec.includes("員工、主管與管理員看到的人員列") && authoritativeSpec.includes("角色差異只影響編輯工具"), "正式規格書缺少所有角色班表一致規則");',
    'assert(authoritativeSpec.includes("員工、主管與管理員看到的人員列") && authoritativeSpec.includes("角色差異只影響編輯工具"), "正式規格書缺少所有角色班表一致規則");\nassert(authoritativeSpec.includes("get_my_profile_v2") && authoritativeSpec.includes("get_schedule_directory_v2") && authoritativeSpec.includes("get_employee_admin_directory_v2"), "正式規格書缺少人員資料用途分流");\nassert(authoritativeSpec.includes("頁面與資料權限矩陣"), "正式規格書缺少跨頁面權限矩陣");',
    "規格人員 RPC assertion",
)
write(final_path, final)

# 6. Documentation.
spec_path = "規格書.md"
spec = read(spec_path)
spec = replace_once(
    spec,
    '12. 安全人員名錄必須向所有有效登入者提供班表顯示必要的到職日、離職日、日薪狀態及可排班班別；工號、角色與管理專用欄位仍依權限遮罩。',
    '12. 班表共同名錄必須向所有有效登入者提供完全相同的班表顯示必要欄位：人員 ID、姓名、所屬單位、到職日、離職日、日薪狀態、啟用狀態與排序。工號、角色、固定休假、休假目標、支援單位與可排班班別屬管理用途，改由管理名錄提供。',
    "班表共同名錄規格",
)
old_security = '''4. 固定 IP、原始 GPS、精準度與距離只供管理員及後端服務使用。\n5. 一般員工與主管只取得執行功能所需的最少資料。\n6. 寫入操作使用 RLS、Edge Function、RPC 或 Service Role 的適當組合。\n7. 任何前端隱藏按鈕都不是唯一權限控制。'''
new_security = '''4. 單位打卡設定中的地址、座標與固定對外 IP 是公司設定資料，不視為密碼或秘密金鑰；但只有實際需要顯示單位打卡設定頁的管理員才讀取，其他頁面不重複載入。\n5. 個別打卡紀錄的原始 GPS、來源 IP、定位精準度、距離與完整稽核快照屬個人行為與稽核資料，只提供管理員及後端服務。\n6. 一般員工、主管與管理員依目前功能取得最少但完整的資料；不得因過度遮罩使同一功能在不同角色下產生不同結果。\n7. 寫入操作使用 RLS、Edge Function、RPC 或 Service Role 的適當組合。\n8. 任何前端隱藏按鈕都不是唯一權限控制。\n\n### 5.4.1 頁面與資料權限矩陣\n\n| 功能 | 員工 | 主管 | 管理員 | 正式資料介面 |\n|---|---|---|---|---|\n| 登入、首頁、修改自己的密碼 | 本人 | 本人 | 本人 | `get_my_profile_v2()` 與 Supabase Auth |\n| 班表查看 | 查看全體相同班表 | 同員工 | 同員工 | `get_schedule_directory_v2()`、`schedule_entries` |\n| 班表編輯、排班工具、一般設定 | 不可 | 可 | 可 | 管理名錄、RLS 與班表 RPC |\n| 打卡與打卡加班申請 | 僅本人 | 僅本人 | 僅本人 | 打卡及加班 Edge Functions |\n| 今日訂餐 | 僅本人 | 僅本人 | 僅本人 | `meal-order` |\n| 訂餐統計與訂餐設定 | 不可 | 可 | 可 | 訂餐管理 Edge Functions |\n| 個人記錄 | 僅本人 | 僅本人 | 僅本人 | `personal-records-v2` |\n| 加班審核 | 不可 | 不可 | 可 | 加班管理 Edge Functions |\n| 打卡管理與完整稽核 | 不可 | 不可 | 可 | 打卡管理 Edge Functions |\n| 人員設定與一般帳號管理 | 不可 | 可，不能管理管理員角色 | 可 | `get_employee_admin_directory_v2()`、`member-auth-admin` |\n| 單位一般設定 | 不可 | 可 | 可 | 單位安全名錄與 RLS |\n| 單位打卡地址、座標、固定 IP 與啟用狀態 | 不可 | 不可修改且不需載入 | 可 | `department-attendance-v2` |\n\n同一頁面同一功能的讀取結果，不得因角色而使用不同欄位推測；角色差異只用於是否能進入管理功能、是否能操作及後端是否接受寫入。'''
spec = replace_once(spec, old_security, new_security, "共用權限與安全規格")
spec = replace_once(
    spec,
    '''### 5.5.2 主要 RPC\n\n- `save_schedule_entries_bulk(entries jsonb)`：批次保存班表格。''',
    '''### 5.5.2 主要 RPC\n\n- `get_my_profile_v2()`：只回傳目前登入者本人的完整登入與任職資料，供登入驗證、首頁及本人功能使用。\n- `get_schedule_directory_v2()`：回傳所有有效登入者共同使用的班表顯示名錄；所有角色欄位與排序一致。\n- `get_employee_admin_directory_v2()`：只允許主管與管理員取得人員設定、帳號管理及自動排班所需欄位。\n- `get_department_directory_v2()`：回傳所有有效登入者可使用的一般單位名錄，不含打卡管理設定。\n- `save_schedule_entries_bulk(entries jsonb)`：批次保存班表格。''',
    "主要 RPC 規格",
)
spec = replace_once(
    spec,
    '''### 5.6.3 一般名錄與敏感欄位\n\n1. 人員與單位的一般名錄資料應透過受控安全 RPC 或後端 API 取得，不直接向瀏覽器開放私密主表的完整欄位。\n2. 固定對外 IP、原始 GPS、定位精準度、距離、管理稽核資料及其他敏感欄位，不得透過一般 REST 查詢提供給員工或主管。\n3. Edge Function 或正式後端回傳資料前必須依角色過濾欄位，只提供執行目前功能所需的最少資料。''',
    '''### 5.6.3 一般名錄與敏感欄位\n\n1. 人員資料不得再由單一混合用途 RPC 同時負責登入、班表與管理；必須分為本人資料、共同班表名錄與管理名錄。\n2. 班表共同名錄是公司內部共同作業資料，所有有效登入者取得相同的姓名、單位、任職有效區間、PT 狀態與排序。\n3. 本人工號、本人角色與本人任職資料由 `get_my_profile_v2()` 提供；其他人員的工號、角色、休假規則、支援順序與可排班班別只由 `get_employee_admin_directory_v2()` 提供給主管或管理員。\n4. 單位地址、座標與固定對外 IP 屬打卡設定，不是秘密金鑰；但一般頁面沒有使用需求，因此只在管理員進入打卡設定功能時透過 `department-attendance-v2` 讀取。\n5. 個別打卡紀錄的原始 GPS、來源 IP、精準度、距離、管理稽核資料及完整快照不得透過一般名錄或一般 REST 查詢提供。\n6. 前端不得以攔截 `fetch`、刪除 JSON 欄位或依載入順序覆寫函式作為主要權限邊界；資料介面本身必須只回傳該用途需要的欄位。''',
    "一般名錄與敏感欄位規格",
)
write(spec_path, spec)

readme_path = "README.md"
readme = read(readme_path)
readme = replace_once(
    readme,
    '- PostgreSQL、RLS 與 RPC 負責正式資料、權限與交易一致性。',
    '- PostgreSQL、RLS 與 RPC 負責正式資料、權限與交易一致性。\n- 人員資料查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表及管理頁面。',
    "README 人員 RPC 架構",
)
write(readme_path, readme)

agents_path = "AGENTS.md"
agents = read(agents_path)
agents = replace_once(
    agents,
    '7. SQL Editor 出現錯誤時立即停止，不可跳過後續區段。',
    '7. 人員資料介面依用途固定分為本人資料、共同班表名錄與管理名錄；新增頁面時不得直接讀取 `set_employee`，也不得把管理名錄拿給一般頁面使用。\n8. 權限控制必須由 RPC、RLS 或 Edge Function 明確實作，不得以攔截 `fetch`、前端刪除欄位或後載入覆寫作為主要安全邊界。\n9. SQL Editor 出現錯誤時立即停止，不可跳過後續區段。',
    "AGENTS Supabase 人員資料規則",
)
agents = replace_once(
    agents,
    '''涉及 Supabase 資料庫結構、RPC 或部署方式時，至少檢查：''',
    '''涉及登入身分、人員名錄或跨頁面權限時，至少檢查：\n\n- `supabase/001_current_schema.sql`\n- `supabase/002_current_updates.sql`\n- `src/renderer/web-api.js`\n- `src/renderer/v2-api.js`\n- 各頁使用的 Edge Function 權限檢查\n- `規格書.md` 第 5.4.1 節權限矩陣\n\n涉及 Supabase 資料庫結構、RPC 或部署方式時，至少檢查：''',
    "AGENTS 權限檢查清單",
)
write(agents_path, agents)

print("directory RPC refactor prepared")
