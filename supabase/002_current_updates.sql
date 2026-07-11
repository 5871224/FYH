-- 福圓號 Supabase 現行增量更新
--
-- 執行順序：先執行 001_current_schema.sql，再完整執行本檔。
-- 本檔依原 migration 順序整併；每個區段保留原有交易邊界。
-- SQL Editor 若出現錯誤，請停止並保留完整錯誤訊息，不要跳過區段。


-- ============================================================================================
-- 區段 01：原檔 024_schedule_entries_rpc.sql
-- ============================================================================================

create or replace function public.save_schedule_entries_bulk(entries jsonb)
returns setof public.schedule_entries
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_manager(auth.uid()) then
    raise exception 'manager permission required' using errcode = '42501';
  end if;

  if entries is null or jsonb_typeof(entries) <> 'array' then
    raise exception 'entries must be a json array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(entries) as item(member_id uuid, work_date date)
    where item.member_id is null or item.work_date is null
  ) then
    raise exception 'member_id and work_date are required' using errcode = '23502';
  end if;

  return query
  with incoming as (
    select *
    from jsonb_to_recordset(entries) as item(
      member_id uuid,
      work_date date,
      delete_entry boolean,
      shift_type_id uuid,
      leave_type_id uuid,
      leave_all_day boolean,
      leave_start_time time,
      leave_end_time time,
      leave_reason text,
      overtime_type_id uuid,
      overtime_start_time time,
      overtime_end_time time,
      overtime_use_rest_1 boolean,
      overtime_rest_1_start_time time,
      overtime_rest_1_end_time time,
      overtime_use_rest_2 boolean,
      overtime_rest_2_start_time time,
      overtime_rest_2_end_time time,
      overtime_reason text
    )
  ),
  deleted as (
    delete from public.schedule_entries se
    using incoming item
    where se.member_id = item.member_id
      and se.work_date = item.work_date
      and (
        item.delete_entry is true
        or (
          item.shift_type_id is null
          and item.leave_type_id is null
          and item.overtime_type_id is null
        )
      )
    returning se.*
  ),
  upserted as (
    insert into public.schedule_entries (
      member_id,
      work_date,
      shift_type_id,
      leave_type_id,
      leave_all_day,
      leave_start_time,
      leave_end_time,
      leave_reason,
      overtime_type_id,
      overtime_start_time,
      overtime_end_time,
      overtime_use_rest_1,
      overtime_rest_1_start_time,
      overtime_rest_1_end_time,
      overtime_use_rest_2,
      overtime_rest_2_start_time,
      overtime_rest_2_end_time,
      overtime_reason
    )
    select
      item.member_id,
      item.work_date,
      item.shift_type_id,
      item.leave_type_id,
      coalesce(item.leave_all_day, true),
      case when item.leave_type_id is null then null else item.leave_start_time end,
      case when item.leave_type_id is null then null else item.leave_end_time end,
      case when item.leave_type_id is null then null else item.leave_reason end,
      item.overtime_type_id,
      case when item.overtime_type_id is null then null else item.overtime_start_time end,
      case when item.overtime_type_id is null then null else item.overtime_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_1, false) end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_1, false) is false then null else item.overtime_rest_1_start_time end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_1, false) is false then null else item.overtime_rest_1_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_2, false) end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_2, false) is false then null else item.overtime_rest_2_start_time end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_2, false) is false then null else item.overtime_rest_2_end_time end,
      case when item.overtime_type_id is null then null else item.overtime_reason end
    from incoming item
    where coalesce(item.delete_entry, false) is false
      and (
        item.shift_type_id is not null
        or item.leave_type_id is not null
        or item.overtime_type_id is not null
      )
    on conflict (member_id, work_date)
    do update set
      shift_type_id = excluded.shift_type_id,
      leave_type_id = excluded.leave_type_id,
      leave_all_day = excluded.leave_all_day,
      leave_start_time = excluded.leave_start_time,
      leave_end_time = excluded.leave_end_time,
      leave_reason = excluded.leave_reason,
      overtime_type_id = excluded.overtime_type_id,
      overtime_start_time = excluded.overtime_start_time,
      overtime_end_time = excluded.overtime_end_time,
      overtime_use_rest_1 = excluded.overtime_use_rest_1,
      overtime_rest_1_start_time = excluded.overtime_rest_1_start_time,
      overtime_rest_1_end_time = excluded.overtime_rest_1_end_time,
      overtime_use_rest_2 = excluded.overtime_use_rest_2,
      overtime_rest_2_start_time = excluded.overtime_rest_2_start_time,
      overtime_rest_2_end_time = excluded.overtime_rest_2_end_time,
      overtime_reason = excluded.overtime_reason
    returning *
  )
  select *
  from upserted;
end;
$$;

grant execute on function public.save_schedule_entries_bulk(jsonb) to authenticated;


-- ============================================================================================
-- 區段 02：原檔 026_meal_admin_settings_rpc.sql
-- ============================================================================================

begin;

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


-- ============================================================================================
-- 區段 03：原檔 027_v2_security.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 04：原檔 028_v2_attendance_clock.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 05：原檔 029_v2_attendance_admin.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 06：原檔 030_v2_meal_snapshot.sql
-- ============================================================================================

begin;

create or replace function public.save_meal_order_v2(
  p_user_id uuid,
  p_items jsonb,
  p_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_date date := (timezone('Asia/Taipei', now()))::date;
  v_department_id uuid;
  v_department_name text;
  v_clock_location_id uuid;
  v_result jsonb;
begin
  select department_id, department_name_snapshot, clock_location_id
  into v_department_id, v_department_name, v_clock_location_id
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_date
  order by submitted_at asc
  limit 1;

  v_result := public.save_meal_order(p_user_id, p_items, p_note);

  if v_department_id is not null then
    update public.meal_orders
    set department_id = v_department_id,
        department_name_snapshot = coalesce(v_department_name, ''),
        clock_location_id = coalesce(v_clock_location_id, v_department_id)
    where user_id = p_user_id
      and order_date = v_date;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_meal_order_v2(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_meal_order_v2(uuid, jsonb, text) to service_role;

commit;


-- ============================================================================================
-- 區段 07：原檔 031_v2_role_department_protection.sql
-- ============================================================================================

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
      new.public_ip := null;
      new.attendance_enabled := false;
      new.attendance_settings_updated_at := null;
      new.attendance_settings_updated_by := null;
      return new;
    end if;

    -- Managers may edit ordinary department fields. Any attendance fields sent by
    -- an older client are ignored and the current protected values are retained.
    new.address := old.address;
    new.latitude := old.latitude;
    new.longitude := old.longitude;
    new.public_ip := old.public_ip;
    new.attendance_enabled := old.attendance_enabled;
    new.attendance_settings_updated_at := old.attendance_settings_updated_at;
    new.attendance_settings_updated_by := old.attendance_settings_updated_by;
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


-- ============================================================================================
-- 區段 08：原檔 032_v2_overtime_batch.sql
-- ============================================================================================

begin;

alter table public.attendance_overtime_requests
  add column if not exists review_note text;

create or replace function public.admin_review_overtime_requests_v2(
  p_ids uuid[],
  p_status text,
  p_early_hours numeric default null,
  p_late_hours numeric default null,
  p_operator_user_id uuid default null,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_operator_role text;
  v_requested_count integer;
  v_found_count integer;
  v_result jsonb;
begin
  select role into v_operator_role
  from public.set_employee
  where id = p_operator_user_id
    and is_active = true
    and (hire_date is null or hire_date <= (timezone('Asia/Taipei', v_now))::date)
    and (leave_date is null or (timezone('Asia/Taipei', v_now))::date <= leave_date + 5);

  if v_operator_role <> 'admin' then
    raise exception '此功能限管理員使用' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception '缺少加班申請' using errcode = '23502';
  end if;
  if p_status not in ('approved', 'returned', 'pending') then
    raise exception '不支援的審核狀態' using errcode = '22023';
  end if;
  if p_early_hours is not null and (p_early_hours < 0 or mod(p_early_hours * 2, 1) <> 0) then
    raise exception '提早上班時數必須為 0.5 的倍數且不可為負數' using errcode = '23514';
  end if;
  if p_late_hours is not null and (p_late_hours < 0 or mod(p_late_hours * 2, 1) <> 0) then
    raise exception '延後下班時數必須為 0.5 的倍數且不可為負數' using errcode = '23514';
  end if;

  v_requested_count := cardinality(array(select distinct unnest(p_ids)));

  create temporary table if not exists pg_temp.overtime_batch_old
  (like public.attendance_overtime_requests including defaults)
  on commit drop;
  truncate pg_temp.overtime_batch_old;

  insert into pg_temp.overtime_batch_old
  select request.*
  from public.attendance_overtime_requests request
  where request.id = any(p_ids)
    and request.is_deleted_by_employee = false
  for update;

  get diagnostics v_found_count = row_count;
  if v_found_count <> v_requested_count then
    raise exception '部分加班申請不存在或已被刪除，整批未處理' using errcode = '23503';
  end if;

  if exists (
    select 1
    from pg_temp.overtime_batch_old old_row
    where coalesce(p_early_hours, old_row.early_overtime_hours, 0)
        + coalesce(p_late_hours, old_row.late_overtime_hours, 0) <= 0
  ) then
    raise exception '加班時數必須大於 0' using errcode = '23514';
  end if;

  with updated as (
    update public.attendance_overtime_requests request
    set status = p_status,
        early_overtime_hours = coalesce(p_early_hours, old_row.early_overtime_hours, 0),
        late_overtime_hours = coalesce(p_late_hours, old_row.late_overtime_hours, 0),
        total_overtime_hours = coalesce(p_early_hours, old_row.early_overtime_hours, 0)
          + coalesce(p_late_hours, old_row.late_overtime_hours, 0),
        attendance_changed_warning = false,
        reviewed_at = v_now,
        reviewed_by = p_operator_user_id,
        review_note = nullif(trim(coalesce(p_review_note, '')), ''),
        updated_at = v_now
    from pg_temp.overtime_batch_old old_row
    where request.id = old_row.id
    returning request.*
  )
  insert into public.overtime_review_logs (
    overtime_request_id,
    old_status,
    new_status,
    old_early_hours,
    new_early_hours,
    old_late_hours,
    new_late_hours,
    operator_user_id,
    created_at
  )
  select updated.id,
         old_row.status,
         updated.status,
         old_row.early_overtime_hours,
         updated.early_overtime_hours,
         old_row.late_overtime_hours,
         updated.late_overtime_hours,
         p_operator_user_id,
         v_now
  from updated
  join pg_temp.overtime_batch_old old_row on old_row.id = updated.id;

  select coalesce(jsonb_agg(to_jsonb(request) order by request.work_date, request.id), '[]'::jsonb)
  into v_result
  from public.attendance_overtime_requests request
  where request.id = any(p_ids);

  return jsonb_build_object('ok', true, 'requests', v_result);
end;
$$;

revoke all on function public.admin_review_overtime_requests_v2(uuid[], text, numeric, numeric, uuid, text)
from public, anon, authenticated;
grant execute on function public.admin_review_overtime_requests_v2(uuid[], text, numeric, numeric, uuid, text)
to service_role;

commit;


-- ============================================================================================
-- 區段 09：原檔 033_v2_employee_visibility.sql
-- ============================================================================================

begin;

alter table public.set_employee enable row level security;
alter table public.schedule_entries enable row level security;

drop policy if exists v2_restrict_employee_directory on public.set_employee;
drop policy if exists v2_restrict_schedule_visibility on public.schedule_entries;
drop policy if exists read_set_employee on public.set_employee;
drop policy if exists read_schedule_entries on public.schedule_entries;

create policy read_set_employee on public.set_employee
for select to authenticated
using (true);

create policy read_schedule_entries on public.schedule_entries
for select to authenticated
using (true);

commit;


-- ============================================================================================
-- 區段 10：原檔 034_v2_overtime_reapply.sql
-- ============================================================================================

begin;

alter table public.attendance_overtime_requests
  drop constraint if exists attendance_overtime_requests_user_id_work_date_key;

alter table public.attendance_overtime_requests
  drop constraint if exists attendance_overtime_requests_user_work_date_key;

drop index if exists public.attendance_overtime_requests_user_id_work_date_key;
drop index if exists public.attendance_overtime_requests_user_work_date_key;

create unique index if not exists attendance_overtime_requests_active_user_date_uidx
on public.attendance_overtime_requests(user_id, work_date)
where is_deleted_by_employee = false;

create index if not exists attendance_overtime_requests_history_user_date_idx
on public.attendance_overtime_requests(user_id, work_date, submitted_at desc);

commit;


-- ============================================================================================
-- 區段 11：原檔 035_v2_last_admin.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 12：原檔 036_v2_synchronized_member_delete.sql
-- ============================================================================================

begin;

alter table public.set_employee
  drop constraint if exists set_employee_auth_user_fkey;

alter table public.set_employee
  add constraint set_employee_auth_user_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;

create or replace function public.block_direct_employee_profile_delete_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception '人員資料不可單獨刪除，請由人員管理功能同步刪除登入帳號與人員資料'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_block_direct_employee_profile_delete_v2 on public.set_employee;
create trigger trg_block_direct_employee_profile_delete_v2
before delete on public.set_employee
for each row execute function public.block_direct_employee_profile_delete_v2();

create or replace function public.has_synchronized_member_delete_v2()
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.set_employee'::regclass
      and constraint_row.conname = 'set_employee_auth_user_fkey'
      and constraint_row.contype = 'f'
  )
  and exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.set_employee'::regclass
      and trigger_row.tgname = 'trg_block_direct_employee_profile_delete_v2'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
  )
$$;

revoke all on function public.has_synchronized_member_delete_v2()
from public, anon, authenticated;
grant execute on function public.has_synchronized_member_delete_v2()
to service_role;

commit;


-- ============================================================================================
-- 區段 13：原檔 037_v2_department_attendance_fields.sql
-- ============================================================================================

begin;

do $$
begin
  if to_regclass('public.department_attendance_settings') is not null then
    update public.set_departments d
    set public_ip = s.public_ip
    from public.department_attendance_settings s
    where s.department_id = d.id
      and nullif(btrim(coalesce(s.public_ip, '')), '') is not null;
  end if;
end $$;

drop function if exists public.get_department_attendance_settings();
drop function if exists public.save_department_attendance_settings_bulk(jsonb);

drop trigger if exists protect_department_attendance_settings_trigger on public.set_departments;
drop function if exists public.protect_department_attendance_settings();

create or replace function public.save_department_attendance_fields_bulk(settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if settings is null or jsonb_typeof(settings) <> 'array' then
    raise exception 'settings must be a json array' using errcode = '22023';
  end if;

  update public.set_departments d
  set
    address = nullif(btrim(coalesce(item.address, '')), ''),
    latitude = item.latitude,
    longitude = item.longitude,
    public_ip = nullif(btrim(coalesce(item.public_ip, '')), ''),
    attendance_enabled = coalesce(item.attendance_enabled, false),
    attendance_settings_updated_at = now(),
    attendance_settings_updated_by = auth.uid()
  from jsonb_to_recordset(settings) as item(
    department_id uuid,
    address text,
    latitude double precision,
    longitude double precision,
    public_ip text,
    attendance_enabled boolean
  )
  where item.department_id is not null
    and d.id = item.department_id;
end;
$$;

revoke all on function public.save_department_attendance_fields_bulk(jsonb) from public, anon;
grant execute on function public.save_department_attendance_fields_bulk(jsonb) to authenticated;

do $$
begin
  if to_regclass('public.department_attendance_settings') is not null then
    execute 'drop policy if exists read_department_attendance_settings on public.department_attendance_settings';
    execute 'drop policy if exists write_department_attendance_settings on public.department_attendance_settings';
    execute 'drop table public.department_attendance_settings';
  end if;
end $$;

commit;


-- ============================================================================================
-- 區段 14：原檔 037_v2_meal_subsidy_and_product_delete.sql
-- ============================================================================================

begin;

alter table public.meal_settings
  add column if not exists company_subsidy integer;

update public.meal_settings
set company_subsidy = 55
where company_subsidy is null;

alter table public.meal_settings
  alter column company_subsidy set default 55,
  alter column company_subsidy set not null;

alter table public.meal_settings
  drop constraint if exists meal_settings_company_subsidy_check;

alter table public.meal_settings
  add constraint meal_settings_company_subsidy_check
  check (company_subsidy > 0);

drop function if exists public.save_meal_admin_settings(jsonb, time, uuid);
drop function if exists public.save_meal_admin_settings(jsonb, time, integer, uuid);

create function public.save_meal_admin_settings(
  p_products jsonb,
  p_daily_cutoff_time time,
  p_company_subsidy integer,
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
  select * into v_operator
  from public.set_employee
  where id = p_operator_user_id;

  if not found or v_operator.role not in ('admin', 'manager') then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;

  if p_daily_cutoff_time is null then
    raise exception '缺少截止時間' using errcode = '23502';
  end if;

  if p_company_subsidy is null or p_company_subsidy <= 0 then
    raise exception '公司補助只能輸入正整數' using errcode = '22023';
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

  insert into public.meal_settings (
    id,
    daily_cutoff_time,
    company_subsidy,
    updated_by,
    updated_at
  )
  values (
    'default',
    p_daily_cutoff_time,
    p_company_subsidy,
    p_operator_user_id,
    v_now
  )
  on conflict (id) do update
  set daily_cutoff_time = excluded.daily_cutoff_time,
      company_subsidy = excluded.company_subsidy,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.meal_products (
    id,
    name,
    price,
    is_active,
    sort_order,
    created_at,
    updated_at
  )
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

  update public.meal_orders meal_order
  set unit_price = meal_product.price,
      updated_at = v_now
  from public.meal_products meal_product
  where meal_order.product_id = meal_product.id
    and meal_order.order_date = v_today
    and v_now_time <= p_daily_cutoff_time
    and meal_order.unit_price is distinct from meal_product.price;

  return jsonb_build_object(
    'ok', true,
    'companySubsidy', p_company_subsidy
  );
end;
$$;

revoke all on function public.save_meal_admin_settings(jsonb, time, integer, uuid)
from public, anon, authenticated;
grant execute on function public.save_meal_admin_settings(jsonb, time, integer, uuid)
to service_role;

create or replace function public.delete_meal_product_v2(
  p_product_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operator public.set_employee%rowtype;
  v_product public.meal_products%rowtype;
begin
  select * into v_operator
  from public.set_employee
  where id = p_operator_user_id;

  if not found or v_operator.role not in ('admin', 'manager') then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;

  select * into v_product
  from public.meal_products
  where id = p_product_id
  for update;

  if not found then
    return jsonb_build_object('ok', true, 'deleted', false);
  end if;

  if exists (
    select 1
    from public.meal_orders
    where product_id = p_product_id
  ) then
    raise exception '此品項已有訂餐記錄，不能刪除；請取消啟用'
      using errcode = '23503';
  end if;

  delete from public.meal_products
  where id = p_product_id;

  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

revoke all on function public.delete_meal_product_v2(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_meal_product_v2(uuid, uuid)
to service_role;

commit;


-- ============================================================================================
-- 區段 15：原檔 migrations/038_v2_employee_sort_order.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 16：原檔 migrations/039_remove_legacy_attendance_tables.sql
-- ============================================================================================

begin;

-- The current attendance flow uses attendance_records and set_departments.
-- These two empty legacy tables are no longer referenced by views,
-- database functions, or the application.
drop table if exists public.attendance_logs;
drop table if exists public.clock_locations;

commit;


-- ============================================================================================
-- 區段 17：原檔 migrations/040_enforce_employee_code_uniqueness.sql
-- ============================================================================================

create unique index if not exists set_employee_employee_code_lower_key
on public.set_employee ((lower(btrim(employee_code))));


-- ============================================================================================
-- 區段 18：原檔 migrations/041_transactional_member_account_delete.sql
-- ============================================================================================

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

  delete from public.set_employee where id = p_target_id;
  delete from auth.users where id = p_target_id;

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


-- ============================================================================================
-- 區段 19：原檔 migrations/042_fix_transactional_member_account_delete_order.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 20：原檔 043_harden_private_data_access.sql
-- ============================================================================================

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


-- ============================================================================================
-- 區段 21：所有角色使用相同班表人員有效期間
-- ============================================================================================

begin;

-- 班表人員列、排序與 PT 標記不得因登入角色不同。
-- 到職日、離職日、日薪狀態與可排班班別是班表顯示必要資料，
-- 對所有有效登入者提供；帳號角色、工號及其他管理資料仍維持遮罩。
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
    target.hire_date,
    target.leave_date,
    target.pay_by_day,
    target.is_active,
    target.created_at,
    target.updated_at,
    case when actor.manager_access or target.id = actor.id then target.schedule_department_ids else '{}'::text[] end,
    case when actor.manager_access or target.id = actor.id then target.monthly_rest_days else 0 end,
    case when actor.manager_access or target.id = actor.id then target.fixed_rest_weekday else 0 end,
    target.schedule_shift_ids,
    target.sort_order
  from actor
  join public.set_employee target
    on target.id = actor.id
    or (actor.effective and target.is_active)
  order by target.sort_order, target.full_name, target.id
$$;

revoke all on function public.get_employee_directory_v2() from public, anon;
grant execute on function public.get_employee_directory_v2() to authenticated, service_role;

commit;


-- ============================================================================================
-- 區段 22：依頁面用途拆分人員資料 RPC
-- ============================================================================================

begin;

create or replace function public.get_my_profile_v2()
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
  select
    employee.id,
    employee.employee_code,
    employee.full_name,
    employee.role,
    employee.home_department_id,
    employee.position_name,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.created_at,
    employee.updated_at,
    employee.schedule_department_ids,
    employee.monthly_rest_days,
    employee.fixed_rest_weekday,
    employee.schedule_shift_ids,
    employee.sort_order
  from public.set_employee employee
  where employee.id = auth.uid()
$$;

create or replace function public.get_schedule_directory_v2()
returns table (
  id uuid,
  full_name text,
  home_department_id uuid,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  is_active boolean,
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with actor as (
    select public.is_effective_user(auth.uid()) as effective
  )
  select
    employee.id,
    employee.full_name,
    employee.home_department_id,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.sort_order
  from actor
  cross join public.set_employee employee
  where actor.effective
    and employee.is_active
  order by employee.sort_order, employee.full_name, employee.id
$$;

create or replace function public.get_employee_admin_directory_v2()
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
    select public.is_manager(auth.uid()) as manager_access
  )
  select
    employee.id,
    employee.employee_code,
    employee.full_name,
    employee.role,
    employee.home_department_id,
    employee.position_name,
    employee.hire_date,
    employee.leave_date,
    employee.pay_by_day,
    employee.is_active,
    employee.created_at,
    employee.updated_at,
    employee.schedule_department_ids,
    employee.monthly_rest_days,
    employee.fixed_rest_weekday,
    employee.schedule_shift_ids,
    employee.sort_order
  from actor
  cross join public.set_employee employee
  where actor.manager_access
    and employee.is_active
  order by employee.sort_order, employee.full_name, employee.id
$$;

revoke all on function public.get_my_profile_v2() from public, anon;
revoke all on function public.get_schedule_directory_v2() from public, anon;
revoke all on function public.get_employee_admin_directory_v2() from public, anon;
grant execute on function public.get_my_profile_v2() to authenticated, service_role;
grant execute on function public.get_schedule_directory_v2() to authenticated, service_role;
grant execute on function public.get_employee_admin_directory_v2() to authenticated, service_role;

commit;


-- ============================================================================================
-- 區段 23：移除混合用途的舊人員名錄 RPC
-- ============================================================================================

begin;

revoke all on function public.get_employee_directory_v2() from public, anon, authenticated, service_role;
drop function if exists public.get_employee_directory_v2();

commit;


-- ============================================================================================
-- 區段 24：單位安全寫入與班表匯出正式資料
-- ============================================================================================

begin;

create or replace function public.save_departments_general_v2(p_departments jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  v_id uuid;
  v_name text;
  v_start_date date;
  v_end_date date;
  v_hidden boolean;
  v_sort_order integer;
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_departments, '[]'::jsonb)) <> 'array' then
    raise exception '單位資料格式錯誤';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_departments, '[]'::jsonb)) loop
    begin
      v_id := nullif(btrim(item->>'id'), '')::uuid;
      v_start_date := nullif(btrim(item->>'start_date'), '')::date;
      v_end_date := nullif(btrim(item->>'end_date'), '')::date;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception '單位識別碼或日期格式錯誤';
    end;
    v_name := btrim(coalesce(item->>'name', ''));
    v_hidden := coalesce((item->>'hidden_from_schedule')::boolean, false);
    v_sort_order := greatest(0, coalesce((item->>'sort_order')::integer, 0));

    if v_id is null or v_name = '' then
      raise exception '單位名稱與識別碼不可空白';
    end if;
    if length(v_name) > 12 then
      raise exception '單位名稱不可超過 12 個字';
    end if;
    if v_start_date is not null and v_end_date is not null and v_start_date > v_end_date then
      raise exception '單位開始日期不得晚於結束日期';
    end if;

    insert into public.set_departments (
      id, name, start_date, end_date, hidden_from_schedule, sort_order
    ) values (
      v_id, v_name, v_start_date, v_end_date, v_hidden, v_sort_order
    )
    on conflict (id) do update set
      name = excluded.name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      hidden_from_schedule = excluded.hidden_from_schedule,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.delete_department_general_v2(p_department_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_department_id is null then
    raise exception '缺少單位識別碼';
  end if;
  if exists (select 1 from public.set_employee where home_department_id = p_department_id) then
    raise exception '這個單位仍有人員，請先將人員移轉到其他單位';
  end if;
  if exists (select 1 from public.set_shift where applicable_department_id = p_department_id) then
    raise exception '這個單位仍有班別使用，請先修改相關班別';
  end if;

  begin
    delete from public.set_departments where id = p_department_id;
  exception when foreign_key_violation then
    raise exception '這個單位已有班表、打卡或訂餐歷史，為保留歷史關聯不可刪除';
  end;
end;
$$;

create or replace function public.get_schedule_export_rows_v2(
  p_start_date date,
  p_end_date date
)
returns table (
  member_id uuid,
  employee_code text,
  employee_name text,
  home_department_id uuid,
  department_name text,
  pay_by_day boolean,
  work_date date,
  leave_type_id uuid,
  leave_code text,
  leave_name text,
  leave_all_day boolean,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_type_id uuid,
  overtime_name text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_use_rest_1 boolean,
  overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean,
  overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,
  overtime_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception '單次匯出期間不可超過 366 天';
  end if;

  return query
  select
    schedule.member_id,
    employee.employee_code,
    employee.full_name,
    employee.home_department_id,
    department.name,
    employee.pay_by_day,
    schedule.work_date,
    schedule.leave_type_id,
    leave_type.code,
    leave_type.name,
    schedule.leave_all_day,
    schedule.leave_start_time,
    schedule.leave_end_time,
    schedule.leave_reason,
    schedule.overtime_type_id,
    overtime_type.name,
    schedule.overtime_start_time,
    schedule.overtime_end_time,
    schedule.overtime_use_rest_1,
    schedule.overtime_rest_1_start_time,
    schedule.overtime_rest_1_end_time,
    schedule.overtime_use_rest_2,
    schedule.overtime_rest_2_start_time,
    schedule.overtime_rest_2_end_time,
    schedule.overtime_reason
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id = schedule.member_id
  left join public.set_departments department on department.id = employee.home_department_id
  left join public.set_leave leave_type on leave_type.id = schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id = schedule.overtime_type_id
  where schedule.work_date between p_start_date and p_end_date
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date, employee.sort_order, employee.full_name, employee.id;
end;
$$;

revoke all on function public.save_departments_general_v2(jsonb) from public, anon;
revoke all on function public.delete_department_general_v2(uuid) from public, anon;
revoke all on function public.get_schedule_export_rows_v2(date, date) from public, anon;
grant execute on function public.save_departments_general_v2(jsonb) to authenticated, service_role;
grant execute on function public.delete_department_general_v2(uuid) to authenticated, service_role;
grant execute on function public.get_schedule_export_rows_v2(date, date) to authenticated, service_role;

commit;

-- ============================================================================================
-- 區段 25：人員刪除歷史保護與禁止隱性停用
-- ============================================================================================

begin;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_schedule_count bigint := 0;
  v_attendance_count bigint := 0;
  v_attendance_action_count bigint := 0;
  v_overtime_count bigint := 0;
  v_overtime_review_count bigint := 0;
  v_overtime_management_count bigint := 0;
  v_meal_count bigint := 0;
  v_settings_count bigint := 0;
  v_details text[] := array[]::text[];
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
      'softDeleted', false,
      'blocked', false
    );
  end if;

  select count(*) into v_schedule_count
  from public.schedule_entries
  where member_id = p_target_id;

  select count(*) into v_attendance_count
  from public.attendance_records
  where user_id = p_target_id;

  select count(distinct action_log.id) into v_attendance_action_count
  from public.attendance_action_logs action_log
  left join public.attendance_records attendance_record
    on attendance_record.id = action_log.attendance_record_id
  where action_log.operator_user_id = p_target_id
     or attendance_record.user_id = p_target_id;

  select count(*) into v_overtime_count
  from public.attendance_overtime_requests
  where user_id = p_target_id;

  select count(distinct review_log.id) into v_overtime_review_count
  from public.overtime_review_logs review_log
  left join public.attendance_overtime_requests overtime_request
    on overtime_request.id = review_log.overtime_request_id
  where review_log.operator_user_id = p_target_id
     or overtime_request.user_id = p_target_id;

  select count(distinct overtime_request.id) into v_overtime_management_count
  from public.attendance_overtime_requests overtime_request
  where overtime_request.created_by_user_id = p_target_id
     or overtime_request.reviewed_by = p_target_id
     or overtime_request.deleted_by = p_target_id;

  select count(*) into v_meal_count
  from public.meal_orders
  where user_id = p_target_id;

  select
    (select count(*) from public.meal_settings where updated_by = p_target_id)
    +
    (select count(*) from public.set_departments where attendance_settings_updated_by = p_target_id)
  into v_settings_count;

  if v_schedule_count > 0 then
    v_details := array_append(v_details, format('班表資料 %s 筆', v_schedule_count));
  end if;
  if v_attendance_count > 0 then
    v_details := array_append(v_details, format('打卡資料 %s 筆', v_attendance_count));
  end if;
  if v_attendance_action_count > 0 then
    v_details := array_append(v_details, format('打卡異動紀錄 %s 筆', v_attendance_action_count));
  end if;
  if v_overtime_count > 0 then
    v_details := array_append(v_details, format('加班申請 %s 筆', v_overtime_count));
  end if;
  if v_overtime_review_count > 0 then
    v_details := array_append(v_details, format('加班審核紀錄 %s 筆', v_overtime_review_count));
  end if;
  if v_overtime_management_count > 0 then
    v_details := array_append(v_details, format('加班管理紀錄 %s 筆', v_overtime_management_count));
  end if;
  if v_meal_count > 0 then
    v_details := array_append(v_details, format('訂餐資料 %s 筆', v_meal_count));
  end if;
  if v_settings_count > 0 then
    v_details := array_append(v_details, format('系統設定異動 %s 筆', v_settings_count));
  end if;

  if cardinality(v_details) > 0 then
    return jsonb_build_object(
      'ok', false,
      'deleted', false,
      'softDeleted', false,
      'blocked', true,
      'code', 'MEMBER_HAS_HISTORY',
      'message', format(
        '無法刪除「%s」：已有%s。請保留人員資料；離職人員請填寫離職日。',
        v_profile.full_name,
        array_to_string(v_details, '、')
      ),
      'history', jsonb_build_object(
        'schedule', v_schedule_count,
        'attendance', v_attendance_count,
        'attendanceActions', v_attendance_action_count,
        'overtimeRequests', v_overtime_count,
        'overtimeReviews', v_overtime_review_count,
        'overtimeManagement', v_overtime_management_count,
        'mealOrders', v_meal_count,
        'settings', v_settings_count
      )
    );
  end if;

  delete from auth.users where id = p_target_id;

  if exists (select 1 from public.set_employee where id = p_target_id) then
    raise exception '登入帳號刪除後，人員資料未同步刪除';
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'softDeleted', false,
    'blocked', false,
    'employeeCode', v_profile.employee_code
  );
end;
$$;

create or replace function public.delete_member_account_v3(p_target_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.delete_member_account_v4(p_target_id)
$$;

create or replace function public.block_direct_member_deactivation_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.is_active is true
     and new.is_active is false
     and auth.role() = 'authenticated' then
    raise exception '人員不可由前端直接改為停用，請使用正式刪除檢查流程'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists block_direct_member_deactivation_v2 on public.set_employee;
create trigger block_direct_member_deactivation_v2
before update of is_active on public.set_employee
for each row execute function public.block_direct_member_deactivation_v2();

revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
revoke all on function public.delete_member_account_v3(uuid) from public, anon, authenticated;
revoke all on function public.block_direct_member_deactivation_v2() from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
grant execute on function public.delete_member_account_v3(uuid) to service_role;

commit;
