-- 福圓號目前正式 PostgreSQL 索引、資料完整性 helper 與初始設定
-- 執行順序：先執行 001_current_schema.sql，再執行本檔。
-- 不使用 Supabase Auth、RLS、anon/authenticated/service_role、browser RPC 或 Edge Function。

begin;

create index if not exists idx_access_role_groups_group
  on public.access_role_groups(group_id, role_id);
create index if not exists idx_access_roles_sort
  on public.access_roles(sort_order, name, id);

create unique index if not exists ux_auth_accounts_login_account
  on public.auth_accounts(lower(login_account));
create index if not exists idx_auth_sessions_employee_id
  on public.auth_sessions(employee_id);
create index if not exists idx_auth_sessions_expires_at
  on public.auth_sessions(expires_at);

create index if not exists idx_department_group_active
  on public.set_departments(group_id, deleted_at, sort_order);
create index if not exists idx_set_departments_attendance_enabled
  on public.set_departments(attendance_enabled);
create index if not exists idx_set_departments_attendance_settings_updated_by
  on public.set_departments(attendance_settings_updated_by);

create index if not exists idx_employee_group_active
  on public.set_employee(group_id, deleted_at, sort_order);
create index if not exists idx_set_employee_access_role_id
  on public.set_employee(access_role_id);
create index if not exists idx_set_employee_home_department_id
  on public.set_employee(home_department_id);
create unique index if not exists set_employee_employee_code_lower_key
  on public.set_employee(lower(btrim(employee_code)));
create index if not exists set_employee_sort_order_idx
  on public.set_employee(sort_order, employee_code, id);

create index if not exists idx_shift_group_active
  on public.set_shift(group_id, deleted_at, sort_order);
create index if not exists idx_set_shift_applicable_department_id
  on public.set_shift(applicable_department_id);
create unique index if not exists idx_set_leave_code
  on public.set_leave(code);
create index if not exists idx_set_leave_active_sort
  on public.set_leave(sort_order, code, id)
  where deleted_at is null;
create index if not exists idx_set_overtime_active_sort
  on public.set_overtime(sort_order, name, id)
  where deleted_at is null;

create index if not exists idx_schedule_groups_active_sort
  on public.schedule_groups(deleted_at, status, sort_order);
create index if not exists idx_schedule_entries_work_date
  on public.schedule_entries(work_date);
create index if not exists idx_schedule_entries_group_date
  on public.schedule_entries(group_id, work_date);
create index if not exists idx_schedule_entries_support_department_id
  on public.schedule_entries(support_department_id);
create index if not exists idx_schedule_entries_shift_type_id
  on public.schedule_entries(shift_type_id);
create index if not exists idx_schedule_entries_leave_type_id
  on public.schedule_entries(leave_type_id);
create index if not exists idx_schedule_entries_overtime_type_id
  on public.schedule_entries(overtime_type_id);
create index if not exists idx_schedule_archives_group_dates
  on public.schedule_archives(group_id, start_date, end_date);
create index if not exists idx_schedule_archives_archived_by
  on public.schedule_archives(archived_by);
create index if not exists idx_schedule_archive_entries_archive_date
  on public.schedule_archive_entries(archive_id, work_date, department_sort_order, member_sort_order);

create index if not exists attendance_days_work_date_idx
  on public.attendance_days(work_date desc);
create index if not exists attendance_days_reviewed_idx
  on public.attendance_days(reviewed_at, work_date desc);
create index if not exists idx_attendance_days_group_id
  on public.attendance_days(group_id);
create index if not exists idx_attendance_days_reviewed_by
  on public.attendance_days(reviewed_by);
create index if not exists attendance_audit_logs_day_idx
  on public.attendance_audit_logs(attendance_day_id, created_at desc);
create index if not exists idx_attendance_audit_logs_changed_by
  on public.attendance_audit_logs(changed_by);

create index if not exists idx_meal_products_active_sort
  on public.meal_products(is_active, sort_order, name);
create index if not exists idx_meal_settings_updated_by
  on public.meal_settings(updated_by);
create index if not exists idx_meal_orders_date_department
  on public.meal_orders(order_date, department_id);
create index if not exists idx_meal_orders_user_date
  on public.meal_orders(user_id, order_date desc);
create index if not exists idx_meal_orders_order_id
  on public.meal_orders(order_id);
create index if not exists idx_meal_orders_department_id
  on public.meal_orders(department_id);
create index if not exists idx_meal_orders_attendance_department_id
  on public.meal_orders(attendance_department_id);
create index if not exists idx_meal_orders_product_id
  on public.meal_orders(product_id);
create index if not exists idx_meal_orders_group_id
  on public.meal_orders(group_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_employee_employed_on(
  p_hire_date date,
  p_leave_date date,
  p_date date
)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select p_date is not null
    and (p_hire_date is null or p_hire_date <= p_date)
    and (p_leave_date is null or p_date <= p_leave_date)
$$;

create or replace function public.is_employee_account_effective(
  p_hire_date date,
  p_leave_date date,
  p_date date
)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select p_date is not null
    and (p_hire_date is null or p_hire_date <= p_date)
    and (p_leave_date is null or p_date <= p_leave_date + 5)
$$;

create or replace function public.is_schedule_date_archived(
  p_group_id uuid,
  p_work_date date
)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.schedule_archives archive
    where archive.group_id = p_group_id
      and p_work_date between archive.start_date and archive.end_date
  )
$$;

create or replace function public.set_shift_group_v1()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_group_id uuid;
begin
  if new.applicable_department_id is null then
    raise exception '班別必須綁定單位';
  end if;

  select department.group_id
  into v_group_id
  from public.set_departments department
  where department.id = new.applicable_department_id
    and department.deleted_at is null;

  if v_group_id is null then
    raise exception '班別所屬單位尚未設定群組或已刪除';
  end if;
  if new.group_id is not null and new.group_id <> v_group_id then
    raise exception '班別群組必須與所屬單位一致';
  end if;

  new.group_id := v_group_id;
  return new;
end;
$$;

create or replace function public.set_schedule_entry_group_v1()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_member public.set_employee%rowtype;
  v_existing public.schedule_entries%rowtype;
begin
  select * into v_member
  from public.set_employee
  where id = new.member_id;

  if not found or v_member.group_id is null then
    raise exception '排班人員尚未設定群組或已刪除';
  end if;
  if v_member.deleted_at is not null then
    raise exception '已刪除人員不可新增或修改班表；只能刪除原有班表';
  end if;
  if new.group_id is not null and new.group_id <> v_member.group_id then
    raise exception '班表群組必須與人員所屬群組一致';
  end if;

  select * into v_existing
  from public.schedule_entries
  where member_id = new.member_id
    and work_date = new.work_date;

  if new.support_department_id is not null and not exists (
    select 1
    from public.set_departments department
    where department.id = new.support_department_id
      and department.group_id = v_member.group_id
      and (
        department.deleted_at is null
        or (v_existing.id is not null and v_existing.support_department_id = department.id)
      )
  ) then
    raise exception '支援單位不在人員所屬群組或已刪除';
  end if;

  if new.shift_type_id is not null and not exists (
    select 1
    from public.set_shift shift
    where shift.id = new.shift_type_id
      and shift.group_id = v_member.group_id
      and (
        shift.deleted_at is null
        or (v_existing.id is not null and v_existing.shift_type_id = shift.id)
      )
  ) then
    raise exception '班別不在人員所屬群組或已刪除';
  end if;

  if new.leave_type_id is not null and not exists (
    select 1
    from public.set_leave leave_type
    where leave_type.id = new.leave_type_id
      and (
        leave_type.deleted_at is null
        or (v_existing.id is not null and v_existing.leave_type_id = leave_type.id)
      )
  ) then
    raise exception '假別已刪除，不可重新選用';
  end if;

  if new.overtime_type_id is not null and not exists (
    select 1
    from public.set_overtime overtime_type
    where overtime_type.id = new.overtime_type_id
      and (
        overtime_type.deleted_at is null
        or (v_existing.id is not null and v_existing.overtime_type_id = overtime_type.id)
      )
  ) then
    raise exception '加班設定已刪除，不可重新選用';
  end if;

  new.group_id := v_member.group_id;
  return new;
end;
$$;

create or replace function public.protect_archived_schedule_v1()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_old_group_id uuid;
  v_new_group_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_group_id := old.group_id;
    if v_old_group_id is null then
      select employee.group_id into v_old_group_id
      from public.set_employee employee
      where employee.id = old.member_id;
    end if;
    if public.is_schedule_date_archived(v_old_group_id, old.work_date) then
      raise exception '此期間班表已封存，不可變動' using errcode = '55000';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_group_id := new.group_id;
    if v_new_group_id is null then
      select employee.group_id into v_new_group_id
      from public.set_employee employee
      where employee.id = new.member_id;
    end if;
    if public.is_schedule_date_archived(v_new_group_id, new.work_date) then
      raise exception '此期間班表已封存，不可變動' using errcode = '55000';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.stamp_attendance_group_v1()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_group_id uuid;
  v_group_name text;
  v_department_name text;
begin
  if new.group_id is null
     or coalesce(new.group_name_snapshot, '') = ''
     or coalesce(new.department_name_snapshot, '') = '' then
    select employee.group_id, grp.name, department.name
    into v_group_id, v_group_name, v_department_name
    from public.set_employee employee
    left join public.schedule_groups grp on grp.id = employee.group_id
    left join public.set_departments department on department.id = employee.home_department_id
    where employee.id = new.user_id;

    new.group_id := coalesce(new.group_id, v_group_id);
    new.group_name_snapshot := coalesce(nullif(new.group_name_snapshot, ''), v_group_name, '');
    new.department_name_snapshot := coalesce(nullif(new.department_name_snapshot, ''), v_department_name, '');
  end if;
  return new;
end;
$$;

create or replace function public.stamp_meal_group_v1()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_group_id uuid;
  v_group_name text;
begin
  if new.group_id is null or coalesce(new.group_name_snapshot, '') = '' then
    select employee.group_id, grp.name
    into v_group_id, v_group_name
    from public.set_employee employee
    left join public.schedule_groups grp on grp.id = employee.group_id
    where employee.id = new.user_id;

    new.group_id := coalesce(new.group_id, v_group_id);
    new.group_name_snapshot := coalesce(nullif(new.group_name_snapshot, ''), v_group_name, '');
  end if;
  return new;
end;
$$;

drop trigger if exists set_updated_at_departments on public.set_departments;
create trigger set_updated_at_departments
before update on public.set_departments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_profiles on public.set_employee;
create trigger set_updated_at_profiles
before update on public.set_employee
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_shift_types on public.set_shift;
create trigger set_updated_at_shift_types
before update on public.set_shift
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_leave_types on public.set_leave;
create trigger set_updated_at_leave_types
before update on public.set_leave
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_overtime_types on public.set_overtime;
create trigger set_updated_at_overtime_types
before update on public.set_overtime
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_schedule_entries on public.schedule_entries;
create trigger set_updated_at_schedule_entries
before update on public.schedule_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_days_updated_at on public.attendance_days;
create trigger set_attendance_days_updated_at
before update on public.attendance_days
for each row execute function public.set_updated_at();

drop trigger if exists trg_set_shift_group on public.set_shift;
create trigger trg_set_shift_group
before insert or update on public.set_shift
for each row execute function public.set_shift_group_v1();

drop trigger if exists trg_schedule_entries_set_group on public.schedule_entries;
create trigger trg_schedule_entries_set_group
before insert or update on public.schedule_entries
for each row execute function public.set_schedule_entry_group_v1();

drop trigger if exists trg_schedule_entries_protect_archive on public.schedule_entries;
create trigger trg_schedule_entries_protect_archive
before insert or update or delete on public.schedule_entries
for each row execute function public.protect_archived_schedule_v1();

drop trigger if exists trg_attendance_days_stamp_group on public.attendance_days;
create trigger trg_attendance_days_stamp_group
before insert or update on public.attendance_days
for each row execute function public.stamp_attendance_group_v1();

drop trigger if exists trg_meal_orders_stamp_group on public.meal_orders;
create trigger trg_meal_orders_stamp_group
before insert or update on public.meal_orders
for each row execute function public.stamp_meal_group_v1();

insert into public.schedule_groups(code, name, meal_enabled, status, sort_order)
values ('STORE', '門市', true, 'active', 0)
on conflict (code) do update
set name = excluded.name,
    meal_enabled = excluded.meal_enabled,
    status = excluded.status,
    sort_order = excluded.sort_order,
    deleted_at = null,
    updated_at = now();

insert into public.access_roles(code, name, permissions, is_system, sort_order)
values
  ('admin', '管理員', array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin'], true, 0),
  ('manager', '主管', array['schedule_view','schedule_manage','department_settings','member_settings','leave_settings','attendance_review','meal_admin'], true, 1),
  ('employee', '員工', array['schedule_view'], true, 2)
on conflict (code) do update
set name = excluded.name,
    permissions = excluded.permissions,
    is_system = excluded.is_system,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.access_role_groups(role_id, group_id)
select role.id, grp.id
from public.access_roles role
cross join public.schedule_groups grp
where role.code in ('admin', 'manager', 'employee')
  and grp.code = 'STORE'
on conflict do nothing;

insert into public.scheduler_settings(id)
values ('default')
on conflict (id) do nothing;

insert into public.meal_settings(id)
values ('default')
on conflict (id) do nothing;

-- 內部 helper 不作為瀏覽器 RPC。資料庫擁有者／後端連線仍可使用。
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

commit;
