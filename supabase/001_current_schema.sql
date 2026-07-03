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
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_employee (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('manager', 'employee')),
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

create table if not exists public.set_shift (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#7C5CFF',
  text_color text,
  start_time time,
  end_time time,
  required_staff_count integer not null default 0 check (required_staff_count >= 0),
  applicable_department_ids uuid[] not null default '{}',
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
  display_name text,
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

create table if not exists public.clock_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.set_employee (id) on delete cascade,
  clock_location_id uuid references public.clock_locations (id) on delete set null,
  event_type text not null check (event_type in ('in', 'out')),
  event_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_set_employee_active_code on public.set_employee (is_active, employee_code);
create index if not exists idx_set_employee_home_department on public.set_employee (home_department_id);
create index if not exists idx_schedule_entries_work_date on public.schedule_entries (work_date);
create index if not exists idx_schedule_entries_member_date on public.schedule_entries (member_id, work_date);
create index if not exists idx_attendance_logs_member_event_at on public.attendance_logs (member_id, event_at desc);

alter table public.scheduler_settings enable row level security;
alter table public.set_departments enable row level security;
alter table public.set_employee enable row level security;
alter table public.set_shift enable row level security;
alter table public.set_leave enable row level security;
alter table public.set_overtime enable row level security;
alter table public.holidays enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.clock_locations enable row level security;
alter table public.attendance_logs enable row level security;

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
      and e.role = 'manager'
      and e.is_active = true
  )
$$;

commit;
