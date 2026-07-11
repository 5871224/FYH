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
  updated_at timestamptz not null default now()
);

create table if not exists public.set_employee (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  home_department_id uuid references public.set_departments (id) on delete set null,
  schedule_shift_ids uuid[] not null default '{}',
  hire_date date,
  leave_date date,
  pay_by_day boolean not null default false,
  fixed_rest_weekday integer not null default 0 check (fixed_rest_weekday between 0 and 6),
  monthly_rest_days integer not null default 0 check (monthly_rest_days between 0 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.set_employee
  drop constraint if exists set_employee_role_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_employee'
      and column_name = 'role'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.set_employee
      alter column role drop default;
    alter table public.set_employee
      alter column role type text using role::text;
    alter table public.set_employee
      alter column role set default 'employee';
  end if;
end $$;

alter table public.set_employee
  add constraint set_employee_role_check
  check (role in ('admin', 'manager', 'employee'));

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
  updated_at timestamptz not null default now()
);

create table if not exists public.set_leave (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  color text not null default '#E8EEF8',
  text_color text,
  auto_text_color boolean not null default true,
  display_name text,
  requires_time boolean not null default false,
  requires_reason boolean not null default false,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
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

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.set_employee (id) on delete restrict,
  work_date date not null,
  employee_code_snapshot text,
  employee_name_snapshot text,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  clock_in_department_id uuid references public.set_departments (id) on delete restrict,
  clock_in_department_name_snapshot text,
  clock_in_address_snapshot text,
  clock_in_source text check (clock_in_source in ('GPS', 'IP', '管理員補登')),
  clock_in_latitude double precision,
  clock_in_longitude double precision,
  clock_in_accuracy double precision,
  clock_in_distance double precision,
  clock_in_ip text,
  clock_out_department_id uuid references public.set_departments (id) on delete restrict,
  clock_out_department_name_snapshot text,
  clock_out_address_snapshot text,
  clock_out_source text check (clock_out_source in ('GPS', 'IP', '管理員補登')),
  clock_out_latitude double precision,
  clock_out_longitude double precision,
  clock_out_accuracy double precision,
  clock_out_distance double precision,
  clock_out_ip text,
  attendance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

alter table public.attendance_records
  add column if not exists employee_code_snapshot text,
  add column if not exists employee_name_snapshot text;

create table if not exists public.attendance_action_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records (id) on delete cascade,
  action_type text not null,
  field_name text,
  old_value text,
  new_value text,
  operator_user_id uuid references public.set_employee (id) on delete set null,
  operator_name_snapshot text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_overtime_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.set_employee (id) on delete restrict,
  work_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'returned')),
  early_overtime_hours numeric(5, 2) not null default 0 check (early_overtime_hours >= 0),
  late_overtime_hours numeric(5, 2) not null default 0 check (late_overtime_hours >= 0),
  total_overtime_hours numeric(5, 2) not null default 0 check (total_overtime_hours >= 0),
  employee_note text,
  attendance_changed_warning boolean not null default false,
  is_deleted_by_employee boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.set_employee (id) on delete set null,
  created_by_type text not null default 'employee' check (created_by_type in ('employee', 'admin')),
  created_by_user_id uuid references public.set_employee (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.set_employee (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_overtime_requests
  drop constraint if exists attendance_overtime_requests_user_id_work_date_key,
  add column if not exists is_deleted_by_employee boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.set_employee (id) on delete set null;

create table if not exists public.overtime_review_logs (
  id uuid primary key default gen_random_uuid(),
  overtime_request_id uuid not null references public.attendance_overtime_requests (id) on delete cascade,
  old_status text,
  new_status text,
  old_early_hours numeric(5, 2),
  new_early_hours numeric(5, 2),
  old_late_hours numeric(5, 2),
  new_late_hours numeric(5, 2),
  operator_user_id uuid references public.set_employee (id) on delete set null,
  created_at timestamptz not null default now()
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
  clock_location_id uuid references public.set_departments (id) on delete restrict,
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
create index if not exists idx_attendance_records_user_date on public.attendance_records (user_id, work_date desc);
create index if not exists idx_attendance_records_work_date on public.attendance_records (work_date);
create index if not exists idx_attendance_action_logs_record on public.attendance_action_logs (attendance_record_id, created_at desc);
create index if not exists idx_attendance_overtime_requests_user_date on public.attendance_overtime_requests (user_id, work_date desc);
create index if not exists idx_attendance_overtime_requests_status_date on public.attendance_overtime_requests (status, work_date desc);
create unique index if not exists idx_attendance_overtime_active_user_date
  on public.attendance_overtime_requests (user_id, work_date)
  where is_deleted_by_employee = false;
create index if not exists idx_overtime_review_logs_request on public.overtime_review_logs (overtime_request_id, created_at desc);
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
alter table public.attendance_records enable row level security;
alter table public.attendance_action_logs enable row level security;
alter table public.attendance_overtime_requests enable row level security;
alter table public.overtime_review_logs enable row level security;
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

drop trigger if exists protect_admin_member_trigger on public.set_employee;
create trigger protect_admin_member_trigger
before update or delete on public.set_employee
for each row execute function public.protect_admin_member();

create or replace function public.protect_department_attendance_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
    and auth.uid() is not null
    and not public.is_admin(auth.uid())
    and (
      NEW.address is distinct from OLD.address
      or NEW.latitude is distinct from OLD.latitude
      or NEW.longitude is distinct from OLD.longitude
      or NEW.public_ip is distinct from OLD.public_ip
      or NEW.attendance_enabled is distinct from OLD.attendance_enabled
      or NEW.attendance_settings_updated_at is distinct from OLD.attendance_settings_updated_at
      or NEW.attendance_settings_updated_by is distinct from OLD.attendance_settings_updated_by
    ) then
    raise exception '只有管理員可以修改打卡設定' using errcode = '42501';
  end if;
  if TG_OP = 'INSERT'
    and auth.uid() is not null
    and not public.is_admin(auth.uid())
    and (
      NEW.address is not null
      or NEW.latitude is not null
      or NEW.longitude is not null
      or NEW.public_ip is not null
      or NEW.attendance_enabled is true
      or NEW.attendance_settings_updated_at is not null
      or NEW.attendance_settings_updated_by is not null
    ) then
    raise exception '只有管理員可以新增打卡設定' using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists protect_department_attendance_settings_trigger on public.set_departments;
drop trigger if exists trg_protect_department_attendance_fields on public.set_departments;
create trigger trg_protect_department_attendance_fields
before insert or update on public.set_departments
for each row execute function public.protect_department_attendance_fields();

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
drop policy if exists read_attendance_records on public.attendance_records;
drop policy if exists write_attendance_records on public.attendance_records;
drop policy if exists read_attendance_logs on public.attendance_action_logs;
drop policy if exists write_attendance_logs on public.attendance_action_logs;
drop policy if exists read_overtime_requests on public.attendance_overtime_requests;
drop policy if exists write_overtime_requests on public.attendance_overtime_requests;
drop policy if exists read_overtime_review_logs on public.overtime_review_logs;
drop policy if exists write_overtime_review_logs on public.overtime_review_logs;
drop policy if exists read_meal_products on public.meal_products;
drop policy if exists write_meal_products on public.meal_products;
drop policy if exists read_meal_settings on public.meal_settings;
drop policy if exists write_meal_settings on public.meal_settings;
drop policy if exists read_meal_orders on public.meal_orders;
drop policy if exists write_meal_orders on public.meal_orders;

create policy read_scheduler_settings on public.scheduler_settings for select to authenticated using (true);
create policy write_scheduler_settings on public.scheduler_settings for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_set_departments on public.set_departments for select to authenticated using (true);
create policy write_set_departments on public.set_departments for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_set_employee on public.set_employee for select to authenticated using (true);
create policy insert_set_employee on public.set_employee for insert to authenticated with check (public.is_manager(auth.uid()));
create policy update_set_employee on public.set_employee for update to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_set_shift on public.set_shift for select to authenticated using (true);
create policy write_set_shift on public.set_shift for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_set_leave on public.set_leave for select to authenticated using (true);
create policy write_set_leave on public.set_leave for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_set_overtime on public.set_overtime for select to authenticated using (true);
create policy write_set_overtime on public.set_overtime for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_holidays on public.holidays for select to authenticated using (true);
create policy write_holidays on public.holidays for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_schedule_entries on public.schedule_entries for select to authenticated using (true);
create policy write_schedule_entries on public.schedule_entries for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_attendance_records on public.attendance_records for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy write_attendance_records on public.attendance_records for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy read_attendance_logs on public.attendance_action_logs for select to authenticated using (
  public.is_manager(auth.uid())
  or exists (
    select 1
    from public.attendance_records ar
    where ar.id = attendance_record_id
      and ar.user_id = auth.uid()
  )
);
create policy write_attendance_logs on public.attendance_action_logs for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_overtime_requests on public.attendance_overtime_requests for select to authenticated using (user_id = auth.uid() or public.is_manager(auth.uid()));
create policy write_overtime_requests on public.attendance_overtime_requests for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_overtime_review_logs on public.overtime_review_logs for select to authenticated using (public.is_admin(auth.uid()));
create policy write_overtime_review_logs on public.overtime_review_logs for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy read_meal_products on public.meal_products for select to authenticated using (true);
create policy write_meal_products on public.meal_products for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_meal_settings on public.meal_settings for select to authenticated using (true);
create policy write_meal_settings on public.meal_settings for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy read_meal_orders on public.meal_orders for select to authenticated using (user_id = auth.uid() or public.is_manager(auth.uid()));
create policy write_meal_orders on public.meal_orders for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

drop function if exists public.get_department_attendance_settings();
drop function if exists public.save_department_attendance_settings_bulk(jsonb);

create or replace function public.save_department_attendance_fields_bulk(settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if settings is null or jsonb_typeof(settings) <> 'array' then
    raise exception 'settings must be a json array' using errcode = '22023';
  end if;

  update public.set_departments d
  set
    address = nullif(btrim(coalesce(item.address, '')), ''),
    latitude = item.latitude,
    longitude = item.longitude,
    public_ip = nullif(btrim(coalesce(item.public_ip, '')), ''),
    attendance_enabled = coalesce(item.attendance_enabled, false),
    attendance_settings_updated_at = now(),
    attendance_settings_updated_by = auth.uid()
  from jsonb_to_recordset(settings) as item(
    department_id uuid,
    address text,
    latitude double precision,
    longitude double precision,
    public_ip text,
    attendance_enabled boolean
  )
  where item.department_id is not null
    and d.id = item.department_id;
end;
$$;

revoke all on function public.save_department_attendance_fields_bulk(jsonb) from public, anon;
grant execute on function public.save_department_attendance_fields_bulk(jsonb) to authenticated;

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
  v_department public.set_departments%rowtype;
  v_record public.attendance_records%rowtype;
  v_department_id uuid := nullif(p_location->>'departmentId', '')::uuid;
  v_source text := coalesce(nullif(p_location->>'source', ''), 'IP');
  v_latitude double precision := nullif(p_location->>'latitude', '')::double precision;
  v_longitude double precision := nullif(p_location->>'longitude', '')::double precision;
  v_accuracy double precision := nullif(p_location->>'accuracy', '')::double precision;
  v_distance double precision := nullif(p_location->>'distance', '')::double precision;
  v_ip text := coalesce(p_location->>'ip', '');
begin
  if p_user_id is null or p_work_date is null then
    raise exception '缺少打卡人員或日期' using errcode = '23502';
  end if;
  if p_kind not in ('clock_in', 'clock_out') then
    raise exception '不支援的打卡操作' using errcode = '22023';
  end if;
  if v_source not in ('GPS', 'IP') then
    raise exception '不支援的打卡來源' using errcode = '22023';
  end if;

  select *
  into v_employee
  from public.set_employee
  where id = p_user_id;
  if not found
    or (v_employee.hire_date is not null and v_today < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_today > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法打卡' using errcode = '42501';
  end if;

  select *
  into v_department
  from public.set_departments
  where id = v_department_id
    and attendance_enabled = true;
  if not found then
    raise exception '打卡單位未啟用或不存在' using errcode = '23503';
  end if;

  insert into public.attendance_records (
    user_id,
    work_date,
    employee_code_snapshot,
    employee_name_snapshot,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_work_date,
    coalesce(v_employee.employee_code, ''),
    coalesce(v_employee.full_name, ''),
    v_now,
    v_now
  )
  on conflict (user_id, work_date) do nothing;

  if p_kind = 'clock_in' then
    update public.attendance_records
    set
      employee_code_snapshot = coalesce(v_employee.employee_code, ''),
      employee_name_snapshot = coalesce(v_employee.full_name, ''),
      clock_in_at = v_now,
      clock_in_department_id = v_department.id,
      clock_in_department_name_snapshot = coalesce(v_department.name, ''),
      clock_in_address_snapshot = coalesce(v_department.address, ''),
      clock_in_source = v_source,
      clock_in_latitude = v_latitude,
      clock_in_longitude = v_longitude,
      clock_in_accuracy = v_accuracy,
      clock_in_distance = v_distance,
      clock_in_ip = v_ip,
      updated_at = v_now
    where user_id = p_user_id
      and work_date = p_work_date
      and clock_in_at is null
      and clock_out_at is null
    returning * into v_record;
  else
    update public.attendance_records
    set
      employee_code_snapshot = coalesce(v_employee.employee_code, ''),
      employee_name_snapshot = coalesce(v_employee.full_name, ''),
      clock_out_at = v_now,
      clock_out_department_id = v_department.id,
      clock_out_department_name_snapshot = coalesce(v_department.name, ''),
      clock_out_address_snapshot = coalesce(v_department.address, ''),
      clock_out_source = v_source,
      clock_out_latitude = v_latitude,
      clock_out_longitude = v_longitude,
      clock_out_accuracy = v_accuracy,
      clock_out_distance = v_distance,
      clock_out_ip = v_ip,
      updated_at = v_now
    where user_id = p_user_id
      and work_date = p_work_date
      and clock_out_at is null
    returning * into v_record;
  end if;

  if not found then
    select *
    into v_record
    from public.attendance_records
    where user_id = p_user_id
      and work_date = p_work_date;

    if p_kind = 'clock_in' and v_record.clock_out_at is not null then
      raise exception '已有下班打卡紀錄，無法再補上班打卡' using errcode = '23514';
    end if;

    return jsonb_build_object(
      'ok', true,
      'record', to_jsonb(v_record),
      'duplicate', true,
      'serverDate', p_work_date::text
    );
  end if;

  insert into public.attendance_action_logs (
    attendance_record_id,
    action_type,
    operator_user_id,
    operator_name_snapshot
  ) values (
    v_record.id,
    p_kind,
    v_employee.id,
    coalesce(v_employee.full_name, '')
  );

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_record),
    'duplicate', false,
    'serverDate', p_work_date::text
  );
end;
$$;

revoke all on function public.save_attendance_clock(uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_attendance_clock(uuid, date, text, jsonb) to service_role;

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
  v_attendance public.attendance_records%rowtype;
  v_cutoff time;
  v_order_id uuid;
begin
  if p_user_id is null then
    raise exception '缺少訂餐人員' using errcode = '23502';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception '訂餐品項格式錯誤' using errcode = '22023';
  end if;

  select *
  into v_employee
  from public.set_employee
  where id = p_user_id;
  if not found
    or (v_employee.hire_date is not null and v_order_date < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_order_date > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法訂餐' using errcode = '42501';
  end if;

  select *
  into v_attendance
  from public.attendance_records
  where user_id = p_user_id
    and work_date = v_order_date;
  if not found or v_attendance.clock_in_at is null or v_attendance.clock_in_department_id is null then
    raise exception '請先完成上班打卡後再訂餐' using errcode = '23514';
  end if;

  select daily_cutoff_time
  into v_cutoff
  from public.meal_settings
  where id = 'default';
  v_cutoff := coalesce(v_cutoff, '10:30'::time);
  if v_now_time > v_cutoff then
    raise exception '今日訂餐已超過截止時間' using errcode = '23514';
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
    from aggregated a
    left join public.meal_products p on p.id = a.product_id and p.is_active = true
    where p.id is null
  ) then
    raise exception '訂餐品項不存在或已停用' using errcode = '23503';
  end if;

  select order_id
  into v_order_id
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date
  order by submitted_at desc
  limit 1;
  v_order_id := coalesce(v_order_id, gen_random_uuid());

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
    clock_location_id,
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
  select
    v_order_id,
    p_user_id,
    coalesce(v_employee.employee_code, ''),
    coalesce(v_employee.full_name, ''),
    v_order_date,
    v_attendance.clock_in_department_id,
    coalesce(v_attendance.clock_in_department_name_snapshot, ''),
    v_attendance.clock_in_department_id,
    p.id,
    coalesce(p.name, ''),
    a.quantity,
    p.price,
    nullif(trim(coalesce(p_note, '')), ''),
    v_now,
    v_now
  from aggregated a
  join public.meal_products p on p.id = a.product_id and p.is_active = true;

  return jsonb_build_object('ok', true, 'orderDate', v_order_date::text, 'orderId', v_order_id::text);
end;
$$;

revoke all on function public.save_meal_order(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_meal_order(uuid, jsonb, text) to service_role;

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
  v_attendance public.attendance_records%rowtype;
  v_cutoff time;
  v_order_id uuid;
  v_submitted_at timestamptz;
  v_existing_count integer := 0;
  v_new_count integer := 0;
begin
  if p_user_id is null then
    raise exception '缺少訂餐人員' using errcode = '23502';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception '訂餐品項格式錯誤' using errcode = '22023';
  end if;

  select *
  into v_employee
  from public.set_employee
  where id = p_user_id;
  if not found
    or (v_employee.hire_date is not null and v_order_date < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_order_date > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法訂餐' using errcode = '42501';
  end if;

  select *
  into v_attendance
  from public.attendance_records
  where user_id = p_user_id
    and work_date = v_order_date;
  if not found or v_attendance.clock_in_at is null or v_attendance.clock_in_department_id is null then
    raise exception '請先完成上班打卡後再訂餐' using errcode = '23514';
  end if;

  select daily_cutoff_time
  into v_cutoff
  from public.meal_settings
  where id = 'default';
  v_cutoff := coalesce(v_cutoff, '10:30'::time);
  if v_now_time > v_cutoff then
    raise exception '今日訂餐已超過截止時間' using errcode = '23514';
  end if;

  select count(*)
  into v_existing_count
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date;

  select order_id, submitted_at
  into v_order_id, v_submitted_at
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
  select count(*)
  into v_new_count
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
    from aggregated a
    left join public.meal_products p on p.id = a.product_id
    where p.id is null
      or (
        p.is_active is not true
        and not exists (
          select 1
          from public.meal_orders old_order
          where old_order.user_id = p_user_id
            and old_order.order_date = v_order_date
            and old_order.product_id = a.product_id
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
    clock_location_id,
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
    v_attendance.clock_in_department_id,
    coalesce(v_attendance.clock_in_department_name_snapshot, ''),
    v_attendance.clock_in_department_id,
    p.id,
    coalesce(p.name, ''),
    a.quantity,
    p.price,
    a.item_note,
    v_submitted_at,
    v_now
  from aggregated a
  join public.meal_products p on p.id = a.product_id;

  return jsonb_build_object('ok', true, 'orderDate', v_order_date::text, 'orderId', v_order_id::text);
end;
$$;

revoke all on function public.save_meal_order(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_meal_order(uuid, jsonb, text) to service_role;

commit;


begin;

-- 人員資料依本人、共同班表與管理用途分流
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

revoke all on function public.get_my_profile_v2() from public, anon;
revoke all on function public.get_schedule_directory_v2() from public, anon;
revoke all on function public.get_employee_admin_directory_v2() from public, anon;
grant execute on function public.get_my_profile_v2() to authenticated, service_role;
grant execute on function public.get_schedule_directory_v2() to authenticated, service_role;
grant execute on function public.get_employee_admin_directory_v2() to authenticated, service_role;

commit;


-- ============================================================================================
-- 區段 24：單位安全寫入與班表匯出正式資料
-- ============================================================================================

begin;

create or replace function public.save_departments_general_v2(p_departments jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  v_id uuid;
  v_name text;
  v_start_date date;
  v_end_date date;
  v_hidden boolean;
  v_sort_order integer;
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_departments, '[]'::jsonb)) <> 'array' then
    raise exception '單位資料格式錯誤';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_departments, '[]'::jsonb)) loop
    begin
      v_id := nullif(btrim(item->>'id'), '')::uuid;
      v_start_date := nullif(btrim(item->>'start_date'), '')::date;
      v_end_date := nullif(btrim(item->>'end_date'), '')::date;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception '單位識別碼或日期格式錯誤';
    end;
    v_name := btrim(coalesce(item->>'name', ''));
    v_hidden := coalesce((item->>'hidden_from_schedule')::boolean, false);
    v_sort_order := greatest(0, coalesce((item->>'sort_order')::integer, 0));

    if v_id is null or v_name = '' then
      raise exception '單位名稱與識別碼不可空白';
    end if;
    if length(v_name) > 12 then
      raise exception '單位名稱不可超過 12 個字';
    end if;
    if v_start_date is not null and v_end_date is not null and v_start_date > v_end_date then
      raise exception '單位開始日期不得晚於結束日期';
    end if;

    insert into public.set_departments (
      id, name, start_date, end_date, hidden_from_schedule, sort_order
    ) values (
      v_id, v_name, v_start_date, v_end_date, v_hidden, v_sort_order
    )
    on conflict (id) do update set
      name = excluded.name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      hidden_from_schedule = excluded.hidden_from_schedule,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.delete_department_general_v2(p_department_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_department_id is null then
    raise exception '缺少單位識別碼';
  end if;
  if exists (select 1 from public.set_employee where home_department_id = p_department_id) then
    raise exception '這個單位仍有人員，請先將人員移轉到其他單位';
  end if;
  if exists (select 1 from public.set_shift where applicable_department_id = p_department_id) then
    raise exception '這個單位仍有班別使用，請先修改相關班別';
  end if;

  begin
    delete from public.set_departments where id = p_department_id;
  exception when foreign_key_violation then
    raise exception '這個單位已有班表、打卡或訂餐歷史，為保留歷史關聯不可刪除';
  end;
end;
$$;

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

revoke all on function public.save_departments_general_v2(jsonb) from public, anon;
revoke all on function public.delete_department_general_v2(uuid) from public, anon;
revoke all on function public.get_schedule_export_rows_v2(date, date) from public, anon;
grant execute on function public.save_departments_general_v2(jsonb) to authenticated, service_role;
grant execute on function public.delete_department_general_v2(uuid) to authenticated, service_role;
grant execute on function public.get_schedule_export_rows_v2(date, date) to authenticated, service_role;

commit;

-- ============================================================================================
-- 人員刪除歷史保護與禁止隱性停用
-- ============================================================================================

begin;

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
  v_overtime_count bigint := 0;
  v_overtime_review_count bigint := 0;
  v_overtime_management_count bigint := 0;
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
  from public.attendance_records
  where user_id = p_target_id;

  select count(distinct action_log.id) into v_attendance_action_count
  from public.attendance_action_logs action_log
  left join public.attendance_records attendance_record
    on attendance_record.id = action_log.attendance_record_id
  where action_log.operator_user_id = p_target_id
     or attendance_record.user_id = p_target_id;

  select count(*) into v_overtime_count
  from public.attendance_overtime_requests
  where user_id = p_target_id;

  select count(distinct review_log.id) into v_overtime_review_count
  from public.overtime_review_logs review_log
  left join public.attendance_overtime_requests overtime_request
    on overtime_request.id = review_log.overtime_request_id
  where review_log.operator_user_id = p_target_id
     or overtime_request.user_id = p_target_id;

  select count(distinct overtime_request.id) into v_overtime_management_count
  from public.attendance_overtime_requests overtime_request
  where overtime_request.created_by_user_id = p_target_id
     or overtime_request.reviewed_by = p_target_id
     or overtime_request.deleted_by = p_target_id;

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
    v_details := array_append(v_details, format('打卡資料 %s 筆', v_attendance_count));
  end if;
  if v_attendance_action_count > 0 then
    v_details := array_append(v_details, format('打卡異動紀錄 %s 筆', v_attendance_action_count));
  end if;
  if v_overtime_count > 0 then
    v_details := array_append(v_details, format('加班申請 %s 筆', v_overtime_count));
  end if;
  if v_overtime_review_count > 0 then
    v_details := array_append(v_details, format('加班審核紀錄 %s 筆', v_overtime_review_count));
  end if;
  if v_overtime_management_count > 0 then
    v_details := array_append(v_details, format('加班管理紀錄 %s 筆', v_overtime_management_count));
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
        'overtimeRequests', v_overtime_count,
        'overtimeReviews', v_overtime_review_count,
        'overtimeManagement', v_overtime_management_count,
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

create or replace function public.delete_member_account_v3(p_target_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.delete_member_account_v4(p_target_id)
$$;


revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
revoke all on function public.delete_member_account_v3(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
grant execute on function public.delete_member_account_v3(uuid) to service_role;

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
