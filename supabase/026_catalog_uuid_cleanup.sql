begin;

drop table if exists public.set_employee_departments;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_departments'
      and column_name = 'hidden_from_schedule'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'set_departments'
        and column_name = 'hidden_from_leave'
    ) then
      alter table public.set_departments
        rename column hidden_from_leave to hidden_from_schedule;
    else
      alter table public.set_departments
        add column hidden_from_schedule boolean not null default false;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_departments'
      and column_name = 'hidden_from_leave'
  ) then
    update public.set_departments
    set hidden_from_schedule = hidden_from_leave
    where hidden_from_leave = true;
  end if;
end $$;

do $$
begin
  alter table if exists public.set_shift
    add column if not exists hidden_from_toolbar boolean not null default false;
  alter table if exists public.set_leave
    add column if not exists hidden_from_toolbar boolean not null default false;
  alter table if exists public.set_overtime
    add column if not exists hidden_from_toolbar boolean not null default false;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_shift'
      and column_name = 'hidden_from_picker'
  ) then
    update public.set_shift
    set hidden_from_toolbar = hidden_from_picker
    where hidden_from_picker = true;
    alter table public.set_shift
      drop column hidden_from_picker;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_leave'
      and column_name = 'hidden_from_picker'
  ) then
    update public.set_leave
    set hidden_from_toolbar = hidden_from_picker
    where hidden_from_picker = true;
    alter table public.set_leave
      drop column hidden_from_picker;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_overtime'
      and column_name = 'hidden_from_picker'
  ) then
    update public.set_overtime
    set hidden_from_toolbar = hidden_from_picker
    where hidden_from_picker = true;
    alter table public.set_overtime
      drop column hidden_from_picker;
  end if;
end $$;

do $$
declare
  has_schedule_shift_ids boolean;
  has_shift_scheduler_item_id boolean;
  join_sql text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_employee'
      and column_name = 'schedule_shift_ids'
  ) into has_schedule_shift_ids;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_shift'
      and column_name = 'scheduler_item_id'
  ) into has_shift_scheduler_item_id;

  if has_schedule_shift_ids then
    alter table public.set_employee
      drop column if exists schedule_shift_uuid_ids;
    alter table public.set_employee
      add column schedule_shift_uuid_ids uuid[] not null default '{}';

    join_sql := 'shift_row.id::text = item.value::text';
    if has_shift_scheduler_item_id then
      join_sql := join_sql || ' or shift_row.scheduler_item_id = item.value::text';
    end if;

    execute format($sql$
      update public.set_employee employee
      set schedule_shift_uuid_ids = coalesce((
        select array_agg(shift_row.id order by item.ordinality)
        from unnest(employee.schedule_shift_ids) with ordinality as item(value, ordinality)
        join public.set_shift shift_row
          on %s
      ), '{}'::uuid[])
    $sql$, join_sql);

    alter table public.set_employee
      drop column schedule_shift_ids;
    alter table public.set_employee
      rename column schedule_shift_uuid_ids to schedule_shift_ids;
  else
    alter table public.set_employee
      add column schedule_shift_ids uuid[] not null default '{}';
  end if;
end $$;

do $$
declare
  has_applicable_department_ids boolean;
  has_department_scheduler_item_id boolean;
  join_sql text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_shift'
      and column_name = 'applicable_department_ids'
  ) into has_applicable_department_ids;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_departments'
      and column_name = 'scheduler_item_id'
  ) into has_department_scheduler_item_id;

  if has_applicable_department_ids then
    alter table public.set_shift
      drop column if exists applicable_department_uuid_ids;
    alter table public.set_shift
      add column applicable_department_uuid_ids uuid[] not null default '{}';

    join_sql := 'department.id::text = item.value::text';
    if has_department_scheduler_item_id then
      join_sql := join_sql || ' or department.scheduler_item_id = item.value::text';
    end if;

    execute format($sql$
      update public.set_shift shift_row
      set applicable_department_uuid_ids = coalesce((
        select array_agg(department.id order by item.ordinality)
        from unnest(shift_row.applicable_department_ids) with ordinality as item(value, ordinality)
        join public.set_departments department
          on %s
      ), '{}'::uuid[])
    $sql$, join_sql);

    alter table public.set_shift
      drop column applicable_department_ids;
    alter table public.set_shift
      rename column applicable_department_uuid_ids to applicable_department_ids;
  else
    alter table public.set_shift
      add column applicable_department_ids uuid[] not null default '{}';
  end if;
end $$;

alter table if exists public.set_departments
  drop column if exists code,
  drop column if exists scheduler_item_id,
  drop column if exists hidden_from_leave;

alter table if exists public.set_shift
  drop column if exists scheduler_item_id;

alter table if exists public.set_leave
  drop column if exists scheduler_item_id;

alter table if exists public.set_overtime
  drop column if exists scheduler_item_id;

alter table if exists public.holidays
  drop column if exists scheduler_item_id;

alter table if exists public.scheduler_settings
  drop column if exists max_consecutive_work_days,
  drop column if exists forbid_proxy_leave_conflict,
  drop column if exists require_employment_window;

commit;
