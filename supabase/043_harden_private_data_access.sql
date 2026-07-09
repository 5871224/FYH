begin;

create or replace function public.get_employee_directory_v2()
returns table (
  id uuid,
  employee_code text,
  full_name text,
  role text,
  home_department_id uuid,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  schedule_department_ids text[],
  monthly_rest_days integer,
  fixed_rest_weekday integer,
  schedule_shift_ids uuid[],
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with actor as (
    select
      employee.id,
      employee.role in ('admin', 'manager') as manager_access,
      public.is_effective_user(employee.id) as effective
    from public.set_employee employee
    where employee.id = auth.uid()
  )
  select
    target.id,
    case when actor.manager_access or target.id = actor.id then target.employee_code else '' end,
    target.full_name,
    case when actor.manager_access or target.id = actor.id then target.role else 'employee' end,
    target.home_department_id,
    case when actor.manager_access or target.id = actor.id then target.position_name else null end,
    case when actor.manager_access or target.id = actor.id then target.hire_date else null end,
    case when actor.manager_access or target.id = actor.id then target.leave_date else null end,
    case when actor.manager_access or target.id = actor.id then target.pay_by_day else false end,
    target.is_active,
    target.created_at,
    target.updated_at,
    case when actor.manager_access or target.id = actor.id then target.schedule_department_ids else '{}'::text[] end,
    case when actor.manager_access or target.id = actor.id then target.monthly_rest_days else 0 end,
    case when actor.manager_access or target.id = actor.id then target.fixed_rest_weekday else 0 end,
    case when actor.manager_access or target.id = actor.id then target.schedule_shift_ids else '{}'::uuid[] end,
    target.sort_order
  from actor
  join public.set_employee target
    on target.id = actor.id
    or (actor.effective and target.is_active)
  order by target.sort_order, target.full_name, target.id
$$;

create or replace function public.get_department_directory_v2()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  start_date date,
  end_date date,
  hidden_from_schedule boolean,
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    department.id,
    department.name,
    department.created_at,
    department.updated_at,
    department.start_date,
    department.end_date,
    department.hidden_from_schedule,
    department.sort_order
  from public.set_departments department
  where public.is_effective_user(auth.uid())
  order by department.sort_order, department.name, department.id
$$;

revoke all on function public.get_employee_directory_v2() from public, anon;
revoke all on function public.get_department_directory_v2() from public, anon;
grant execute on function public.get_employee_directory_v2() to authenticated, service_role;
grant execute on function public.get_department_directory_v2() to authenticated, service_role;

drop policy if exists anon_can_read_scheduler_settings on public.scheduler_settings;
drop policy if exists anon_can_read_departments on public.set_departments;
drop policy if exists anon_can_read_set_departments on public.set_departments;
drop policy if exists anon_can_read_profiles on public.set_employee;
drop policy if exists anon_can_read_set_employee on public.set_employee;
drop policy if exists anon_can_read_shift_types on public.set_shift;
drop policy if exists anon_can_read_set_shift on public.set_shift;
drop policy if exists anon_can_read_leave_types on public.set_leave;
drop policy if exists anon_can_read_set_leave on public.set_leave;
drop policy if exists anon_can_read_overtime_types on public.set_overtime;
drop policy if exists anon_can_read_set_overtime on public.set_overtime;
drop policy if exists anon_can_read_holidays on public.holidays;
drop policy if exists anon_can_read_schedule_entries on public.schedule_entries;

drop policy if exists authenticated_can_read_scheduler_settings on public.scheduler_settings;
drop policy if exists authenticated_can_read_departments on public.set_departments;
drop policy if exists authenticated_can_read_set_departments on public.set_departments;
drop policy if exists users_can_read_profiles on public.set_employee;
drop policy if exists users_can_read_set_employee on public.set_employee;
drop policy if exists users_can_update_own_profile_basic_fields on public.set_employee;
drop policy if exists authenticated_can_read_shift_types on public.set_shift;
drop policy if exists authenticated_can_read_set_shift on public.set_shift;
drop policy if exists authenticated_can_read_leave_types on public.set_leave;
drop policy if exists authenticated_can_read_set_leave on public.set_leave;
drop policy if exists authenticated_can_read_overtime_types on public.set_overtime;
drop policy if exists authenticated_can_read_set_overtime on public.set_overtime;
drop policy if exists authenticated_can_read_holidays on public.holidays;
drop policy if exists authenticated_can_read_schedule_entries on public.schedule_entries;

drop policy if exists managers_can_manage_scheduler_settings on public.scheduler_settings;
drop policy if exists managers_can_manage_departments on public.set_departments;
drop policy if exists managers_can_manage_set_departments on public.set_departments;
drop policy if exists managers_can_manage_profiles on public.set_employee;
drop policy if exists managers_can_manage_set_employee on public.set_employee;
drop policy if exists managers_can_manage_shift_types on public.set_shift;
drop policy if exists managers_can_manage_set_shift on public.set_shift;
drop policy if exists managers_can_manage_leave_types on public.set_leave;
drop policy if exists managers_can_manage_set_leave on public.set_leave;
drop policy if exists managers_can_manage_overtime_types on public.set_overtime;
drop policy if exists managers_can_manage_set_overtime on public.set_overtime;
drop policy if exists managers_can_manage_holidays on public.holidays;
drop policy if exists managers_can_manage_schedule_entries on public.schedule_entries;

revoke select on public.scheduler_settings from anon;
revoke select on public.set_departments from anon;
revoke select on public.set_employee from anon;
revoke select on public.set_shift from anon;
revoke select on public.set_leave from anon;
revoke select on public.set_overtime from anon;
revoke select on public.holidays from anon;
revoke select on public.schedule_entries from anon;

revoke select on public.set_employee from authenticated;
revoke select on public.set_departments from authenticated;
grant select (id, employee_code) on public.set_employee to authenticated;
grant select (id) on public.set_departments to authenticated;

revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.is_manager(uuid) from public, anon;
revoke all on function public.is_effective_user(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.is_manager(uuid) to authenticated, service_role;
grant execute on function public.is_effective_user(uuid) to authenticated, service_role;

revoke all on function public.block_direct_employee_profile_delete_v2() from public, anon, authenticated;
revoke all on function public.protect_admin_member() from public, anon, authenticated;
revoke all on function public.protect_department_attendance_fields() from public, anon, authenticated;
revoke all on function public.protect_employee_role_changes() from public, anon, authenticated;
revoke all on function public.protect_last_effective_admin_v2() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_schedule_documents_updated_at() from public, anon, authenticated;
revoke all on function public.is_effective_admin_row(text, boolean, date, date) from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public, pg_catalog;
alter function public.set_schedule_documents_updated_at() set search_path = public, pg_catalog;
alter function public.is_effective_admin_row(text, boolean, date, date) set search_path = public, pg_catalog;

drop index if exists public.idx_attendance_overtime_active_user_date;
drop index if exists public.idx_profiles_home_department_id;
drop index if exists public.idx_set_employee_home_department;
drop index if exists public.idx_shift_types_applicable_department_id;
drop index if exists public.idx_schedule_entries_member_date;

create index if not exists idx_attendance_action_logs_operator_user_id on public.attendance_action_logs(operator_user_id);
create index if not exists idx_attendance_overtime_created_by_user_id on public.attendance_overtime_requests(created_by_user_id);
create index if not exists idx_attendance_overtime_deleted_by on public.attendance_overtime_requests(deleted_by);
create index if not exists idx_attendance_overtime_reviewed_by on public.attendance_overtime_requests(reviewed_by);
create index if not exists idx_attendance_records_clock_in_department_id on public.attendance_records(clock_in_department_id);
create index if not exists idx_attendance_records_clock_out_department_id on public.attendance_records(clock_out_department_id);
create index if not exists idx_meal_orders_clock_location_id on public.meal_orders(clock_location_id);
create index if not exists idx_meal_orders_department_id on public.meal_orders(department_id);
create index if not exists idx_meal_orders_product_id on public.meal_orders(product_id);
create index if not exists idx_meal_settings_updated_by on public.meal_settings(updated_by);
create index if not exists idx_overtime_review_logs_operator_user_id on public.overtime_review_logs(operator_user_id);
create index if not exists idx_schedule_entries_shift_type_id on public.schedule_entries(shift_type_id);
create index if not exists idx_schedule_entries_support_department_id on public.schedule_entries(support_department_id);
create index if not exists idx_set_departments_attendance_settings_updated_by on public.set_departments(attendance_settings_updated_by);

commit;
