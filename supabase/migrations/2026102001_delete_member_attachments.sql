-- 刪除人員時同時移除簽到附件資料與 Storage 實體檔案的待清理工作。
create table if not exists public.attendance_attachment_cleanup_queue (
  storage_path text primary key,
  created_at timestamptz not null default now()
);
alter table public.attendance_attachment_cleanup_queue enable row level security;
revoke all on public.attendance_attachment_cleanup_queue from public,anon,authenticated;
grant select,delete on public.attendance_attachment_cleanup_queue to service_role;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_schedule_count bigint := 0;
  v_unarchived_schedule_count bigint := 0;
  v_attendance_count bigint := 0;
  v_meal_count bigint := 0;
  v_attachment_count bigint := 0;
  v_today date := (timezone('Asia/Taipei',now()))::date;
begin
  select * into v_profile
  from public.set_employee
  where id=p_target_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok',true,'deleted',false,'softDeleted',false,'hardDeleted',false,'blocked',false);
  end if;

  select
    count(*),
    count(*) filter (where not public.is_schedule_date_archived(entry.group_id,entry.work_date))
  into v_schedule_count,v_unarchived_schedule_count
  from public.schedule_entries entry
  where entry.member_id=p_target_id;

  if v_unarchived_schedule_count>0 then
    return jsonb_build_object(
      'ok',false,
      'deleted',false,
      'softDeleted',false,
      'hardDeleted',false,
      'blocked',true,
      'code','MEMBER_HAS_UNARCHIVED_SCHEDULE',
      'message','此人員仍有未封存班表，請先完成班表封存或清除相關排班。',
      'history',jsonb_build_object('unarchivedSchedule',v_unarchived_schedule_count)
    );
  end if;

  if exists(
    select 1
    from public.access_roles role
    where role.id=v_profile.access_role_id
      and public.role_has_common_permission(role.id,'settings')
  )
  and public.is_employee_account_effective(v_profile.hire_date,v_profile.leave_date,v_today)
  and not exists(
    select 1
    from public.set_employee other_employee
    join public.access_roles other_role on other_role.id=other_employee.access_role_id
    where other_employee.id<>p_target_id
      and other_employee.deleted_at is null
      and public.role_has_common_permission(other_role.id,'settings')
      and public.is_employee_account_effective(other_employee.hire_date,other_employee.leave_date,v_today)
  ) then
    raise exception '系統必須保留至少一個有效的權限管理帳號' using errcode='23514';
  end if;

  select count(*) into v_attendance_count from public.attendance_days where user_id=p_target_id;
  select count(*) into v_meal_count from public.meal_orders where user_id=p_target_id;

  -- 清除被刪除人員所擁有的附件；實際 Storage 檔案由後端依佇列刪除。
  -- 不論實體或軟刪除，附件都隨人員刪除；資料庫操作保持交易一致性。
  select count(*) into v_attachment_count
  from public.attendance_attachments
  where owner_id=p_target_id;

  insert into public.attendance_attachment_cleanup_queue(storage_path)
  select storage_path from public.attendance_attachments where owner_id=p_target_id
  on conflict(storage_path) do nothing;

  delete from public.attendance_attachments where owner_id=p_target_id;

  -- 此人若曾刪除其他人的附件，不得誤刪其他人的資料。
  update public.attendance_attachments set deleted_by=null where deleted_by=p_target_id;

  if v_schedule_count=0 and v_attendance_count=0 and v_meal_count=0 then
    delete from public.set_employee where id=p_target_id;
    return jsonb_build_object(
      'ok',true,
      'deleted',true,
      'softDeleted',false,
      'hardDeleted',true,
      'attachmentsDeleted',v_attachment_count,
      'blocked',false,
      'employeeCode',v_profile.employee_code
    );
  end if;

  update public.set_employee
  set deleted_at=now(), updated_at=now()
  where id=p_target_id;

  return jsonb_build_object(
    'ok',true,
    'deleted',true,
    'softDeleted',true,
    'hardDeleted',false,
    'attachmentsDeleted',v_attachment_count,
    'blocked',false,
    'employeeCode',v_profile.employee_code,
    'history',jsonb_build_object(
      'schedule',v_schedule_count,
      'attendance',v_attendance_count,
      'mealOrders',v_meal_count
    )
  );
end
$$;

revoke all on function public.delete_member_account_v4(uuid) from public,anon,authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
