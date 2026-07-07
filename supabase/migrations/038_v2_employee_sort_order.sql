begin;

alter table public.set_employee
  add column if not exists sort_order integer;

with ranked as (
  select
    id,
    row_number() over (
      order by coalesce(sort_order, 2147483647), employee_code, full_name, id
    ) - 1 as next_sort_order
  from public.set_employee
)
update public.set_employee as employee
set sort_order = ranked.next_sort_order
from ranked
where ranked.id = employee.id;

alter table public.set_employee
  alter column sort_order set default 0;

update public.set_employee
set sort_order = 0
where sort_order is null;

alter table public.set_employee
  alter column sort_order set not null;

create index if not exists set_employee_sort_order_idx
  on public.set_employee (sort_order, employee_code, id);

commit;
