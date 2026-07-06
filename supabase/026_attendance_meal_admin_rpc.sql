begin;

create or replace function public.admin_update_attendance_record(
  p_record_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_clock_in_at timestamptz,
  p_clock_in_department_id uuid,
  p_clock_out_at timestamptz,
  p_clock_out_department_id uuid,
  p_attendance_note text,
  p_operator_user_id uuid
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
    if not found then
      raise exception '找不到上班打卡單位' using errcode = '23503';
    end if;
  end if;

  if p_clock_out_department_id is not null then
    select * into v_out_department from public.set_departments where id = p_clock_out_department_id;
    if not found then
      raise exception '找不到下班打卡單位' using errcode = '23503';
    end if;
  end if;

  if v_record_id is not null then
    select * into v_old from public.attendance_records where id = v_record_id for update;
  else
    select * into v_old
    from public.attendance_records
    where user_id = p_user_id
      and work_date = p_work_date
    for update;
  end if;

  if v_old.id is null then
    insert into public.attendance_records (
      user_id,
      work_date,
      employee_code_snapshot,
      employee_name_snapshot,
      created_at,
      updated_at
    ) values (
      p_user_id,
      p_work_date,
      coalesce(v_employee.employee_code, ''),
      coalesce(v_employee.full_name, ''),
      v_now,
      v_now
    )
    returning * into v_old;
  end if;

  update public.attendance_records
  set
    employee_code_snapshot = coalesce(v_employee.employee_code, ''),
    employee_name_snapshot = coalesce(v_employee.full_name, ''),
    clock_in_at = p_clock_in_at,
    clock_in_department_id = case when p_clock_in_at is null then null else p_clock_in_department_id end,
    clock_in_department_name_snapshot = case when p_clock_in_at is null then null else coalesce(v_in_department.name, '') end,
    clock_in_address_snapshot = case when p_clock_in_at is null then null else coalesce(v_in_department.address, '') end,
    clock_in_source = case when p_clock_in_at is null then null else '管理員補登' end,
    clock_in_latitude = null,
    clock_in_longitude = null,
    clock_in_accuracy = null,
    clock_in_distance = null,
    clock_in_ip = null,
    clock_out_at = p_clock_out_at,
    clock_out_department_id = case when p_clock_out_at is null then null else p_clock_out_department_id end,
    clock_out_department_name_snapshot = case when p_clock_out_at is null then null else coalesce(v_out_department.name, '') end,
    clock_out_address_snapshot = case when p_clock_out_at is null then null else coalesce(v_out_department.address, '') end,
    clock_out_source = case when p_clock_out_at is null then null else '管理員補登' end,
    clock_out_latitude = null,
    clock_out_longitude = null,
    clock_out_accuracy = null,
    clock_out_distance = null,
    clock_out_ip = null,
    attendance_note = nullif(trim(coalesce(p_attendance_note, '')), ''),
    updated_at = v_now
  where id = v_old.id
  returning * into v_new;

  insert into public.attendance_action_logs (
    attendance_record_id,
    action_type,
    field_name,
    old_value,
    new_value,
    operator_user_id,
    operator_name_snapshot
  )
  select
    v_new.id,
    'admin_update',
    field_name,
    old_value,
    new_value,
    v_operator.id,
    coalesce(v_operator.full_name, '')
  from (
    values
      ('clock_in_at', v_old.clock_in_at::text, v_new.clock_in_at::text),
      ('clock_in_department_id', v_old.clock_in_department_id::text, v_new.clock_in_department_id::text),
      ('clock_out_at', v_old.clock_out_at::text, v_new.clock_out_at::text),
      ('clock_out_department_id', v_old.clock_out_department_id::text, v_new.clock_out_department_id::text),
      ('attendance_note', v_old.attendance_note, v_new.attendance_note)
  ) as diff(field_name, old_value, new_value)
  where old_value is distinct from new_value;

  update public.attendance_overtime_requests
  set
    status = 'pending',
    attendance_changed_warning = true,
    updated_at = v_now
  where user_id = v_new.user_id
    and work_date = v_new.work_date
    and is_deleted_by_employee = false;

  return v_new;
end;
$$;

revoke all on function public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid) to service_role;

create or replace function public.save_meal_admin_settings(
  p_products jsonb,
  p_daily_cutoff_time time,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := (timezone('Asia/Taipei', v_now))::date;
  v_now_time time := (timezone('Asia/Taipei', v_now))::time;
  v_operator public.set_employee%rowtype;
  v_products jsonb := coalesce(p_products, '[]'::jsonb);
begin
  select * into v_operator from public.set_employee where id = p_operator_user_id;
  if not found or v_operator.role not in ('admin', 'manager') then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_daily_cutoff_time is null then
    raise exception '缺少訂餐截止時間' using errcode = '23502';
  end if;
  if jsonb_typeof(v_products) <> 'array' then
    raise exception '商品資料格式錯誤' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_products) with ordinality raw(item, index)
    where nullif(trim(raw.item->>'name'), '') is null
      or coalesce(nullif(raw.item->>'price', '')::numeric, 0) < 0
  ) then
    raise exception '商品名稱必填，價格不可為負數' using errcode = '22023';
  end if;

  insert into public.meal_settings (id, daily_cutoff_time, updated_by, updated_at)
  values ('default', p_daily_cutoff_time, p_operator_user_id, v_now)
  on conflict (id) do update
  set daily_cutoff_time = excluded.daily_cutoff_time,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.meal_products (id, name, price, is_active, sort_order, created_at, updated_at)
  select
    coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid()),
    trim(item->>'name'),
    coalesce(nullif(item->>'price', '')::numeric, 0),
    coalesce(nullif(item->>'isActive', '')::boolean, true),
    (index - 1)::integer,
    v_now,
    v_now
  from jsonb_array_elements(v_products) with ordinality raw(item, index)
  on conflict (id) do update
  set name = excluded.name,
      price = excluded.price,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;

  update public.meal_orders mo
  set
    unit_price = mp.price,
    updated_at = v_now
  from public.meal_products mp
  where mo.product_id = mp.id
    and mo.order_date = v_today
    and v_now_time <= p_daily_cutoff_time
    and mo.unit_price is distinct from mp.price;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_meal_admin_settings(jsonb, time, uuid) from public, anon, authenticated;
grant execute on function public.save_meal_admin_settings(jsonb, time, uuid) to service_role;

commit;
