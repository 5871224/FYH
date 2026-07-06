begin;

create or replace function public.protect_employee_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into v_actor_role
  from public.set_employee
  where id = auth.uid();

  if v_actor_role = 'admin' then
    return new;
  end if;

  if v_actor_role = 'manager' then
    if tg_op = 'INSERT' and coalesce(new.role, 'employee') <> 'employee' then
      raise exception '主管只能建立員工帳號' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if old.role = 'admin' then
        raise exception '主管不可修改管理員資料' using errcode = '42501';
      end if;
      if new.role is distinct from old.role then
        raise exception '只有管理員可以變更角色' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  raise exception '沒有權限修改人員資料' using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_employee_role_changes on public.set_employee;
create trigger trg_protect_employee_role_changes
before insert or update on public.set_employee
for each row execute function public.protect_employee_role_changes();

create or replace function public.protect_department_attendance_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into v_actor_role
  from public.set_employee
  where id = auth.uid();

  if v_actor_role = 'admin' then
    return new;
  end if;

  if v_actor_role = 'manager' then
    if tg_op = 'INSERT' then
      new.address := null;
      new.latitude := null;
      new.longitude := null;
      new.attendance_enabled := false;
      return new;
    end if;
    if new.address is distinct from old.address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.attendance_enabled is distinct from old.attendance_enabled then
      raise exception '只有管理員可以修改打卡地址、座標與啟用設定' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception '沒有權限修改單位資料' using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_department_attendance_fields on public.set_departments;
create trigger trg_protect_department_attendance_fields
before insert or update on public.set_departments
for each row execute function public.protect_department_attendance_fields();

revoke select on table public.set_departments from authenticated;
grant select (
  id,
  name,
  start_date,
  end_date,
  hidden_from_schedule,
  sort_order,
  created_at,
  updated_at
) on table public.set_departments to authenticated;

grant select on table public.set_departments to service_role;

commit;
