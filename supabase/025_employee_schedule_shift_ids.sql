alter table if exists public.set_employee
  add column if not exists schedule_shift_ids text[] not null default '{}';

alter table if exists public.set_employee
  drop column if exists schedule_department_ids;

drop table if exists public.set_employee_departments;

alter table if exists public.set_shift
  add column if not exists applicable_department_ids text[] not null default '{}';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'set_shift'
      and column_name = 'applicable_department_id'
  ) then
    execute $sql$
      update public.set_shift shift
      set applicable_department_ids = array[department.scheduler_item_id]
      from public.set_departments department
      where shift.applicable_department_id = department.id
        and coalesce(array_length(shift.applicable_department_ids, 1), 0) = 0
        and department.scheduler_item_id is not null
    $sql$;
    execute 'alter table public.set_shift drop column applicable_department_id';
  end if;
end $$;
