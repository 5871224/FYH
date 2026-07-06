begin;

alter table public.set_employee enable row level security;
alter table public.schedule_entries enable row level security;

drop policy if exists v2_restrict_employee_directory on public.set_employee;
drop policy if exists v2_restrict_schedule_visibility on public.schedule_entries;
drop policy if exists read_set_employee on public.set_employee;
drop policy if exists read_schedule_entries on public.schedule_entries;

create policy read_set_employee on public.set_employee
for select to authenticated
using (true);

create policy read_schedule_entries on public.schedule_entries
for select to authenticated
using (true);

commit;
