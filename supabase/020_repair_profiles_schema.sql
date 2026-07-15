begin;

-- 修復登入時出現 relation "public.profiles" does not exist 的資料庫。
-- 這支可重複執行，會先補齊登入與人員主檔需要的基礎 schema，
-- 再讓 017/019 這類後續修復 SQL 可以順利引用 profiles。

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'app_role') then
    create type public.app_role as enum ('employee', 'manager');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'request_status') then
    create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  scheduler_item_id text,
  start_date date,
  end_date date,
  hidden_from_leave boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments
  add column if not exists scheduler_item_id text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists hidden_from_leave boolean not null default false,
  add column if not exists sort_order integer not null default 0;

update public.departments
set scheduler_item_id = code
where scheduler_item_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.departments'::regclass
      and conname = 'departments_scheduler_item_id_key'
  ) then
    alter table public.departments
      add constraint departments_scheduler_item_id_key unique (scheduler_item_id);
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  role public.app_role not null default 'employee',
  home_department_id uuid references public.departments (id) on delete set null,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean not null default false,
  schedule_department_ids text[] not null default '{}',
  fixed_rest_weekday integer not null default 0,
  monthly_rest_days integer not null default 0,
  login_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists position_name text,
  add column if not exists hire_date date,
  add column if not exists leave_date date,
  add column if not exists pay_by_day boolean not null default false,
  add column if not exists schedule_department_ids text[] not null default '{}',
  add column if not exists fixed_rest_weekday integer not null default 0,
  add column if not exists monthly_rest_days integer not null default 0,
  add column if not exists login_email text,
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  drop constraint if exists profiles_fixed_rest_weekday_check;

alter table public.profiles
  drop constraint if exists profiles_monthly_rest_days_check;

alter table public.profiles
  add constraint profiles_fixed_rest_weekday_check
  check (fixed_rest_weekday between 0 and 6);

alter table public.profiles
  add constraint profiles_monthly_rest_days_check
  check (monthly_rest_days >= 0 and monthly_rest_days <= 31);

create unique index if not exists idx_profiles_login_email_unique
on public.profiles (login_email)
where login_email is not null;

create index if not exists idx_profiles_home_department_id
on public.profiles (home_department_id);

create table if not exists public.member_departments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (member_id, department_id)
);

create index if not exists idx_member_departments_member_id
on public.member_departments (member_id);

create or replace function public.is_manager(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'manager'
      and is_active = true
  );
$$;

create or replace function public.login_email_by_employee_code(p_employee_code text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select login_email
  from public.profiles
  where employee_code = p_employee_code
    and is_active = true
    and login_email is not null
  limit 1
$$;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.member_departments enable row level security;

drop policy if exists "anon_can_read_departments" on public.departments;
drop policy if exists "authenticated_can_read_departments" on public.departments;
drop policy if exists "managers_can_manage_departments" on public.departments;
drop policy if exists "anon_can_read_profiles" on public.profiles;
drop policy if exists "users_can_read_profiles" on public.profiles;
drop policy if exists "users_can_update_own_profile_basic_fields" on public.profiles;
drop policy if exists "managers_can_manage_profiles" on public.profiles;
drop policy if exists "anon_can_read_member_departments" on public.member_departments;
drop policy if exists "authenticated_can_read_member_departments" on public.member_departments;
drop policy if exists "managers_can_manage_member_departments" on public.member_departments;

create policy "authenticated_can_read_departments"
on public.departments
for select
to authenticated
using (true);

create policy "managers_can_manage_departments"
on public.departments
for all
to authenticated
using (public.is_manager(auth.uid()))
with check (public.is_manager(auth.uid()));

create policy "users_can_read_profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "users_can_update_own_profile_basic_fields"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "managers_can_manage_profiles"
on public.profiles
for all
to authenticated
using (public.is_manager(auth.uid()))
with check (public.is_manager(auth.uid()));

create policy "authenticated_can_read_member_departments"
on public.member_departments
for select
to authenticated
using (true);

create policy "managers_can_manage_member_departments"
on public.member_departments
for all
to authenticated
using (public.is_manager(auth.uid()))
with check (public.is_manager(auth.uid()));

grant select on table public.departments, public.profiles, public.member_departments to authenticated;
grant select, insert, update, delete on table public.departments, public.profiles, public.member_departments to authenticated;
grant execute on function public.login_email_by_employee_code(text) to anon, authenticated;
grant execute on function public.is_manager(uuid) to authenticated;

insert into public.profiles (
  id,
  employee_code,
  full_name,
  login_email,
  role,
  is_active
)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'employee_code'), ''),
    split_part(u.email, '@', 1)
  ) as employee_code,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1)
  ) as full_name,
  u.email as login_email,
  case
    when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) = 'manager' then 'manager'::public.app_role
    else 'employee'::public.app_role
  end as role,
  true as is_active
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
)
on conflict (id) do update
set
  login_email = excluded.login_email,
  full_name = excluded.full_name,
  is_active = true;

notify pgrst, 'reload schema';

commit;
