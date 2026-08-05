-- 福圓號 Supabase 舊出勤結構清理
--
-- 執行順序：
-- 001_current_schema.sql
-- 002_current_updates.sql
-- 003_attendance_ledger.sql
-- 004_remove_legacy_attendance.sql
--
-- 本系統尚未正式上線，舊打卡與加班測試資料不保留。
-- 本檔將人員歷史保護切換至新版每日簽到模型，並移除舊 RPC 與舊資料表。

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
  from public.attendance_days
  where user_id = p_target_id;

  select count(distinct audit_log.id) into v_attendance_action_count
  from public.attendance_audit_logs audit_log
  left join public.attendance_days attendance_day
    on attendance_day.id = audit_log.attendance_day_id
  where audit_log.changed_by = p_target_id
     or attendance_day.user_id = p_target_id;

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

revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
revoke all on function public.delete_member_account_v3(uuid) from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
grant execute on function public.delete_member_account_v3(uuid) to service_role;

drop function if exists public.admin_review_overtime_requests_v2(uuid[], text, numeric, numeric, uuid, text);
drop function if exists public.admin_update_attendance_record(uuid, uuid, date, timestamptz, uuid, timestamptz, uuid, text, uuid, text);

drop table if exists public.overtime_review_logs cascade;
drop table if exists public.attendance_overtime_requests cascade;
drop table if exists public.attendance_action_logs cascade;
drop table if exists public.attendance_records cascade;

commit;
