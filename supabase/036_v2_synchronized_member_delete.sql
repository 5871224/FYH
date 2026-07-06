begin;

alter table public.set_employee
  drop constraint if exists set_employee_auth_user_fkey;

alter table public.set_employee
  add constraint set_employee_auth_user_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;

create or replace function public.has_synchronized_member_delete_v2()
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.set_employee'::regclass
      and constraint_row.conname = 'set_employee_auth_user_fkey'
      and constraint_row.contype = 'f'
  )
$$;

revoke all on function public.has_synchronized_member_delete_v2()
from public, anon, authenticated;
grant execute on function public.has_synchronized_member_delete_v2()
to service_role;

commit;
