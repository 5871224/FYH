begin;

alter table public.set_shift
  add column if not exists applicable_department_id uuid;

do $$
declare
  fallback_department_id uuid;
begin
  select id
  from public.set_departments
  order by sort_order, name, id
  limit 1
  into fallback_department_id;

  update public.set_shift
  set applicable_department_id = fallback_department_id
  where applicable_department_id is null;

  if exists (select 1 from public.set_shift where applicable_department_id is null) then
    raise exception 'set_shift.applicable_department_id requires at least one department before migration';
  end if;
end $$;

alter table public.set_shift
  alter column applicable_department_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.set_shift'::regclass
      and conname = 'set_shift_applicable_department_id_fkey'
  ) then
    alter table public.set_shift
      add constraint set_shift_applicable_department_id_fkey
      foreign key (applicable_department_id)
      references public.set_departments (id)
      on delete restrict;
  end if;
end $$;

alter table public.set_shift
  drop column if exists applicable_department_ids;

commit;
