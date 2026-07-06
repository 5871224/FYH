begin;

drop function if exists public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid);

create or replace function public.admin_update_attendance_record(
  p_record_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_clock_in_at timestamptz,
  p_clock_in_department_id uuid,
  p_clock_out_at timestamptz,
  p_clock_out_department_id uuid,
  p_attendance_note text,
  p_operator_user_id uuid,
  p_reason text default ''
)
returns public.attendance_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_operator public.set_employee%rowtype;
  v_employee public.set_employee%rowtype;
  v_in_department public.set_departments%rowtype;
  v_out_department public.set_departments%rowtype;
  v_old public.attendance_records%rowtype;
  v_new public.attendance_records%rowtype;
  v_record_id uuid := p_record_id;
  v_in_changed boolean := false;
  v_out_changed boolean := false;
begin
  select * into v_operator from public.set_employee where id = p_operator_user_id;
  if not found or v_operator.role <> 'admin' then
    raise exception '此功能限管理員使用' using errcode = '42501';
  end if;
  if p_user_id is null or p_work_date is null then
    raise exception '缺少人員或日期' using errcode = '23502';
  end if;

  select * into v_employee from public.set_employee where id = p_user_id;
  if not found then
    raise exception '找不到打卡人員' using errcode = '23503';
  end if;

  if p_clock_in_at is not null and p_clock_in_department_id is null then
    raise exception '補登上班時間時必須選擇上班單位' using errcode = '23502';
  end if;
  if p_clock_out_at is not null and p_clock_out_department_id is null then
    raise exception '補登下班時間時必須選擇下班單位' using errcode = '23502';
  end if;

  if p_clock_in_department_id is not null then
    select * into v_in_department from public.set_departments where id = p_clock_in_department_id;
    if not found then raise exception '找不到上班打卡單位' using errcode = '23503'; end if;
  end if;
  if p_clock_out_department_id is not null then
    select * into v_out_department from public.set_departments where id = p_clock_out_department_id;
    if not found then raise exception '找不到下班打卡單位' using errcode = '23503'; end if;
  end if;

  if v_record_id is not null then
    select * into v_old from public.attendance_records where id = v_record_id for update;
  else
    select * into v_old
    from public.attendance_records
    where user_id = p_user_id and work_date = p_work_date
    for update;
  end if;

  if v_old.id is null then
    insert into public.attendance_records (
      user_id, work_date, employee_code_snapshot, employee_name_snapshot, created_at, updated_at
    ) values (
      p_user_id, p_work_date, coalesce(v_employee.employee_code, ''), coalesce(v_employee.full_name, ''), v_now, v_now
    ) returning * into v_old;
  end if;

  v_in_changed := v_old.clock_in_at is distinct from p_clock_in_at
    or v_old.clock_in_department_id is distinct from (case when p_clock_in_at is null then null else p_clock_in_department_id end);
  v_out_changed := v_old.clock_out_at is distinct from p_clock_out_at
    or v_old.clock_out_department_id is distinct from (case when p_clock_out_at is null then null else p_clock_out_department_id end);

  update public.attendance_records
  set employee_code_snapshot = coalesce(v_employee.employee_code, ''),
      employee_name_snapshot = coalesce(v_employee.full_name, ''),
      clock_in_at = p_clock_in_at,
      clock_in_department_id = case when p_clock_in_at is null then null else p_clock_in_department_id end,
      clock_in_department_name_snapshot = case when p_clock_in_at is null then null when v_in_changed then coalesce(v_in_department.name, '') else v_old.clock_in_department_name_snapshot end,
      clock_in_address_snapshot = case when p_clock_in_at is null then null when v_in_changed then coalesce(v_in_department.address, '') else v_old.clock_in_address_snapshot end,
      clock_in_company_latitude = case when p_clock_in_at is null then null when v_in_changed then v_in_department.latitude else v_old.clock_in_company_latitude end,
      clock_in_company_longitude = case when p_clock_in_at is null then null when v_in_changed then v_in_department.longitude else v_old.clock_in_company_longitude end,
      clock_in_source = case when p_clock_in_at is null then null when v_in_changed then '管理員補登' else v_old.clock_in_source end,
      clock_in_latitude = case when v_in_changed then null else v_old.clock_in_latitude end,
      clock_in_longitude = case when v_in_changed then null else v_old.clock_in_longitude end,
      clock_in_accuracy = case when v_in_changed then null else v_old.clock_in_accuracy end,
      clock_in_distance = case when v_in_changed then null else v_old.clock_in_distance end,
      clock_in_ip = case when v_in_changed then null else v_old.clock_in_ip end,
      clock_out_at = p_clock_out_at,
      clock_out_department_id = case when p_clock_out_at is null then null else p_clock_out_department_id end,
      clock_out_department_name_snapshot = case when p_clock_out_at is null then null when v_out_changed then coalesce(v_out_department.name, '') else v_old.clock_out_department_name_snapshot end,
      clock_out_address_snapshot = case when p_clock_out_at is null then null when v_out_changed then coalesce(v_out_department.address, '') else v_old.clock_out_address_snapshot end,
      clock_out_company_latitude = case when p_clock_out_at is null then null when v_out_changed then v_out_department.latitude else v_old.clock_out_company_latitude end,
      clock_out_company_longitude = case when p_clock_out_at is null then null when v_out_changed then v_out_department.longitude else v_old.clock_out_company_longitude end,
      clock_out_source = case when p_clock_out_at is null then null when v_out_changed then '管理員補登' else v_old.clock_out_source end,
      clock_out_latitude = case when v_out_changed then null else v_old.clock_out_latitude end,
      clock_out_longitude = case when v_out_changed then null else v_old.clock_out_longitude end,
      clock_out_accuracy = case when v_out_changed then null else v_old.clock_out_accuracy end,
      clock_out_distance = case when v_out_changed then null else v_old.clock_out_distance end,
      clock_out_ip = case when v_out_changed then null else v_old.clock_out_ip end,
      attendance_note = nullif(trim(coalesce(p_attendance_note, '')), ''),
      updated_at = v_now
  where id = v_old.id
  returning * into v_new;

  insert into public.attendance_action_logs (
    attendance_record_id, action_type, field_name, old_value, new_value,
    operator_user_id, operator_name_snapshot, reason, old_record, new_record
  )
  select v_new.id,
         case
           when diff.field_name in ('clock_in_at', 'clock_in_department_id') and p_clock_in_at is null then 'admin_void_clock_in'
           when diff.field_name in ('clock_out_at', 'clock_out_department_id') and p_clock_out_at is null then 'admin_void_clock_out'
           else 'admin_update'
         end,
         diff.field_name,
         diff.old_value,
         diff.new_value,
         v_operator.id,
         coalesce(v_operator.full_name, ''),
         nullif(trim(coalesce(p_reason, '')), ''),
         to_jsonb(v_old),
         to_jsonb(v_new)
  from (
    values
      ('clock_in_at', v_old.clock_in_at::text, v_new.clock_in_at::text),
      ('clock_in_department_id', v_old.clock_in_department_id::text, v_new.clock_in_department_id::text),
      ('clock_out_at', v_old.clock_out_at::text, v_new.clock_out_at::text),
      ('clock_out_department_id', v_old.clock_out_department_id::text, v_new.clock_out_department_id::text),
      ('attendance_note', v_old.attendance_note, v_new.attendance_note)
  ) as diff(field_name, old_value, new_value)
  where diff.old_value is distinct from diff.new_value;

  if v_in_changed or v_out_changed then
    update public.attendance_overtime_requests
    set status = 'pending',
        attendance_changed_warning = true,
        reviewed_at = null,
        reviewed_by = null,
        updated_at = v_now
    where user_id = v_new.user_id
      and work_date = v_new.work_date
      and is_deleted_by_employee = false;
  end if;

  return v_new;
end;
$$;

revoke all on function public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid, text) to service_role;

commit;
