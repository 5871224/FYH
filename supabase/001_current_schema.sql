begin;

create table if not exists public.scheduler_settings (
  id text primary key,
  current_year integer not null default extract(year from now())::integer,
  current_month integer not null default extract(month from now())::integer - 1,
  dept_filter text not null default 'all',
  table_view text not null default 'member',
  table_dept_scope_filter text not null default 'all',
  table_stats_visible boolean not null default false,
  schedule_start_date date,
  week_start integer not null default 0 check (week_start between 0 and 6),
  month_start_day integer not null default 1 check (month_start_day between 1 and 31),
  eight_week_start_date date,
  attendance_common_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.set_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  hidden_from_schedule boolean not null default false,
  address text,
  latitude double precision,
  longitude double precision,
  public_ip text,
  attendance_enabled boolean not null default false,
  attendance_settings_updated_at timestamptz,
  attendance_settings_updated_by uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.set_employee (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  home_department_id uuid references public.set_departments (id) on delete set null,
  schedule_shift_ids uuid[] not null default '{}',
  hire_date date,
  leave_date date,
  pay_by_day boolean not null default false,
  fixed_rest_weekday integer not null default 0 check (fixed_rest_weekday between 0 and 6),
  monthly_rest_days integer not null default 0 check (monthly_rest_days between 0 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);


alter table public.set_departments
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists public_ip text,
  add column if not exists attendance_enabled boolean not null default false,
  add column if not exists attendance_settings_updated_at timestamptz,
  add column if not exists attendance_settings_updated_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.set_departments'::regclass
      and conname = 'set_departments_attendance_settings_updated_by_fkey'
  ) then
    alter table public.set_departments
      add constraint set_departments_attendance_settings_updated_by_fkey
      foreign key (attendance_settings_updated_by)
      references public.set_employee (id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.department_attendance_settings') is not null then
    update public.set_departments d
    set public_ip = s.public_ip
    from public.department_attendance_settings s
    where s.department_id = d.id
      and nullif(btrim(coalesce(s.public_ip, '')), '') is not null;
  end if;
end $$;

drop table if exists public.department_attendance_settings;

create table if not exists public.set_shift (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#7C5CFF',
  text_color text,
  auto_text_color boolean not null default true,
  start_time time,
  end_time time,
  required_staff_count integer not null default 0 check (required_staff_count >= 0),
  applicable_department_id uuid not null references public.set_departments (id) on delete restrict,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.set_leave (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default '#E8EEF8',
  text_color text,
  auto_text_color boolean not null default true,
  requires_time boolean not null default false,
  requires_reason boolean not null default false,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.set_overtime (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#D85A30',
  text_color text,
  auto_text_color boolean not null default true,
  start_time time,
  end_time time,
  use_rest_1 boolean not null default false,
  rest_1_start_time time,
  rest_1_end_time time,
  use_rest_2 boolean not null default false,
  rest_2_start_time time,
  rest_2_end_time time,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.set_employee (id) on delete cascade,
  work_date date not null,
  shift_type_id uuid references public.set_shift (id) on delete set null,
  leave_type_id uuid references public.set_leave (id) on delete set null,
  leave_all_day boolean not null default true,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_type_id uuid references public.set_overtime (id) on delete set null,
  overtime_start_time time,
  overtime_end_time time,
  overtime_use_rest_1 boolean not null default false,
  overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean not null default false,
  overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,
  overtime_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, work_date)
);

create table if not exists public.meal_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_settings (
  id text primary key default 'default',
  daily_cutoff_time time not null default '10:30',
  updated_by uuid references public.set_employee (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid not null references public.set_employee (id) on delete restrict,
  employee_code_snapshot text not null,
  employee_name_snapshot text not null,
  order_date date not null,
  department_id uuid references public.set_departments (id) on delete restrict,
  department_name_snapshot text not null,
  attendance_department_id uuid references public.set_departments (id) on delete restrict,
  product_id uuid references public.meal_products (id) on delete restrict,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) generated always as (quantity * unit_price) stored,
  note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_date, product_id)
);

create index if not exists idx_set_employee_home_department on public.set_employee (home_department_id);
create index if not exists idx_set_departments_attendance_enabled on public.set_departments (attendance_enabled);
create index if not exists idx_schedule_entries_work_date on public.schedule_entries (work_date);
create index if not exists idx_schedule_entries_member_date on public.schedule_entries (member_id, work_date);
create index if not exists idx_meal_products_active_sort on public.meal_products (is_active, sort_order, name);
create index if not exists idx_meal_orders_date_department on public.meal_orders (order_date, department_id);
create index if not exists idx_meal_orders_user_date on public.meal_orders (user_id, order_date desc);
create index if not exists idx_meal_orders_order_id on public.meal_orders (order_id);

alter table public.scheduler_settings enable row level security;
alter table public.set_departments enable row level security;
alter table public.set_employee enable row level security;
alter table public.set_shift enable row level security;
alter table public.set_leave enable row level security;
alter table public.set_overtime enable row level security;
alter table public.holidays enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.meal_products enable row level security;
alter table public.meal_settings enable row level security;
alter table public.meal_orders enable row level security;

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

drop trigger if exists protect_department_attendance_settings_trigger on public.set_departments;
drop policy if exists read_scheduler_settings on public.scheduler_settings;
drop policy if exists write_scheduler_settings on public.scheduler_settings;
drop policy if exists read_set_departments on public.set_departments;
drop policy if exists write_set_departments on public.set_departments;
drop policy if exists read_set_employee on public.set_employee;
drop policy if exists insert_set_employee on public.set_employee;
drop policy if exists update_set_employee on public.set_employee;
drop policy if exists read_set_shift on public.set_shift;
drop policy if exists write_set_shift on public.set_shift;
drop policy if exists read_set_leave on public.set_leave;
drop policy if exists write_set_leave on public.set_leave;
drop policy if exists read_set_overtime on public.set_overtime;
drop policy if exists write_set_overtime on public.set_overtime;
drop policy if exists read_holidays on public.holidays;
drop policy if exists write_holidays on public.holidays;
drop policy if exists read_schedule_entries on public.schedule_entries;
drop policy if exists write_schedule_entries on public.schedule_entries;
drop policy if exists v2_restrict_employee_directory on public.set_employee;
drop policy if exists v2_restrict_schedule_visibility on public.schedule_entries;
drop policy if exists read_meal_products on public.meal_products;
drop policy if exists write_meal_products on public.meal_products;
drop policy if exists read_meal_settings on public.meal_settings;
drop policy if exists write_meal_settings on public.meal_settings;
drop policy if exists read_meal_orders on public.meal_orders;
drop policy if exists write_meal_orders on public.meal_orders;



































drop function if exists public.get_department_attendance_settings();
drop function if exists public.save_department_attendance_settings_bulk(jsonb);



revoke all on function public.save_attendance_clock(uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_attendance_clock(uuid, date, text, jsonb) to service_role;

revoke all on function public.save_meal_order(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_meal_order(uuid, jsonb, text) to service_role;

commit;


begin;

-- 人員資料依本人、共同班表與管理用途分流


commit;


-- ============================================================================================
-- 區段 24：單位安全寫入與班表匯出正式資料
-- ============================================================================================

begin;

create or replace function public.get_schedule_export_rows_v2(
  p_start_date date,
  p_end_date date
)
returns table (
  member_id uuid,
  employee_code text,
  employee_name text,
  home_department_id uuid,
  department_name text,
  pay_by_day boolean,
  work_date date,
  leave_type_id uuid,
  leave_code text,
  leave_name text,
  leave_all_day boolean,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_type_id uuid,
  overtime_name text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_use_rest_1 boolean,
  overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean,
  overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,
  overtime_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception '單次匯出期間不可超過 366 天';
  end if;

  return query
  select
    schedule.member_id,
    employee.employee_code,
    employee.full_name,
    employee.home_department_id,
    department.name,
    employee.pay_by_day,
    schedule.work_date,
    schedule.leave_type_id,
    leave_type.code,
    leave_type.name,
    schedule.leave_all_day,
    schedule.leave_start_time,
    schedule.leave_end_time,
    schedule.leave_reason,
    schedule.overtime_type_id,
    overtime_type.name,
    schedule.overtime_start_time,
    schedule.overtime_end_time,
    schedule.overtime_use_rest_1,
    schedule.overtime_rest_1_start_time,
    schedule.overtime_rest_1_end_time,
    schedule.overtime_use_rest_2,
    schedule.overtime_rest_2_start_time,
    schedule.overtime_rest_2_end_time,
    schedule.overtime_reason
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id = schedule.member_id
  left join public.set_departments department on department.id = employee.home_department_id
  left join public.set_leave leave_type on leave_type.id = schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id = schedule.overtime_type_id
  where schedule.work_date between p_start_date and p_end_date
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date, employee.sort_order, employee.full_name, employee.id;
end;
$$;


revoke all on function public.get_schedule_export_rows_v2(date, date) from public, anon;

grant execute on function public.get_schedule_export_rows_v2(date, date) to authenticated, service_role;

commit;

-- ============================================================================================
-- 人員刪除歷史保護與禁止隱性停用
-- ============================================================================================

begin;


revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;

commit;

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


-- ============================================================================================
-- 每日簽到簿正式結構
-- ============================================================================================

-- 福圓號 Supabase 每日簽到簿正式結構
-- 本區段為全新環境的唯一簽到資料模型，不包含資料遷移、雙寫或回滾相容層。

begin;

create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.set_employee(id) on delete restrict,
  work_date date not null,
  clock_in_at timestamptz,
  clock_in_location jsonb,
  clock_out_at timestamptz,
  clock_out_location jsonb,
  regular_minutes smallint
    check (regular_minutes is null or (regular_minutes >= 0 and regular_minutes % 30 = 0)),
  overtime_minutes smallint
    check (overtime_minutes is null or (overtime_minutes >= 0 and overtime_minutes % 30 = 0)),
  note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.set_employee(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_days_user_date_key unique (user_id, work_date)
);

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_day_id uuid not null references public.attendance_days(id) on delete cascade,
  action text not null,
  changed_by uuid references public.set_employee(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists attendance_days_work_date_idx
  on public.attendance_days(work_date desc);
create index if not exists attendance_days_reviewed_idx
  on public.attendance_days(reviewed_at, work_date desc);
create index if not exists attendance_audit_logs_day_idx
  on public.attendance_audit_logs(attendance_day_id, created_at desc);

drop trigger if exists set_attendance_days_updated_at on public.attendance_days;
create trigger set_attendance_days_updated_at
before update on public.attendance_days
for each row execute function public.set_updated_at();

alter table public.attendance_days enable row level security;
alter table public.attendance_audit_logs enable row level security;

drop policy if exists attendance_days_select_own on public.attendance_days;
create policy attendance_days_select_own
on public.attendance_days
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.attendance_days from public, anon, authenticated;
revoke all on table public.attendance_audit_logs from public, anon, authenticated;
grant select on table public.attendance_days to authenticated;
grant all on table public.attendance_days to service_role;
grant all on table public.attendance_audit_logs to service_role;

commit;


-- ============================================================================================
-- 每日簽到原子打卡 RPC
-- ============================================================================================

create or replace function public.save_attendance_clock(
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_location jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := (timezone('Asia/Taipei', v_now))::date;
  v_employee public.set_employee%rowtype;
  v_record public.attendance_days%rowtype;
  v_before jsonb;
begin
  if p_user_id is null or p_work_date is null then
    raise exception '缺少打卡人員或日期' using errcode = '23502';
  end if;
  if p_work_date <> v_today then
    raise exception '員工只能打伺服器當日的卡' using errcode = '23514';
  end if;
  if p_kind not in ('clock_in', 'clock_out') then
    raise exception '不支援的打卡操作' using errcode = '22023';
  end if;

  select * into v_employee
  from public.set_employee
  where id = p_user_id;

  if not found
    or (v_employee.hire_date is not null and v_today < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_today > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法打卡' using errcode = '42501';
  end if;

  insert into public.attendance_days (user_id, work_date)
  values (p_user_id, p_work_date)
  on conflict (user_id, work_date) do nothing;

  select * into v_record
  from public.attendance_days
  where user_id = p_user_id
    and work_date = p_work_date
  for update;

  if v_record.reviewed_at is not null then
    raise exception '此日簽到紀錄已審，無法再打卡' using errcode = '23514';
  end if;

  v_before := to_jsonb(v_record);

  if p_kind = 'clock_in' then
    if v_record.clock_in_at is not null then
      return jsonb_build_object(
        'ok', true,
        'record', to_jsonb(v_record),
        'duplicate', true,
        'serverDate', p_work_date::text
      );
    end if;

    update public.attendance_days
    set clock_in_at = v_now,
        clock_in_location = coalesce(p_location, '{}'::jsonb)
    where id = v_record.id
    returning * into v_record;
  else
    if v_record.clock_out_at is not null then
      return jsonb_build_object(
        'ok', true,
        'record', to_jsonb(v_record),
        'duplicate', true,
        'serverDate', p_work_date::text
      );
    end if;

    update public.attendance_days
    set clock_out_at = v_now,
        clock_out_location = coalesce(p_location, '{}'::jsonb)
    where id = v_record.id
    returning * into v_record;
  end if;

  insert into public.attendance_audit_logs (
    attendance_day_id,
    action,
    changed_by,
    before_data,
    after_data
  )
  values (
    v_record.id,
    p_kind,
    p_user_id,
    v_before,
    to_jsonb(v_record)
  );

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_record),
    'duplicate', false,
    'serverDate', p_work_date::text
  );
end;
$$;

revoke all on function public.save_attendance_clock(uuid, date, text, jsonb)
from public, anon, authenticated;
grant execute on function public.save_attendance_clock(uuid, date, text, jsonb)
to service_role;


-- ============================================================================================
-- 訂餐交易改讀每日簽到地點快照
-- ============================================================================================

create or replace function public.save_meal_order(
  p_user_id uuid,
  p_items jsonb,
  p_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_order_date date := (timezone('Asia/Taipei', v_now))::date;
  v_now_time time := (timezone('Asia/Taipei', v_now))::time;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_employee public.set_employee%rowtype;
  v_attendance public.attendance_days%rowtype;
  v_cutoff time;
  v_order_id uuid;
  v_submitted_at timestamptz;
  v_department_id uuid;
  v_department_name text;
  v_attendance_department_id uuid;
  v_clock_department_id uuid;
  v_clock_department_name text;
  v_existing_count integer := 0;
  v_new_count integer := 0;
begin
  if p_user_id is null then
    raise exception '缺少訂餐人員' using errcode = '23502';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception '訂餐品項格式錯誤' using errcode = '22023';
  end if;

  select * into v_employee
  from public.set_employee
  where id = p_user_id;

  if not found
    or (v_employee.hire_date is not null and v_order_date < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_order_date > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法訂餐' using errcode = '42501';
  end if;

  select * into v_attendance
  from public.attendance_days
  where user_id = p_user_id
    and work_date = v_order_date;

  v_clock_department_id := nullif(v_attendance.clock_in_location->>'departmentId', '')::uuid;
  v_clock_department_name := coalesce(v_attendance.clock_in_location->>'name', '');

  if not found or v_attendance.clock_in_at is null or v_clock_department_id is null then
    raise exception '請先完成上班打卡後再訂餐' using errcode = '23514';
  end if;

  select daily_cutoff_time into v_cutoff
  from public.meal_settings
  where id = 'default';

  v_cutoff := coalesce(v_cutoff, '10:30'::time);
  if v_now_time > v_cutoff then
    raise exception '今日訂餐已超過截止時間' using errcode = '23514';
  end if;

  select count(*) into v_existing_count
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date;

  select order_id, submitted_at, department_id, department_name_snapshot, attendance_department_id
  into v_order_id, v_submitted_at, v_department_id, v_department_name, v_attendance_department_id
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date
  order by submitted_at asc
  limit 1;

  v_order_id := coalesce(v_order_id, gen_random_uuid());
  v_submitted_at := coalesce(v_submitted_at, v_now);

  if exists (
    select 1
    from jsonb_array_elements(v_items) as raw(item)
    where nullif(raw.item->>'quantity', '') is not null
      and (
        (raw.item->>'quantity')::numeric < 0
        or floor((raw.item->>'quantity')::numeric) <> (raw.item->>'quantity')::numeric
      )
  ) then
    raise exception '訂餐數量必須是 0 或正整數' using errcode = '22023';
  end if;

  with incoming as (
    select
      nullif(raw.item->>'productId', '')::uuid as product_id,
      coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity
    from jsonb_array_elements(v_items) as raw(item)
  )
  select count(*) into v_new_count
  from incoming
  where product_id is not null
    and quantity > 0;

  if v_existing_count = 0 and v_new_count = 0 then
    raise exception '尚未選擇訂餐品項' using errcode = '23514';
  end if;

  if exists (
    with incoming as (
      select
        nullif(raw.item->>'productId', '')::uuid as product_id,
        coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity
      from jsonb_array_elements(v_items) as raw(item)
    ),
    aggregated as (
      select product_id, sum(quantity)::integer as quantity
      from incoming
      where product_id is not null
        and quantity > 0
      group by product_id
    )
    select 1
    from aggregated item
    left join public.meal_products product
      on product.id = item.product_id
    where product.id is null
       or (
         product.is_active is not true
         and not exists (
           select 1
           from public.meal_orders old_order
           where old_order.user_id = p_user_id
             and old_order.order_date = v_order_date
             and old_order.product_id = item.product_id
         )
       )
  ) then
    raise exception '訂餐品項不存在或已停用' using errcode = '23503';
  end if;

  delete from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date;

  insert into public.meal_orders (
    order_id,
    user_id,
    employee_code_snapshot,
    employee_name_snapshot,
    order_date,
    department_id,
    department_name_snapshot,
    attendance_department_id,
    product_id,
    product_name_snapshot,
    quantity,
    unit_price,
    note,
    submitted_at,
    updated_at
  )
  with incoming as (
    select
      nullif(raw.item->>'productId', '')::uuid as product_id,
      coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity,
      nullif(trim(coalesce(raw.item->>'note', p_note, '')), '') as item_note
    from jsonb_array_elements(v_items) as raw(item)
  ),
  aggregated as (
    select
      product_id,
      sum(quantity)::integer as quantity,
      max(item_note) filter (where item_note is not null) as item_note
    from incoming
    where product_id is not null
      and quantity > 0
    group by product_id
  )
  select
    v_order_id,
    p_user_id,
    coalesce(v_employee.employee_code, ''),
    coalesce(v_employee.full_name, ''),
    v_order_date,
    coalesce(v_department_id, v_clock_department_id),
    coalesce(v_department_name, v_clock_department_name, ''),
    coalesce(v_attendance_department_id, v_department_id, v_clock_department_id),
    product.id,
    coalesce(product.name, ''),
    item.quantity,
    product.price,
    item.item_note,
    v_submitted_at,
    v_now
  from aggregated item
  join public.meal_products product
    on product.id = item.product_id;

  return jsonb_build_object(
    'ok', true,
    'orderDate', v_order_date::text,
    'orderId', v_order_id::text
  );
end;
$$;

revoke all on function public.save_meal_order(uuid, jsonb, text)
from public, anon, authenticated;
grant execute on function public.save_meal_order(uuid, jsonb, text)
to service_role;

revoke all on function public.delete_member_account_v4(uuid)
from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid)
to service_role;

-- ============================================================================================
-- 人員刪除歷史保護
-- ============================================================================================

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_schedule_count bigint := 0;
  v_attendance_count bigint := 0;
  v_attendance_action_count bigint := 0;
  v_meal_count bigint := 0;
  v_settings_count bigint := 0;
  v_details text[] := array[]::text[];
begin
  select *
    into v_profile
    from public.set_employee
   where id = p_target_id
   for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'softDeleted', false,
      'blocked', false
    );
  end if;

  select count(*) into v_schedule_count
  from public.schedule_entries
  where member_id = p_target_id;

  select count(*) into v_attendance_count
  from public.attendance_days
  where user_id = p_target_id;

  select count(distinct audit_log.id) into v_attendance_action_count
  from public.attendance_audit_logs audit_log
  left join public.attendance_days attendance_day
    on attendance_day.id = audit_log.attendance_day_id
  where audit_log.changed_by = p_target_id
     or attendance_day.user_id = p_target_id;

  select count(*) into v_meal_count
  from public.meal_orders
  where user_id = p_target_id;

  select
    (select count(*) from public.meal_settings where updated_by = p_target_id)
    +
    (select count(*) from public.set_departments where attendance_settings_updated_by = p_target_id)
  into v_settings_count;

  if v_schedule_count > 0 then
    v_details := array_append(v_details, format('班表資料 %s 筆', v_schedule_count));
  end if;
  if v_attendance_count > 0 then
    v_details := array_append(v_details, format('簽到資料 %s 筆', v_attendance_count));
  end if;
  if v_attendance_action_count > 0 then
    v_details := array_append(v_details, format('簽到異動紀錄 %s 筆', v_attendance_action_count));
  end if;
  if v_meal_count > 0 then
    v_details := array_append(v_details, format('訂餐資料 %s 筆', v_meal_count));
  end if;
  if v_settings_count > 0 then
    v_details := array_append(v_details, format('系統設定異動 %s 筆', v_settings_count));
  end if;

  if cardinality(v_details) > 0 then
    return jsonb_build_object(
      'ok', false,
      'deleted', false,
      'softDeleted', false,
      'blocked', true,
      'code', 'MEMBER_HAS_HISTORY',
      'message', format(
        '無法刪除「%s」：已有%s。請保留人員資料；離職人員請填寫離職日。',
        v_profile.full_name,
        array_to_string(v_details, '、')
      ),
      'history', jsonb_build_object(
        'schedule', v_schedule_count,
        'attendance', v_attendance_count,
        'attendanceActions', v_attendance_action_count,
        'mealOrders', v_meal_count,
        'settings', v_settings_count
      )
    );
  end if;

  delete from auth.users where id = p_target_id;

  if exists (select 1 from public.set_employee where id = p_target_id) then
    raise exception '登入帳號刪除後，人員資料未同步刪除';
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'softDeleted', false,
    'blocked', false,
    'employeeCode', v_profile.employee_code
  );
end;
$$;

revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
