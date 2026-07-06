begin;

create or replace function public.is_effective_admin_row(
  p_role text,
  p_is_active boolean,
  p_hire_date date,
  p_leave_date date
)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') = 'admin'
    and coalesce(p_is_active, false) = true
    and (p_hire_date is null or p_hire_date <= (timezone('Asia/Taipei', now()))::date)
    and (p_leave_date is null or (timezone('Asia/Taipei', now()))::date <= p_leave_date + 5)
$$;

create or replace function public.protect_last_effective_admin_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_effective boolean;
  v_new_effective boolean := false;
  v_other_effective_admins integer;
begin
  v_old_effective := public.is_effective_admin_row(
    old.role,
    old.is_active,
    old.hire_date,
    old.leave_date
  );

  if not v_old_effective then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    v_new_effective := public.is_effective_admin_row(
      new.role,
      new.is_active,
      new.hire_date,
      new.leave_date
    );

    if v_new_effective
      and new.leave_date is null
      and (new.hire_date is null or new.hire_date <= (timezone('Asia/Taipei', now()))::date) then
      return new;
    end if;
  end if;

  select count(*) into v_other_effective_admins
  from public.set_employee employee
  where employee.id <> old.id
    and public.is_effective_admin_row(
      employee.role,
      employee.is_active,
      employee.hire_date,
      employee.leave_date
    );

  if v_other_effective_admins = 0 then
    raise exception '系統必須保留至少一個有效管理員；最後一位管理員不可刪除、降級、停用、設定未來到職日或離職日'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_last_effective_admin_v2 on public.set_employee;
create trigger trg_protect_last_effective_admin_v2
before update or delete on public.set_employee
for each row execute function public.protect_last_effective_admin_v2();

commit;
