create or replace function public.delete_member_account_v3(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_has_history boolean := false;
begin
  select *
    into v_profile
    from public.set_employee
   where id = p_target_id
   for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'softDeleted', false
    );
  end if;

  select exists (
    select 1 from public.schedule_entries where member_id = p_target_id
    union all
    select 1 from public.attendance_records where user_id = p_target_id
    union all
    select 1 from public.attendance_overtime_requests where user_id = p_target_id
    union all
    select 1 from public.meal_orders where user_id = p_target_id
  ) into v_has_history;

  if v_has_history then
    update public.set_employee
       set is_active = false
     where id = p_target_id;

    return jsonb_build_object(
      'ok', true,
      'deleted', true,
      'softDeleted', true,
      'employeeCode', v_profile.employee_code
    );
  end if;

  -- Direct deletion from set_employee is blocked by a protection trigger.
  -- Delete the Auth user first so ON DELETE CASCADE performs the synchronized
  -- profile deletion through the permitted account-deletion path.
  delete from auth.users where id = p_target_id;

  if exists (select 1 from public.set_employee where id = p_target_id) then
    raise exception '登入帳號刪除後，人員資料未同步刪除';
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'softDeleted', false,
    'employeeCode', v_profile.employee_code
  );
end;
$$;

revoke all on function public.delete_member_account_v3(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v3(uuid) to service_role;
