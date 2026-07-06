begin;

alter table public.set_employee enable row level security;
alter table public.schedule_entries enable row level security;

drop policy if exists v2_restrict_employee_directory on public.set_employee;
create policy v2_restrict_employee_directory
on public.set_employee
as restrictive
for select
to authenticated
using (
  public.is_effective_user(auth.uid())
  and (
    id = auth.uid()
    or public.is_manager(auth.uid())
  )
);

drop policy if exists v2_restrict_schedule_visibility on public.schedule_entries;
create policy v2_restrict_schedule_visibility
on public.schedule_entries
as restrictive
for select
to authenticated
using (
  public.is_effective_user(auth.uid())
  and (
    member_id = auth.uid()
    or public.is_manager(auth.uid())
  )
);

commit;
