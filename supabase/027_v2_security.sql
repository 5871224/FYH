begin;

create or replace function public.is_effective_user(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.set_employee e
    where e.id = p_user_id
      and e.is_active = true
      and (e.hire_date is null or e.hire_date <= (timezone('Asia/Taipei', now()))::date)
      and (e.leave_date is null or (timezone('Asia/Taipei', now()))::date <= e.leave_date + 5)
  )
$$;

alter table public.attendance_records
  add column if not exists clock_in_company_latitude double precision,
  add column if not exists clock_in_company_longitude double precision,
  add column if not exists clock_out_company_latitude double precision,
  add column if not exists clock_out_company_longitude double precision;

alter table public.attendance_action_logs
  add column if not exists reason text,
  add column if not exists old_record jsonb,
  add column if not exists new_record jsonb;

drop policy if exists read_scheduler_settings on public.scheduler_settings;
create policy read_scheduler_settings on public.scheduler_settings
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_set_departments on public.set_departments;
create policy read_set_departments on public.set_departments
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_department_attendance_settings on public.department_attendance_settings;
create policy read_department_attendance_settings on public.department_attendance_settings
for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists read_set_employee on public.set_employee;
create policy read_set_employee on public.set_employee
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_set_shift on public.set_shift;
create policy read_set_shift on public.set_shift
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_set_leave on public.set_leave;
create policy read_set_leave on public.set_leave
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_set_overtime on public.set_overtime;
create policy read_set_overtime on public.set_overtime
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_holidays on public.holidays;
create policy read_holidays on public.holidays
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_schedule_entries on public.schedule_entries;
create policy read_schedule_entries on public.schedule_entries
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_attendance_records on public.attendance_records;
create policy read_attendance_records on public.attendance_records
for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists read_attendance_logs on public.attendance_action_logs;
create policy read_attendance_logs on public.attendance_action_logs
for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists write_attendance_logs on public.attendance_action_logs;
create policy write_attendance_logs on public.attendance_action_logs
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists read_overtime_requests on public.attendance_overtime_requests;
create policy read_overtime_requests on public.attendance_overtime_requests
for select to authenticated
using (public.is_effective_user(auth.uid()) and (user_id = auth.uid() or public.is_admin(auth.uid())));

drop policy if exists write_overtime_requests on public.attendance_overtime_requests;

drop policy if exists read_meal_products on public.meal_products;
create policy read_meal_products on public.meal_products
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_meal_settings on public.meal_settings;
create policy read_meal_settings on public.meal_settings
for select to authenticated using (public.is_effective_user(auth.uid()));

drop policy if exists read_meal_orders on public.meal_orders;
create policy read_meal_orders on public.meal_orders
for select to authenticated
using (public.is_effective_user(auth.uid()) and (user_id = auth.uid() or public.is_manager(auth.uid())));

drop policy if exists write_meal_orders on public.meal_orders;

commit;
