from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"找不到替換位置：{label}")
    return text.replace(old, new, 1)


def replace_all_functions(text, name, replacement):
    pattern = re.compile(
        rf"create or replace function public\.{re.escape(name)}\s*\(.*?\n\$\$;",
        re.S | re.I,
    )
    matches = list(pattern.finditer(text))
    if not matches:
        raise RuntimeError(f"找不到函式：{name}")
    return pattern.sub(replacement.strip(), text)


def extract_last_function(text, name):
    pattern = re.compile(
        rf"create or replace function public\.{re.escape(name)}\s*\(.*?\n\$\$;",
        re.S | re.I,
    )
    matches = list(pattern.finditer(text))
    if not matches:
        raise RuntimeError(f"找不到函式：{name}")
    return matches[-1].group(0).strip()


EMPLOYED_HELPER = r'''
create or replace function public.is_employee_employed_on(
  p_hire_date date,
  p_leave_date date,
  p_date date
)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select p_date is not null
    and (p_hire_date is null or p_hire_date <= p_date)
    and (p_leave_date is null or p_date <= p_leave_date)
$$;
'''

ACCOUNT_HELPER = r'''
create or replace function public.is_employee_account_effective(
  p_hire_date date,
  p_leave_date date,
  p_date date
)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select p_date is not null
    and (p_hire_date is null or p_hire_date <= p_date)
    and (p_leave_date is null or p_date <= p_leave_date + 5)
$$;
'''

IS_EFFECTIVE_USER = r'''
create or replace function public.is_effective_user(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from public.set_employee employee
    where employee.id = p_user_id
      and public.is_employee_account_effective(
        employee.hire_date,
        employee.leave_date,
        (timezone('Asia/Taipei', now()))::date
      )
  )
$$;
'''

IS_MANAGER = r'''
create or replace function public.is_manager(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from public.set_employee employee
    where employee.id = p_user_id
      and employee.role in ('admin', 'manager')
      and public.is_employee_account_effective(
        employee.hire_date,
        employee.leave_date,
        (timezone('Asia/Taipei', now()))::date
      )
  )
$$;
'''

IS_ADMIN = r'''
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from public.set_employee employee
    where employee.id = p_user_id
      and employee.role = 'admin'
      and public.is_employee_account_effective(
        employee.hire_date,
        employee.leave_date,
        (timezone('Asia/Taipei', now()))::date
      )
  )
$$;
'''

IS_EFFECTIVE_ADMIN_ROW = r'''
create or replace function public.is_effective_admin_row(
  p_role text,
  p_hire_date date,
  p_leave_date date
)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce(p_role, '') = 'admin'
    and public.is_employee_account_effective(
      p_hire_date,
      p_leave_date,
      (timezone('Asia/Taipei', now()))::date
    )
$$;
'''

PROTECT_ADMIN = r'''
create or replace function public.protect_admin_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_today date := (timezone('Asia/Taipei', now()))::date;
  v_old_effective boolean;
  v_new_effective boolean;
  v_changed_admin_row boolean;
begin
  if TG_OP = 'INSERT' then
    if auth.uid() is not null and NEW.role <> 'employee' and not public.is_admin(auth.uid()) then
      raise exception '只有管理員可以新增主管或管理員帳號' using errcode = '42501';
    end if;
    return NEW;
  end if;

  v_old_effective := OLD.role = 'admin'
    and public.is_employee_account_effective(OLD.hire_date, OLD.leave_date, v_today);

  if TG_OP = 'UPDATE' then
    v_new_effective := NEW.role = 'admin'
      and public.is_employee_account_effective(NEW.hire_date, NEW.leave_date, v_today);
    v_changed_admin_row := OLD.role = 'admin' and (
      NEW.employee_code is distinct from OLD.employee_code
      or NEW.full_name is distinct from OLD.full_name
      or NEW.role is distinct from OLD.role
      or NEW.home_department_id is distinct from OLD.home_department_id
      or NEW.schedule_shift_ids is distinct from OLD.schedule_shift_ids
      or NEW.hire_date is distinct from OLD.hire_date
      or NEW.leave_date is distinct from OLD.leave_date
      or NEW.pay_by_day is distinct from OLD.pay_by_day
      or NEW.fixed_rest_weekday is distinct from OLD.fixed_rest_weekday
      or NEW.monthly_rest_days is distinct from OLD.monthly_rest_days
    );
  else
    v_new_effective := false;
    v_changed_admin_row := OLD.role = 'admin';
  end if;

  if TG_OP = 'UPDATE'
    and auth.uid() is not null
    and NEW.role is distinct from OLD.role
    and not public.is_admin(auth.uid()) then
    raise exception '只有管理員可以變更帳號權限' using errcode = '42501';
  end if;

  if auth.uid() is not null
    and (v_changed_admin_row or (TG_OP = 'UPDATE' and NEW.role = 'admin'))
    and not public.is_admin(auth.uid()) then
    raise exception '只有管理員可以修改管理員帳號' using errcode = '42501';
  end if;

  if v_old_effective and not v_new_effective and not exists (
    select 1
    from public.set_employee employee
    where employee.id <> OLD.id
      and employee.role = 'admin'
      and public.is_employee_account_effective(employee.hire_date, employee.leave_date, v_today)
  ) then
    raise exception '至少需保留一位有效管理員' using errcode = '23514';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;
'''

PROTECT_LAST_ADMIN = r'''
create or replace function public.protect_last_effective_admin_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old_effective boolean;
  v_new_effective boolean := false;
  v_other_effective_admins integer;
begin
  v_old_effective := public.is_effective_admin_row(
    old.role,
    old.hire_date,
    old.leave_date
  );

  if not v_old_effective then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    v_new_effective := public.is_effective_admin_row(
      new.role,
      new.hire_date,
      new.leave_date
    );

    if v_new_effective
      and new.leave_date is null
      and (new.hire_date is null or new.hire_date <= (timezone('Asia/Taipei', now()))::date) then
      return new;
    end if;
  end if;

  select count(*) into v_other_effective_admins
  from public.set_employee employee
  where employee.id <> old.id
    and public.is_effective_admin_row(
      employee.role,
      employee.hire_date,
      employee.leave_date
    );

  if v_other_effective_admins = 0 then
    raise exception '系統必須保留至少一個有效管理員；最後一位管理員不可刪除、降級、設定未來到職日或離職日'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
'''

MY_PROFILE = r'''
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
'''

SCHEDULE_DIRECTORY = r'''
create or replace function public.get_schedule_directory_v2()
returns table (
  id uuid,
  full_name text,
  home_department_id uuid,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
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
    employee.sort_order
  from actor
  cross join public.set_employee employee
  where actor.effective
  order by employee.sort_order, employee.full_name, employee.id
$$;
'''

ADMIN_DIRECTORY = r'''
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
  order by employee.sort_order, employee.full_name, employee.id
$$;
'''

LEGACY_DIRECTORY = r'''
create or replace function public.get_employee_directory_v2()
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
    select
      employee.id,
      employee.role in ('admin', 'manager') as manager_access,
      public.is_effective_user(employee.id) as effective
    from public.set_employee employee
    where employee.id = auth.uid()
  )
  select
    target.id,
    case when actor.manager_access or target.id = actor.id then target.employee_code else '' end,
    target.full_name,
    case when actor.manager_access or target.id = actor.id then target.role else 'employee' end,
    target.home_department_id,
    case when actor.manager_access or target.id = actor.id then target.position_name else null end,
    target.hire_date,
    target.leave_date,
    target.pay_by_day,
    target.created_at,
    target.updated_at,
    case when actor.manager_access or target.id = actor.id then target.schedule_department_ids else '{}'::text[] end,
    case when actor.manager_access or target.id = actor.id then target.monthly_rest_days else 0 end,
    case when actor.manager_access or target.id = actor.id then target.fixed_rest_weekday else 0 end,
    target.schedule_shift_ids,
    target.sort_order
  from actor
  join public.set_employee target
    on target.id = actor.id or actor.effective
  order by target.sort_order, target.full_name, target.id
$$;
'''


def clean_edge_functions():
    for path in (ROOT / "supabase" / "functions").glob("*/index.ts"):
        text = path.read_text(encoding="utf-8")
        original = text

        def clean_select(match):
            fields = match.group(1)
            if "is_active" not in fields or "hire_date" not in fields or "leave_date" not in fields:
                return match.group(0)
            cleaned = ",".join(part for part in fields.split(",") if part.strip() != "is_active")
            return f'.select("{cleaned}")'

        text = re.sub(r'\.select\("([^"]*)"\)', clean_select, text)
        text = re.sub(
            r'Boolean\(\s*profile\?\.is_active(?:\s*!==\s*false)?\s*&&\s*',
            'Boolean(',
            text,
        )
        text = text.replace('profile.data.role !== "admin" || !profile.data.is_active || ', 'profile.data.role !== "admin" || ')
        text = text.replace('!profile.data.is_active || ', '')
        text = text.replace('!profile?.is_active || ', '')
        text = text.replace('\n    .eq("is_active", true)', '')

        if path.parent.name in {"member-auth-admin", "member-auth-admin-v2"}:
            text = re.sub(r'^\s*is_active:\s*true,?\s*\n', '', text, flags=re.M)

        if text != original:
            path.write_text(text, encoding="utf-8")


clean_edge_functions()

# 前端不再依賴人員啟用欄位。
web_api_path = "src/renderer/web-api.js"
web_api = read(web_api_path)
web_api = web_api.replace(
    "if (!profile?.is_active || (profile.hire_date && today < profile.hire_date) || (effectiveEndDate && today > effectiveEndDate)) {",
    "if ((profile.hire_date && today < profile.hire_date) || (effectiveEndDate && today > effectiveEndDate)) {",
)
web_api = re.sub(r"\n\s*is_active:\s*true,?", "", web_api)
write(web_api_path, web_api)

# 清理 001 現行結構。
schema_path = "supabase/001_current_schema.sql"
schema = read(schema_path)
schema = replace_once(schema, "  is_active boolean not null default true,\n", "", "set_employee.is_active")
schema = schema.replace("create index if not exists idx_set_employee_active_code on public.set_employee (is_active, employee_code);\n", "")
schema = schema.replace("      and e.is_active = true\n", "")
schema = schema.replace("    and OLD.is_active is true\n", "")
schema = schema.replace("      and NEW.is_active is true\n", "")
schema = schema.replace("      or NEW.is_active is distinct from OLD.is_active\n", "")
schema = schema.replace("    or v_employee.is_active is not true\n", "")

# 共用有效期函式插在權限函式之前。
marker = "create or replace function public.is_manager(p_user_id uuid)"
if "create or replace function public.is_employee_employed_on(" not in schema:
    schema = schema.replace(marker, EMPLOYED_HELPER.strip() + "\n\n" + ACCOUNT_HELPER.strip() + "\n\n" + IS_EFFECTIVE_USER.strip() + "\n\n" + marker, 1)

schema = replace_all_functions(schema, "is_manager", IS_MANAGER)
schema = replace_all_functions(schema, "is_admin", IS_ADMIN)
schema = replace_all_functions(schema, "protect_admin_member", PROTECT_ADMIN)
schema = replace_all_functions(schema, "get_my_profile_v2", MY_PROFILE)
schema = replace_all_functions(schema, "get_schedule_directory_v2", SCHEDULE_DIRECTORY)
schema = replace_all_functions(schema, "get_employee_admin_directory_v2", ADMIN_DIRECTORY)

# 移除已無意義的直接停用保護。
schema = re.sub(
    r"\ncreate or replace function public\.block_direct_member_deactivation_v2\(\).*?for each row execute function public\.block_direct_member_deactivation_v2\(\);\n",
    "\n",
    schema,
    flags=re.S,
)
schema = schema.replace("revoke all on function public.block_direct_member_deactivation_v2() from public, anon, authenticated;\n", "")

schema_cleanup = r'''

-- 人員任職狀態只由到職日與離職日判斷，不另設停用欄位。
begin;

drop trigger if exists block_direct_member_deactivation_v2 on public.set_employee;
drop function if exists public.block_direct_member_deactivation_v2();
drop index if exists public.idx_set_employee_active_code;
alter table public.set_employee drop column if exists is_active;

revoke all on function public.is_employee_employed_on(date, date, date) from public, anon;
revoke all on function public.is_employee_account_effective(date, date, date) from public, anon;
grant execute on function public.is_employee_employed_on(date, date, date) to authenticated, service_role;
grant execute on function public.is_employee_account_effective(date, date, date) to authenticated, service_role;

commit;
'''
if "人員任職狀態只由到職日與離職日判斷" not in schema:
    schema = schema.rstrip() + schema_cleanup
write(schema_path, schema)

# 清理 002 更新檔所有歷史區段，確保新資料庫可從頭完整執行。
updates_path = "supabase/002_current_updates.sql"
updates = read(updates_path)
updates = updates.replace("      and e.is_active = true\n", "")
updates = updates.replace("    or v_employee.is_active is not true\n", "")
updates = updates.replace("    and is_active = true\n", "")

# 舊版刪除區段改為明確阻擋，不再軟停用。
updates = re.sub(
    r"  if v_has_history then\n\s*update public\.set_employee\n\s*set is_active = false\n\s*where id = p_target_id;\n\n\s*return jsonb_build_object\(.*?\n\s*end if;",
    "  if v_has_history then\n    return jsonb_build_object(\n      'ok', false,\n      'deleted', false,\n      'softDeleted', false,\n      'blocked', true,\n      'code', 'MEMBER_HAS_HISTORY',\n      'message', '已有歷史資料，無法刪除；離職人員請填寫離職日'\n    );\n  end if;",
    updates,
    flags=re.S,
)

updates = replace_all_functions(updates, "is_effective_admin_row", IS_EFFECTIVE_ADMIN_ROW)
updates = replace_all_functions(updates, "protect_last_effective_admin_v2", PROTECT_LAST_ADMIN)
updates = replace_all_functions(updates, "get_employee_directory_v2", LEGACY_DIRECTORY)
updates = replace_all_functions(updates, "get_my_profile_v2", MY_PROFILE)
updates = replace_all_functions(updates, "get_schedule_directory_v2", SCHEDULE_DIRECTORY)
updates = replace_all_functions(updates, "get_employee_admin_directory_v2", ADMIN_DIRECTORY)

# 舊版授權簽章同步改為新 helper 簽章。
updates = updates.replace("public.is_effective_admin_row(text, boolean, date, date)", "public.is_effective_admin_row(text, date, date)")
updates = updates.replace("alter function public.is_effective_admin_row(text, date, date) set search_path = public, pg_catalog;", "")

# 移除停用 trigger 區段。
updates = re.sub(
    r"\ncreate or replace function public\.block_direct_member_deactivation_v2\(\).*?for each row execute function public\.block_direct_member_deactivation_v2\(\);\n",
    "\n",
    updates,
    flags=re.S,
)
updates = updates.replace("revoke all on function public.block_direct_member_deactivation_v2() from public, anon, authenticated;\n", "")

# 在舊混合 RPC 首次建立前先移除舊回傳型別，避免重跑時 create or replace 失敗。
updates = updates.replace(
    "create or replace function public.get_employee_directory_v2()\nreturns table (",
    "drop function if exists public.get_employee_directory_v2();\n\ncreate or replace function public.get_employee_directory_v2()\nreturns table (",
    1,
)
updates = updates.replace(
    "create or replace function public.get_my_profile_v2()\nreturns table (",
    "drop function if exists public.get_my_profile_v2();\ndrop function if exists public.get_schedule_directory_v2();\ndrop function if exists public.get_employee_admin_directory_v2();\n\ncreate or replace function public.get_my_profile_v2()\nreturns table (",
    1,
)

# 抽取已清理的正式交易函式，放進最終 migration 供正式環境直接套用。
attendance_clock = extract_last_function(updates, "save_attendance_clock")
meal_order = extract_last_function(updates, "save_meal_order")
admin_review = extract_last_function(updates, "admin_review_overtime_requests_v2")

final_marker = "區段 26：移除人員 is_active，任職狀態統一由日期判斷"
if final_marker not in updates:
    final_section = f'''


-- ============================================================================================
-- {final_marker}
-- ============================================================================================

begin;

drop trigger if exists block_direct_member_deactivation_v2 on public.set_employee;
drop function if exists public.block_direct_member_deactivation_v2();

drop trigger if exists trg_protect_last_effective_admin_v2 on public.set_employee;
drop function if exists public.protect_last_effective_admin_v2();
drop function if exists public.is_effective_admin_row(text, boolean, date, date);
drop function if exists public.is_effective_admin_row(text, date, date);

drop function if exists public.get_employee_directory_v2();
drop function if exists public.get_my_profile_v2();
drop function if exists public.get_schedule_directory_v2();
drop function if exists public.get_employee_admin_directory_v2();

{EMPLOYED_HELPER.strip()}

{ACCOUNT_HELPER.strip()}

{IS_EFFECTIVE_USER.strip()}

{IS_MANAGER.strip()}

{IS_ADMIN.strip()}

{IS_EFFECTIVE_ADMIN_ROW.strip()}

{PROTECT_ADMIN.strip()}

{PROTECT_LAST_ADMIN.strip()}

drop trigger if exists protect_admin_member_trigger on public.set_employee;
create trigger protect_admin_member_trigger
before update or delete on public.set_employee
for each row execute function public.protect_admin_member();

drop trigger if exists trg_protect_last_effective_admin_v2 on public.set_employee;
create trigger trg_protect_last_effective_admin_v2
before update or delete on public.set_employee
for each row execute function public.protect_last_effective_admin_v2();

{MY_PROFILE.strip()}

{SCHEDULE_DIRECTORY.strip()}

{ADMIN_DIRECTORY.strip()}

{attendance_clock}

{meal_order}

{admin_review}

drop index if exists public.idx_set_employee_active_code;
alter table public.set_employee drop column if exists is_active;

revoke all on function public.is_employee_employed_on(date, date, date) from public, anon;
revoke all on function public.is_employee_account_effective(date, date, date) from public, anon;
revoke all on function public.get_my_profile_v2() from public, anon;
revoke all on function public.get_schedule_directory_v2() from public, anon;
revoke all on function public.get_employee_admin_directory_v2() from public, anon;
grant execute on function public.is_employee_employed_on(date, date, date) to authenticated, service_role;
grant execute on function public.is_employee_account_effective(date, date, date) to authenticated, service_role;
grant execute on function public.get_my_profile_v2() to authenticated, service_role;
grant execute on function public.get_schedule_directory_v2() to authenticated, service_role;
grant execute on function public.get_employee_admin_directory_v2() to authenticated, service_role;

commit;
'''
    updates = updates.rstrip() + final_section
write(updates_path, updates)

# 正式規格同步移除人員停用狀態。
spec_path = "規格書.md"
spec = read(spec_path)
spec = spec.replace(
    "3. 全量儲存或畫面名錄缺少某人員時，不得據此把該人員改為停用；`is_active` 不作為刪除替代狀態。",
    "3. 全量儲存或畫面名錄缺少某人員時，不得據此刪除人員或改變任職狀態；人員表不設停用欄位。",
)
spec = spec.replace(
    "- `is_active`：帳號是否啟用。",
    "- 人員不另設停用狀態；任職與登入資格統一依 `hire_date`、`leave_date` 及離職後五日登入寬限判斷。",
    1,
)
spec = spec.replace(
    "1. 有班表、打卡、打卡異動、加班、審核或訂餐歷史時保留人員歷史，後端拒絕刪除。",
    "1. 有班表、打卡、打卡異動、加班、審核、訂餐或系統設定歷史時保留人員歷史，後端列出各類資料筆數並拒絕刪除；不得改為停用或從管理名錄隱藏。",
)
write(spec_path, spec)

# 防回歸檢查。
check_final_path = "scripts/check-v2-final.js"
check_final = read(check_final_path)
check_final = check_final.replace(
    'assert(databaseUpdates.includes("block_direct_member_deactivation_v2"), "資料庫未阻擋舊前端直接停用人員");',
    'assert(!databaseUpdates.includes("block_direct_member_deactivation_v2"), "人員停用 trigger 尚未移除");\nassert(databaseUpdates.includes("alter table public.set_employee drop column if exists is_active"), "人員 is_active 欄位移除 migration 缺失");\nassert(databaseUpdates.includes("is_employee_account_effective") && databaseUpdates.includes("is_employee_employed_on"), "人員有效期共用函式缺失");',
)
check_final = check_final.replace(
    'assert(!memberAuthAdmin.includes("update({ is_active: false })"), "人員刪除仍會改成停用狀態");',
    'assert(!memberAuthAdmin.includes("is_active"), "人員管理端點仍依賴 is_active");',
)
check_final = check_final.replace(
    'assert(!saveStateSource.includes("is_active: false"), "全量儲存仍可能把未出現在畫面的人員改為停用");',
    'assert(!sourceWebApi.includes("profile?.is_active") && !saveStateSource.includes("is_active:"), "前端仍依賴人員 is_active");',
)
if 'setEmployeeBlock' not in check_final:
    insertion = '''\nconst setEmployeeBlock = currentSchema.slice(currentSchema.indexOf("create table if not exists public.set_employee"), currentSchema.indexOf("create table if not exists public.set_shift"));\nassert(!setEmployeeBlock.includes("is_active"), "set_employee 現行結構仍包含 is_active");\nconst employeeEdgeFiles = [\n  "report-records", "catalog-admin", "attendance-overtime-admin-list", "attendance-overtime-admin-action",\n  "member-auth-admin", "meal-report-v2", "member-order-v2", "personal-records-v2",\n  "attendance-admin-action-v2", "attendance-clock", "meal-order", "member-delete-v2",\n  "meal-cancel-v2", "attendance-admin-list-v2", "attendance-overtime-employee",\n  "department-attendance-v2"\n];\nemployeeEdgeFiles.forEach((name) => {\n  const source = read(`supabase/functions/${name}/index.ts`);\n  assert(!/profile\\?\\.is_active|profile\\.data\\.is_active|select\\(\"[^\"]*is_active[^\"]*hire_date|is_active:\\s*true/.test(source), `${name} 仍依賴人員 is_active`);\n});\n'''
    check_final = check_final.replace('const clockSql = databaseUpdates;', insertion + '\nconst clockSql = databaseUpdates;')
write(check_final_path, check_final)

check_normalized_path = "scripts/check-normalized-storage.js"
check_normalized = read(check_normalized_path)
if 'setEmployeeSchema' not in check_normalized:
    check_normalized = check_normalized.replace(
        'assert(schema.includes("create table if not exists public.set_employee"), "schema should create set_employee");',
        'assert(schema.includes("create table if not exists public.set_employee"), "schema should create set_employee");\nconst setEmployeeSchema = schema.slice(schema.indexOf("create table if not exists public.set_employee"), schema.indexOf("create table if not exists public.set_shift"));\nassert(!setEmployeeSchema.includes("is_active"), "set_employee should not keep an is_active column");',
    )
write(check_normalized_path, check_normalized)

# 移除盤點與一次性流程檔，由工作流程在執行後刪除本腳本。
for relative in [
    "inventory-employee-is-active.txt",
    ".github/workflows/inventory-employee-is-active.yml",
]:
    path = ROOT / relative
    if path.exists():
        path.unlink()

print("employee is_active removal prepared")
