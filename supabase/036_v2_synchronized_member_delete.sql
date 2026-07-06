begin;

alter table public.set_employee
  drop constraint if exists set_employee_auth_user_fkey;

alter table public.set_employee
  add constraint set_employee_auth_user_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;

create or replace function public.block_direct_employee_profile_delete_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception '人員資料不可單獨刪除，請由人員管理功能同步刪除登入帳號與人員資料'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_block_direct_employee_profile_delete_v2 on public.set_employee;
create trigger trg_block_direct_employee_profile_delete_v2
before delete on public.set_employee
for each row execute function public.block_direct_employee_profile_delete_v2();

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
  and exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.set_employee'::regclass
      and trigger_row.tgname = 'trg_block_direct_employee_profile_delete_v2'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
  )
$$;

revoke all on function public.has_synchronized_member_delete_v2()
from public, anon, authenticated;
grant execute on function public.has_synchronized_member_delete_v2()
to service_role;

commit;
