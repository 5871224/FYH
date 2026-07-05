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
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.set_employee
  drop constraint if exists set_employee_role_check;

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
  created_by_type text not null default 'employee' check (created_by_type in ('employee', 'admin')),
  created_by_user_id uuid references public.set_employee (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.set_employee (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

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

create index if not exists idx_set_employee_active_code on public.set_employee (is_active, employee_code);
create index if not exists idx_set_employee_home_department on public.set_employee (home_department_id);
create index if not exists idx_set_departments_attendance_enabled on public.set_departments (attendance_enabled);
create index if not exists idx_schedule_entries_work_date on public.schedule_entries (work_date);
create index if not exists idx_schedule_entries_member_date on public.schedule_entries (member_id, work_date);
create index if not exists idx_attendance_records_user_date on public.attendance_records (user_id, work_date desc);
create index if not exists idx_attendance_records_work_date on public.attendance_records (work_date);
create index if not exists idx_attendance_action_logs_record on public.attendance_action_logs (attendance_record_id, created_at desc);
create index if not exists idx_attendance_overtime_requests_user_date on public.attendance_overtime_requests (user_id, work_date desc);
create index if not exists idx_attendance_overtime_requests_status_date on public.attendance_overtime_requests (status, work_date desc);
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

create or replace function public.is_manager(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.set_employee e
    where e.id = user_id
      and e.role in ('admin', 'manager')
      and e.is_active = true
  )
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.set_employee e
    where e.id = user_id
      and e.role = 'admin'
      and e.is_active = true
  )
$$;

commit;
