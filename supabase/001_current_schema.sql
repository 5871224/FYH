-- 福圓號目前正式 PostgreSQL 資料結構
-- 本檔只描述現行資料模型，不包含 Supabase Auth、RLS、RPC、Edge Function 或歷史資料遷移。

begin;

create table if not exists public.schedule_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  meal_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  permissions text[] not null default '{}'::text[],
  is_system boolean not null default false,
  sort_order integer not null default 1000000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_role_groups (
  role_id uuid not null references public.access_roles(id) on delete cascade,
  group_id uuid not null references public.schedule_groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_id, group_id)
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
  group_id uuid references public.schedule_groups(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_employee (
  id uuid primary key,
  employee_code text not null unique,
  full_name text not null,
  home_department_id uuid references public.set_departments(id) on delete set null,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean not null default false,
  schedule_department_ids text[] not null default '{}'::text[],
  monthly_rest_days integer not null default 0 check (monthly_rest_days between 0 and 31),
  fixed_rest_weekday integer not null default 0 check (fixed_rest_weekday between 0 and 6),
  schedule_shift_ids uuid[] not null default '{}'::uuid[],
  sort_order integer not null default 0,
  group_id uuid references public.schedule_groups(id) on delete set null,
  access_role_id uuid references public.access_roles(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.set_departments
  drop constraint if exists set_departments_attendance_settings_updated_by_fkey;
alter table public.set_departments
  add constraint set_departments_attendance_settings_updated_by_fkey
  foreign key (attendance_settings_updated_by)
  references public.set_employee(id)
  on delete set null;

create table if not exists public.auth_accounts (
  employee_id uuid primary key references public.set_employee(id) on delete cascade,
  login_account text not null check (length(btrim(login_account)) > 0),
  password_hash text not null check (length(password_hash) > 0),
  password_changed_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  session_hash text primary key check (length(session_hash) = 64),
  employee_id uuid not null references public.set_employee(id) on delete cascade,
  device_type text not null check (device_type in ('phone', 'tablet', 'desktop')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at >= created_at)
);

create table if not exists public.set_shift (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  applicable_department_id uuid not null references public.set_departments(id) on delete restrict,
  color text,
  start_time time,
  end_time time,
  required_staff_count integer not null default 0 check (required_staff_count >= 0),
  text_color text,
  auto_text_color boolean not null default true,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  group_id uuid references public.schedule_groups(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_leave (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  color text,
  requires_time boolean not null default false,
  requires_reason boolean not null default false,
  text_color text,
  auto_text_color boolean not null default true,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_overtime (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  color text,
  start_time time,
  end_time time,
  use_rest_1 boolean not null default false,
  rest_1_start_time time,
  rest_1_end_time time,
  use_rest_2 boolean not null default false,
  rest_2_start_time time,
  rest_2_end_time time,
  text_color text,
  auto_text_color boolean not null default true,
  hidden_from_toolbar boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
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

create table if not exists public.scheduler_settings (
  id text primary key default 'default',
  current_year integer not null default extract(year from now())::integer,
  current_month integer not null default 0 check (current_month between 0 and 11),
  dept_filter text not null default 'all',
  table_view text not null default 'member' check (table_view in ('member', 'shift')),
  table_dept_scope_filter text not null default 'all',
  table_stats_visible boolean not null default true,
  schedule_start_date date,
  week_start integer not null default 0 check (week_start between 0 and 6),
  month_start_day integer not null default 1 check (month_start_day between 1 and 31),
  eight_week_start_date date,
  attendance_common_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.set_employee(id) on delete cascade,
  work_date date not null,
  support_department_id uuid references public.set_departments(id) on delete set null,
  shift_type_id uuid references public.set_shift(id) on delete set null,
  leave_type_id uuid references public.set_leave(id) on delete set null,
  leave_all_day boolean not null default true,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_type_id uuid references public.set_overtime(id) on delete set null,
  note text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_use_rest_1 boolean not null default false,
  overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean not null default false,
  overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,
  overtime_reason text,
  group_id uuid references public.schedule_groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, work_date)
);

create table if not exists public.schedule_archives (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.schedule_groups(id) on delete set null,
  group_code_snapshot text not null,
  group_name_snapshot text not null,
  start_date date not null,
  end_date date not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.set_employee(id) on delete set null,
  archived_by_name_snapshot text not null default '',
  member_count integer not null default 0,
  entry_count integer not null default 0,
  check (start_date <= end_date)
);

create table if not exists public.schedule_archive_entries (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.schedule_archives(id) on delete cascade,
  source_schedule_entry_id uuid,
  source_member_id uuid,
  source_department_id uuid,
  source_shift_id uuid,
  source_leave_id uuid,
  source_overtime_id uuid,
  work_date date not null,
  employee_code_snapshot text not null default '',
  employee_name_snapshot text not null default '',
  member_sort_order integer not null default 0,
  department_name_snapshot text not null default '',
  department_sort_order integer not null default 0,
  shift_name_snapshot text not null default '',
  shift_start_time_snapshot time,
  shift_end_time_snapshot time,
  shift_color_snapshot text,
  shift_text_color_snapshot text,
  leave_code_snapshot text not null default '',
  leave_name_snapshot text not null default '',
  leave_color_snapshot text,
  overtime_name_snapshot text not null default '',
  overtime_color_snapshot text,
  leave_all_day boolean not null default true,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_reason text,
  note text,
  created_at timestamptz not null default now(),
  unique (archive_id, source_member_id, work_date)
);

create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.set_employee(id) on delete restrict,
  work_date date not null,
  clock_in_at timestamptz,
  clock_in_location jsonb,
  clock_out_at timestamptz,
  clock_out_location jsonb,
  regular_minutes smallint check (regular_minutes is null or (regular_minutes >= 0 and regular_minutes % 30 = 0)),
  overtime_minutes smallint check (overtime_minutes is null or (overtime_minutes >= 0 and overtime_minutes % 30 = 0)),
  note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.set_employee(id) on delete set null,
  group_id uuid references public.schedule_groups(id) on delete set null,
  group_name_snapshot text,
  department_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
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

create table if not exists public.meal_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_settings (
  id text primary key default 'default',
  daily_cutoff_time time not null default '10:30',
  updated_by uuid references public.set_employee(id) on delete set null,
  updated_at timestamptz not null default now(),
  company_subsidy integer not null default 55 check (company_subsidy > 0)
);

create table if not exists public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  user_id uuid not null references public.set_employee(id) on delete restrict,
  employee_code_snapshot text not null,
  employee_name_snapshot text not null,
  order_date date not null,
  department_id uuid references public.set_departments(id) on delete restrict,
  department_name_snapshot text not null,
  attendance_department_id uuid references public.set_departments(id) on delete restrict,
  product_id uuid references public.meal_products(id) on delete restrict,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored,
  note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  group_id uuid references public.schedule_groups(id) on delete set null,
  group_name_snapshot text,
  unique (user_id, order_date, product_id)
);

commit;
