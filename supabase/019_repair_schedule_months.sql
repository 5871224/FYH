begin;

-- 修復缺少 schedule_months 或 schedule_entries.schedule_month_id 的資料庫。
-- 常見原因：013 刪除舊表後，017 未完整套用，或 schedule_months 被誤刪。

create table if not exists public.schedule_months (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  month_start_day integer not null default 1 check (month_start_day between 1 and 31),
  name text,
  is_locked boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

alter table public.schedule_months enable row level security;

drop policy if exists "anon_can_read_schedule_months" on public.schedule_months;
drop policy if exists "authenticated_can_read_schedule_months" on public.schedule_months;
drop policy if exists "managers_can_manage_schedule_months" on public.schedule_months;

create policy "authenticated_can_read_schedule_months"
on public.schedule_months
for select
to authenticated
using (true);

create policy "managers_can_manage_schedule_months"
on public.schedule_months
for all
to authenticated
using (public.is_manager(auth.uid()))
with check (public.is_manager(auth.uid()));

alter table public.schedule_entries
  add column if not exists schedule_month_id uuid;

insert into public.schedule_months (year, month, month_start_day, name)
select distinct
  extract(year from se.work_date)::integer as year,
  extract(month from se.work_date)::integer as month,
  coalesce(
    (select month_start_day from public.scheduler_settings where id = 'default' limit 1),
    1
  ) as month_start_day,
  to_char(se.work_date, 'YYYY-MM') as name
from public.schedule_entries se
where se.work_date is not null
on conflict (year, month) do update
set month_start_day = excluded.month_start_day;

insert into public.schedule_months (year, month, month_start_day, name)
select
  coalesce(ss.current_year, extract(year from now())::integer) as year,
  coalesce(ss.current_month, 0) + 1 as month,
  coalesce(ss.month_start_day, 1) as month_start_day,
  format(
  '%s-%s',
  coalesce(ss.current_year, extract(year from now())::integer),
  lpad((coalesce(ss.current_month, 0) + 1)::text, 2, '0')
  ) as name
from public.scheduler_settings ss
where ss.id = 'default'
on conflict (year, month) do nothing;

update public.schedule_entries se
set schedule_month_id = sm.id
from public.schedule_months sm
where se.schedule_month_id is null
  and se.work_date is not null
  and sm.year = extract(year from se.work_date)::integer
  and sm.month = extract(month from se.work_date)::integer;

delete from public.schedule_entries
where schedule_month_id is null;

do $$
begin
  if exists (
    select 1
    from public.schedule_entries
    where schedule_month_id is null
  ) then
    raise exception '仍有 schedule_entries 無法對應 schedule_months，請先檢查 work_date';
  end if;
end $$;

alter table public.schedule_entries
  alter column schedule_month_id set not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'schedule_entries'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) not like '%schedule_month_id%'
  loop
    execute format('alter table public.schedule_entries drop constraint if exists %I', constraint_name);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.schedule_entries'::regclass
      and conname = 'schedule_entries_schedule_month_id_fkey'
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_schedule_month_id_fkey
      foreign key (schedule_month_id)
      references public.schedule_months (id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.schedule_entries'::regclass
      and conname = 'schedule_entries_schedule_month_id_member_id_work_date_key'
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_schedule_month_id_member_id_work_date_key
      unique (schedule_month_id, member_id, work_date);
  end if;
end $$;

grant select on table public.schedule_months to authenticated;
grant select, insert, update, delete on table public.schedule_months to authenticated;

notify pgrst, 'reload schema';

commit;
