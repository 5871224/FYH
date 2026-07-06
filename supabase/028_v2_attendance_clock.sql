begin;

create or replace function public.save_attendance_clock(
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_location jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := (timezone('Asia/Taipei', v_now))::date;
  v_employee public.set_employee%rowtype;
  v_department public.set_departments%rowtype;
  v_record public.attendance_records%rowtype;
  v_department_id uuid := nullif(p_location->>'departmentId', '')::uuid;
  v_source text := coalesce(nullif(p_location->>'source', ''), 'IP');
  v_latitude double precision := nullif(p_location->>'latitude', '')::double precision;
  v_longitude double precision := nullif(p_location->>'longitude', '')::double precision;
  v_accuracy double precision := nullif(p_location->>'accuracy', '')::double precision;
  v_distance double precision := nullif(p_location->>'distance', '')::double precision;
  v_ip text := coalesce(p_location->>'ip', '');
begin
  if p_user_id is null or p_work_date is null then
    raise exception '缺少打卡人員或日期' using errcode = '23502';
  end if;
  if p_work_date <> v_today then
    raise exception '員工只能打伺服器當日的卡' using errcode = '23514';
  end if;
  if p_kind not in ('clock_in', 'clock_out') then
    raise exception '不支援的打卡操作' using errcode = '22023';
  end if;
  if v_source not in ('GPS', 'IP') then
    raise exception '不支援的打卡來源' using errcode = '22023';
  end if;

  select * into v_employee
  from public.set_employee
  where id = p_user_id;
  if not found
    or v_employee.is_active is not true
    or (v_employee.hire_date is not null and v_today < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_today > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法打卡' using errcode = '42501';
  end if;

  select * into v_department
  from public.set_departments
  where id = v_department_id
    and attendance_enabled = true;
  if not found then
    raise exception '打卡單位未啟用或不存在' using errcode = '23503';
  end if;

  insert into public.attendance_records (
    user_id, work_date, employee_code_snapshot, employee_name_snapshot, created_at, updated_at
  ) values (
    p_user_id, p_work_date, coalesce(v_employee.employee_code, ''), coalesce(v_employee.full_name, ''), v_now, v_now
  )
  on conflict (user_id, work_date) do nothing;

  if p_kind = 'clock_in' then
    update public.attendance_records
    set employee_code_snapshot = coalesce(v_employee.employee_code, ''),
        employee_name_snapshot = coalesce(v_employee.full_name, ''),
        clock_in_at = v_now,
        clock_in_department_id = v_department.id,
        clock_in_department_name_snapshot = coalesce(v_department.name, ''),
        clock_in_address_snapshot = coalesce(v_department.address, ''),
        clock_in_company_latitude = v_department.latitude,
        clock_in_company_longitude = v_department.longitude,
        clock_in_source = v_source,
        clock_in_latitude = v_latitude,
        clock_in_longitude = v_longitude,
        clock_in_accuracy = v_accuracy,
        clock_in_distance = v_distance,
        clock_in_ip = v_ip,
        updated_at = v_now
    where user_id = p_user_id
      and work_date = p_work_date
      and clock_in_at is null
      and clock_out_at is null
    returning * into v_record;
  else
    update public.attendance_records
    set employee_code_snapshot = coalesce(v_employee.employee_code, ''),
        employee_name_snapshot = coalesce(v_employee.full_name, ''),
        clock_out_at = v_now,
        clock_out_department_id = v_department.id,
        clock_out_department_name_snapshot = coalesce(v_department.name, ''),
        clock_out_address_snapshot = coalesce(v_department.address, ''),
        clock_out_company_latitude = v_department.latitude,
        clock_out_company_longitude = v_department.longitude,
        clock_out_source = v_source,
        clock_out_latitude = v_latitude,
        clock_out_longitude = v_longitude,
        clock_out_accuracy = v_accuracy,
        clock_out_distance = v_distance,
        clock_out_ip = v_ip,
        updated_at = v_now
    where user_id = p_user_id
      and work_date = p_work_date
      and clock_out_at is null
    returning * into v_record;
  end if;

  if not found then
    select * into v_record
    from public.attendance_records
    where user_id = p_user_id and work_date = p_work_date;

    if p_kind = 'clock_in' and v_record.clock_out_at is not null then
      raise exception '已有下班打卡紀錄，無法再補上班打卡' using errcode = '23514';
    end if;

    return jsonb_build_object(
      'ok', true,
      'record', to_jsonb(v_record),
      'duplicate', true,
      'serverDate', p_work_date::text
    );
  end if;

  insert into public.attendance_action_logs (
    attendance_record_id, action_type, operator_user_id, operator_name_snapshot, new_record
  ) values (
    v_record.id, p_kind, v_employee.id, coalesce(v_employee.full_name, ''), to_jsonb(v_record)
  );

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_record),
    'duplicate', false,
    'serverDate', p_work_date::text
  );
end;
$$;

revoke all on function public.save_attendance_clock(uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_attendance_clock(uuid, date, text, jsonb) to service_role;

commit;
