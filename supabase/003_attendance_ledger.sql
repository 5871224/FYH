-- 福圓號 Supabase 每日簽到簿正式更新
--
-- 執行順序：001_current_schema.sql -> 002_current_updates.sql -> 003_attendance_ledger.sql
-- 本檔可重複執行。先建立新版資料模型與 RPC，再非破壞性遷移舊打卡、加班與稽核資料。
-- 舊資料表暫時保留供發布切換與回滾使用；正式前端切換完成後再另行清除。

begin;

create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.set_employee(id) on delete restrict,
  work_date date not null,
  clock_in_at timestamptz,
  clock_in_location jsonb,
  clock_out_at timestamptz,
  clock_out_location jsonb,
  regular_minutes smallint
    check (regular_minutes is null or (regular_minutes >= 0 and regular_minutes % 30 = 0)),
  overtime_minutes smallint
    check (overtime_minutes is null or (overtime_minutes >= 0 and overtime_minutes % 30 = 0)),
  note text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.set_employee(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_days_user_date_key unique (user_id, work_date)
);

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_day_id uuid not null references public.attendance_days(id) on delete cascade,
  action text not null,
  changed_by uuid references public.set_employee(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists attendance_days_work_date_idx
  on public.attendance_days(work_date desc);
create index if not exists attendance_days_reviewed_idx
  on public.attendance_days(reviewed_at, work_date desc);
create index if not exists attendance_audit_logs_day_idx
  on public.attendance_audit_logs(attendance_day_id, created_at desc);

drop trigger if exists set_attendance_days_updated_at on public.attendance_days;
create trigger set_attendance_days_updated_at
before update on public.attendance_days
for each row execute function public.set_updated_at();

alter table public.attendance_days enable row level security;
alter table public.attendance_audit_logs enable row level security;

drop policy if exists attendance_days_select_own on public.attendance_days;
create policy attendance_days_select_own
on public.attendance_days
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.attendance_days from public, anon, authenticated;
revoke all on table public.attendance_audit_logs from public, anon, authenticated;
grant select on table public.attendance_days to authenticated;
grant all on table public.attendance_days to service_role;
grant all on table public.attendance_audit_logs to service_role;

commit;


-- ============================================================================================
-- 舊打卡、加班與稽核資料非破壞性遷移
-- ============================================================================================

begin;

with active_overtime as (
  select distinct on (request.user_id, request.work_date)
    request.user_id,
    request.work_date,
    request.status,
    request.total_overtime_hours,
    request.employee_note,
    request.review_note,
    request.reviewed_at,
    request.reviewed_by,
    request.submitted_at,
    request.updated_at
  from public.attendance_overtime_requests request
  where request.is_deleted_by_employee = false
  order by request.user_id, request.work_date, request.submitted_at desc, request.id desc
)
insert into public.attendance_days (
  user_id,
  work_date,
  clock_in_at,
  clock_in_location,
  clock_out_at,
  clock_out_location,
  regular_minutes,
  overtime_minutes,
  note,
  reviewed_at,
  reviewed_by,
  created_at,
  updated_at
)
select
  record.user_id,
  record.work_date,
  record.clock_in_at,
  case
    when record.clock_in_at is null then null
    else jsonb_strip_nulls(jsonb_build_object(
      'departmentId', record.clock_in_department_id,
      'name', record.clock_in_department_name_snapshot,
      'address', record.clock_in_address_snapshot,
      'source', record.clock_in_source,
      'latitude', record.clock_in_latitude,
      'longitude', record.clock_in_longitude,
      'accuracy', record.clock_in_accuracy,
      'distance', record.clock_in_distance,
      'ip', record.clock_in_ip,
      'companyLatitude', record.clock_in_company_latitude,
      'companyLongitude', record.clock_in_company_longitude
    ))
  end,
  record.clock_out_at,
  case
    when record.clock_out_at is null then null
    else jsonb_strip_nulls(jsonb_build_object(
      'departmentId', record.clock_out_department_id,
      'name', record.clock_out_department_name_snapshot,
      'address', record.clock_out_address_snapshot,
      'source', record.clock_out_source,
      'latitude', record.clock_out_latitude,
      'longitude', record.clock_out_longitude,
      'accuracy', record.clock_out_accuracy,
      'distance', record.clock_out_distance,
      'ip', record.clock_out_ip,
      'companyLatitude', record.clock_out_company_latitude,
      'companyLongitude', record.clock_out_company_longitude
    ))
  end,
  null,
  case
    when overtime.total_overtime_hours is null then null
    else greatest(0, least(32760, round(overtime.total_overtime_hours * 60)))::smallint
  end,
  coalesce(
    nullif(
      concat_ws(
        E'\n',
        nullif(btrim(coalesce(record.attendance_note, '')), ''),
        case
          when nullif(btrim(coalesce(overtime.employee_note, '')), '') is not null
            then '加班備註：' || btrim(overtime.employee_note)
        end,
        case
          when nullif(btrim(coalesce(overtime.review_note, '')), '') is not null
            then '審核備註：' || btrim(overtime.review_note)
        end
      ),
      ''
    ),
    ''
  ),
  case
    when overtime.status = 'approved' then coalesce(overtime.reviewed_at, overtime.updated_at)
    else null
  end,
  case when overtime.status = 'approved' then overtime.reviewed_by else null end,
  coalesce(record.created_at, now()),
  greatest(
    coalesce(record.updated_at, record.created_at, now()),
    coalesce(overtime.updated_at, overtime.submitted_at, record.updated_at, record.created_at, now())
  )
from public.attendance_records record
left join active_overtime overtime
  on overtime.user_id = record.user_id
 and overtime.work_date = record.work_date
on conflict (user_id, work_date) do update
set
  clock_in_at = coalesce(public.attendance_days.clock_in_at, excluded.clock_in_at),
  clock_in_location = coalesce(public.attendance_days.clock_in_location, excluded.clock_in_location),
  clock_out_at = coalesce(public.attendance_days.clock_out_at, excluded.clock_out_at),
  clock_out_location = coalesce(public.attendance_days.clock_out_location, excluded.clock_out_location),
  regular_minutes = coalesce(public.attendance_days.regular_minutes, excluded.regular_minutes),
  overtime_minutes = coalesce(public.attendance_days.overtime_minutes, excluded.overtime_minutes),
  note = case
    when btrim(coalesce(public.attendance_days.note, '')) = '' then excluded.note
    else public.attendance_days.note
  end,
  reviewed_at = coalesce(public.attendance_days.reviewed_at, excluded.reviewed_at),
  reviewed_by = coalesce(public.attendance_days.reviewed_by, excluded.reviewed_by),
  created_at = least(public.attendance_days.created_at, excluded.created_at),
  updated_at = greatest(public.attendance_days.updated_at, excluded.updated_at);

with active_overtime as (
  select distinct on (request.user_id, request.work_date)
    request.user_id,
    request.work_date,
    request.status,
    request.total_overtime_hours,
    request.employee_note,
    request.review_note,
    request.reviewed_at,
    request.reviewed_by,
    request.submitted_at,
    request.updated_at
  from public.attendance_overtime_requests request
  where request.is_deleted_by_employee = false
  order by request.user_id, request.work_date, request.submitted_at desc, request.id desc
)
insert into public.attendance_days (
  user_id,
  work_date,
  overtime_minutes,
  note,
  reviewed_at,
  reviewed_by,
  created_at,
  updated_at
)
select
  overtime.user_id,
  overtime.work_date,
  case
    when overtime.total_overtime_hours is null then null
    else greatest(0, least(32760, round(overtime.total_overtime_hours * 60)))::smallint
  end,
  coalesce(
    nullif(
      concat_ws(
        E'\n',
        case
          when nullif(btrim(coalesce(overtime.employee_note, '')), '') is not null
            then '加班備註：' || btrim(overtime.employee_note)
        end,
        case
          when nullif(btrim(coalesce(overtime.review_note, '')), '') is not null
            then '審核備註：' || btrim(overtime.review_note)
        end
      ),
      ''
    ),
    ''
  ),
  case
    when overtime.status = 'approved' then coalesce(overtime.reviewed_at, overtime.updated_at)
    else null
  end,
  case when overtime.status = 'approved' then overtime.reviewed_by else null end,
  coalesce(overtime.submitted_at, now()),
  coalesce(overtime.updated_at, overtime.submitted_at, now())
from active_overtime overtime
on conflict (user_id, work_date) do update
set
  overtime_minutes = coalesce(public.attendance_days.overtime_minutes, excluded.overtime_minutes),
  note = case
    when btrim(coalesce(public.attendance_days.note, '')) = '' then excluded.note
    else public.attendance_days.note
  end,
  reviewed_at = coalesce(public.attendance_days.reviewed_at, excluded.reviewed_at),
  reviewed_by = coalesce(public.attendance_days.reviewed_by, excluded.reviewed_by),
  created_at = least(public.attendance_days.created_at, excluded.created_at),
  updated_at = greatest(public.attendance_days.updated_at, excluded.updated_at);

insert into public.attendance_audit_logs (
  id,
  attendance_day_id,
  action,
  changed_by,
  before_data,
  after_data,
  reason,
  created_at
)
select
  action_log.id,
  attendance_day.id,
  action_log.action_type,
  case
    when action_log.operator_user_id is not null
      and exists (
        select 1
        from public.set_employee employee
        where employee.id = action_log.operator_user_id
      )
      then action_log.operator_user_id
    else null
  end,
  coalesce(
    action_log.old_record,
    jsonb_strip_nulls(jsonb_build_object(
      'field', action_log.field_name,
      'value', action_log.old_value
    ))
  ),
  coalesce(
    action_log.new_record,
    jsonb_strip_nulls(jsonb_build_object(
      'field', action_log.field_name,
      'value', action_log.new_value
    ))
  ),
  coalesce(action_log.reason, ''),
  action_log.created_at
from public.attendance_action_logs action_log
join public.attendance_records legacy_record
  on legacy_record.id = action_log.attendance_record_id
join public.attendance_days attendance_day
  on attendance_day.user_id = legacy_record.user_id
 and attendance_day.work_date = legacy_record.work_date
on conflict (id) do nothing;

insert into public.attendance_audit_logs (
  attendance_day_id,
  action,
  changed_by,
  before_data,
  after_data,
  reason,
  created_at
)
select
  attendance_day.id,
  'migration_backfill',
  null,
  null,
  to_jsonb(attendance_day),
  '從舊打卡、加班與稽核資料遷移',
  now()
from public.attendance_days attendance_day
where (
  exists (
    select 1
    from public.attendance_records legacy_record
    where legacy_record.user_id = attendance_day.user_id
      and legacy_record.work_date = attendance_day.work_date
  )
  or exists (
    select 1
    from public.attendance_overtime_requests legacy_overtime
    where legacy_overtime.user_id = attendance_day.user_id
      and legacy_overtime.work_date = attendance_day.work_date
      and legacy_overtime.is_deleted_by_employee = false
  )
)
and not exists (
  select 1
  from public.attendance_audit_logs audit_log
  where audit_log.attendance_day_id = attendance_day.id
    and audit_log.action = 'migration_backfill'
);

commit;


-- ============================================================================================
-- 每日簽到原子打卡 RPC
-- ============================================================================================

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
  v_record public.attendance_days%rowtype;
  v_before jsonb;
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

  select * into v_employee
  from public.set_employee
  where id = p_user_id;

  if not found
    or (v_employee.hire_date is not null and v_today < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_today > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法打卡' using errcode = '42501';
  end if;

  insert into public.attendance_days (user_id, work_date)
  values (p_user_id, p_work_date)
  on conflict (user_id, work_date) do nothing;

  select * into v_record
  from public.attendance_days
  where user_id = p_user_id
    and work_date = p_work_date
  for update;

  if v_record.reviewed_at is not null then
    raise exception '此日簽到紀錄已審，無法再打卡' using errcode = '23514';
  end if;

  v_before := to_jsonb(v_record);

  if p_kind = 'clock_in' then
    if v_record.clock_in_at is not null then
      return jsonb_build_object(
        'ok', true,
        'record', to_jsonb(v_record),
        'duplicate', true,
        'serverDate', p_work_date::text
      );
    end if;

    update public.attendance_days
    set clock_in_at = v_now,
        clock_in_location = coalesce(p_location, '{}'::jsonb)
    where id = v_record.id
    returning * into v_record;
  else
    if v_record.clock_out_at is not null then
      return jsonb_build_object(
        'ok', true,
        'record', to_jsonb(v_record),
        'duplicate', true,
        'serverDate', p_work_date::text
      );
    end if;

    update public.attendance_days
    set clock_out_at = v_now,
        clock_out_location = coalesce(p_location, '{}'::jsonb)
    where id = v_record.id
    returning * into v_record;
  end if;

  insert into public.attendance_audit_logs (
    attendance_day_id,
    action,
    changed_by,
    before_data,
    after_data
  )
  values (
    v_record.id,
    p_kind,
    p_user_id,
    v_before,
    to_jsonb(v_record)
  );

  return jsonb_build_object(
    'ok', true,
    'record', to_jsonb(v_record),
    'duplicate', false,
    'serverDate', p_work_date::text
  );
end;
$$;

revoke all on function public.save_attendance_clock(uuid, date, text, jsonb)
from public, anon, authenticated;
grant execute on function public.save_attendance_clock(uuid, date, text, jsonb)
to service_role;


-- ============================================================================================
-- 訂餐交易改讀每日簽到地點快照
-- ============================================================================================

create or replace function public.save_meal_order(
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
  v_now timestamptz := now();
  v_order_date date := (timezone('Asia/Taipei', v_now))::date;
  v_now_time time := (timezone('Asia/Taipei', v_now))::time;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_employee public.set_employee%rowtype;
  v_attendance public.attendance_days%rowtype;
  v_cutoff time;
  v_order_id uuid;
  v_submitted_at timestamptz;
  v_department_id uuid;
  v_department_name text;
  v_attendance_department_id uuid;
  v_clock_department_id uuid;
  v_clock_department_name text;
  v_existing_count integer := 0;
  v_new_count integer := 0;
begin
  if p_user_id is null then
    raise exception '缺少訂餐人員' using errcode = '23502';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception '訂餐品項格式錯誤' using errcode = '22023';
  end if;

  select * into v_employee
  from public.set_employee
  where id = p_user_id;

  if not found
    or (v_employee.hire_date is not null and v_order_date < v_employee.hire_date)
    or (v_employee.leave_date is not null and v_order_date > v_employee.leave_date + 5) then
    raise exception '帳號不在有效任職期間，無法訂餐' using errcode = '42501';
  end if;

  select * into v_attendance
  from public.attendance_days
  where user_id = p_user_id
    and work_date = v_order_date;

  v_clock_department_id := nullif(v_attendance.clock_in_location->>'departmentId', '')::uuid;
  v_clock_department_name := coalesce(v_attendance.clock_in_location->>'name', '');

  if not found or v_attendance.clock_in_at is null or v_clock_department_id is null then
    raise exception '請先完成上班打卡後再訂餐' using errcode = '23514';
  end if;

  select daily_cutoff_time into v_cutoff
  from public.meal_settings
  where id = 'default';

  v_cutoff := coalesce(v_cutoff, '10:30'::time);
  if v_now_time > v_cutoff then
    raise exception '今日訂餐已超過截止時間' using errcode = '23514';
  end if;

  select count(*) into v_existing_count
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date;

  select order_id, submitted_at, department_id, department_name_snapshot, attendance_department_id
  into v_order_id, v_submitted_at, v_department_id, v_department_name, v_attendance_department_id
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date
  order by submitted_at asc
  limit 1;

  v_order_id := coalesce(v_order_id, gen_random_uuid());
  v_submitted_at := coalesce(v_submitted_at, v_now);

  if exists (
    select 1
    from jsonb_array_elements(v_items) as raw(item)
    where nullif(raw.item->>'quantity', '') is not null
      and (
        (raw.item->>'quantity')::numeric < 0
        or floor((raw.item->>'quantity')::numeric) <> (raw.item->>'quantity')::numeric
      )
  ) then
    raise exception '訂餐數量必須是 0 或正整數' using errcode = '22023';
  end if;

  with incoming as (
    select
      nullif(raw.item->>'productId', '')::uuid as product_id,
      coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity
    from jsonb_array_elements(v_items) as raw(item)
  )
  select count(*) into v_new_count
  from incoming
  where product_id is not null
    and quantity > 0;

  if v_existing_count = 0 and v_new_count = 0 then
    raise exception '尚未選擇訂餐品項' using errcode = '23514';
  end if;

  if exists (
    with incoming as (
      select
        nullif(raw.item->>'productId', '')::uuid as product_id,
        coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity
      from jsonb_array_elements(v_items) as raw(item)
    ),
    aggregated as (
      select product_id, sum(quantity)::integer as quantity
      from incoming
      where product_id is not null
        and quantity > 0
      group by product_id
    )
    select 1
    from aggregated item
    left join public.meal_products product
      on product.id = item.product_id
    where product.id is null
       or (
         product.is_active is not true
         and not exists (
           select 1
           from public.meal_orders old_order
           where old_order.user_id = p_user_id
             and old_order.order_date = v_order_date
             and old_order.product_id = item.product_id
         )
       )
  ) then
    raise exception '訂餐品項不存在或已停用' using errcode = '23503';
  end if;

  delete from public.meal_orders
  where user_id = p_user_id
    and order_date = v_order_date;

  insert into public.meal_orders (
    order_id,
    user_id,
    employee_code_snapshot,
    employee_name_snapshot,
    order_date,
    department_id,
    department_name_snapshot,
    attendance_department_id,
    product_id,
    product_name_snapshot,
    quantity,
    unit_price,
    note,
    submitted_at,
    updated_at
  )
  with incoming as (
    select
      nullif(raw.item->>'productId', '')::uuid as product_id,
      coalesce(nullif(raw.item->>'quantity', '')::integer, 0) as quantity,
      nullif(trim(coalesce(raw.item->>'note', p_note, '')), '') as item_note
    from jsonb_array_elements(v_items) as raw(item)
  ),
  aggregated as (
    select
      product_id,
      sum(quantity)::integer as quantity,
      max(item_note) filter (where item_note is not null) as item_note
    from incoming
    where product_id is not null
      and quantity > 0
    group by product_id
  )
  select
    v_order_id,
    p_user_id,
    coalesce(v_employee.employee_code, ''),
    coalesce(v_employee.full_name, ''),
    v_order_date,
    coalesce(v_department_id, v_clock_department_id),
    coalesce(v_department_name, v_clock_department_name, ''),
    coalesce(v_attendance_department_id, v_department_id, v_clock_department_id),
    product.id,
    coalesce(product.name, ''),
    item.quantity,
    product.price,
    item.item_note,
    v_submitted_at,
    v_now
  from aggregated item
  join public.meal_products product
    on product.id = item.product_id;

  return jsonb_build_object(
    'ok', true,
    'orderDate', v_order_date::text,
    'orderId', v_order_id::text
  );
end;
$$;

revoke all on function public.save_meal_order(uuid, jsonb, text)
from public, anon, authenticated;
grant execute on function public.save_meal_order(uuid, jsonb, text)
to service_role;


-- ============================================================================================
-- 人員刪除歷史保護涵蓋新版簽到資料
-- ============================================================================================

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
  v_legacy_attendance_count bigint := 0;
  v_attendance_action_count bigint := 0;
  v_legacy_action_count bigint := 0;
  v_overtime_count bigint := 0;
  v_overtime_review_count bigint := 0;
  v_meal_count bigint := 0;
  v_settings_count bigint := 0;
  v_details text[] := array[]::text[];
begin
  select * into v_profile
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
  from public.attendance_days
  where user_id = p_target_id;

  if to_regclass('public.attendance_records') is not null then
    execute $legacy$
      select count(*)
      from public.attendance_records legacy_record
      where legacy_record.user_id = $1
        and not exists (
          select 1
          from public.attendance_days attendance_day
          where attendance_day.user_id = legacy_record.user_id
            and attendance_day.work_date = legacy_record.work_date
        )
    $legacy$
    into v_legacy_attendance_count
    using p_target_id;
  end if;
  v_attendance_count := v_attendance_count + v_legacy_attendance_count;

  select count(distinct audit_log.id) into v_attendance_action_count
  from public.attendance_audit_logs audit_log
  left join public.attendance_days attendance_day
    on attendance_day.id = audit_log.attendance_day_id
  where audit_log.changed_by = p_target_id
     or attendance_day.user_id = p_target_id;

  if to_regclass('public.attendance_action_logs') is not null
     and to_regclass('public.attendance_records') is not null then
    execute $legacy$
      select count(distinct action_log.id)
      from public.attendance_action_logs action_log
      left join public.attendance_records legacy_record
        on legacy_record.id = action_log.attendance_record_id
      where (action_log.operator_user_id = $1 or legacy_record.user_id = $1)
        and not exists (
          select 1
          from public.attendance_audit_logs audit_log
          where audit_log.id = action_log.id
        )
    $legacy$
    into v_legacy_action_count
    using p_target_id;
  end if;
  v_attendance_action_count := v_attendance_action_count + v_legacy_action_count;

  if to_regclass('public.attendance_overtime_requests') is not null then
    execute 'select count(*) from public.attendance_overtime_requests where user_id = $1'
      into v_overtime_count
      using p_target_id;
  end if;

  if to_regclass('public.overtime_review_logs') is not null
     and to_regclass('public.attendance_overtime_requests') is not null then
    execute $legacy$
      select count(distinct review_log.id)
      from public.overtime_review_logs review_log
      left join public.attendance_overtime_requests request
        on request.id = review_log.overtime_request_id
      where review_log.operator_user_id = $1
         or request.user_id = $1
    $legacy$
    into v_overtime_review_count
    using p_target_id;
  end if;

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
    v_details := array_append(v_details, format('簽到資料 %s 筆', v_attendance_count));
  end if;
  if v_attendance_action_count > 0 then
    v_details := array_append(v_details, format('簽到異動紀錄 %s 筆', v_attendance_action_count));
  end if;
  if v_overtime_count > 0 then
    v_details := array_append(v_details, format('舊加班申請 %s 筆', v_overtime_count));
  end if;
  if v_overtime_review_count > 0 then
    v_details := array_append(v_details, format('舊加班審核紀錄 %s 筆', v_overtime_review_count));
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
        'mealOrders', v_meal_count,
        'settings', v_settings_count
      )
    );
  end if;

  delete from auth.users
  where id = p_target_id;

  if exists (
    select 1
    from public.set_employee
    where id = p_target_id
  ) then
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

revoke all on function public.delete_member_account_v4(uuid)
from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid)
to service_role;
