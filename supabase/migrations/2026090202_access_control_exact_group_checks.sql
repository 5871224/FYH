-- 2026-09-02 access-control v2 精確群組權限收斂
-- 將仍沿用 legacy helper 組合判斷的現役 RPC 改成共用權限 + 指定群組權限直接驗證。

begin;

create or replace function public.get_schedule_archives_v1(p_group_id uuid default null)
returns table(
  id uuid,group_id uuid,group_code text,group_name text,start_date date,end_date date,
  archived_at timestamptz,archived_by_name text,member_count integer,entry_count integer
)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select archive.id,archive.group_id,archive.group_code_snapshot,archive.group_name_snapshot,
    archive.start_date,archive.end_date,archive.archived_at,archive.archived_by_name_snapshot,
    archive.member_count,archive.entry_count
  from public.schedule_archives archive
  where (p_group_id is null or archive.group_id=p_group_id)
    and public.has_group_permission((select auth.uid()),archive.group_id,'schedule_view')
  order by archive.start_date desc,archive.archived_at desc
$$;

create or replace function public.get_schedule_archive_detail_v1(p_archive_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_catalog
as $$
declare
  v_archive public.schedule_archives%rowtype;
  v_rows jsonb;
begin
  select * into v_archive
  from public.schedule_archives
  where id=p_archive_id;

  if not found
     or not public.has_group_permission((select auth.uid()),v_archive.group_id,'schedule_view') then
    raise exception '沒有查看此封存班表的權限' using errcode='42501';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(entry) order by entry.department_sort_order,entry.department_name_snapshot,
      entry.member_sort_order,entry.employee_name_snapshot,entry.work_date),
    '[]'::jsonb
  ) into v_rows
  from public.schedule_archive_entries entry
  where archive_id=p_archive_id;

  return jsonb_build_object('archive',to_jsonb(v_archive),'entries',v_rows);
end
$$;

create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(
  member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,
  pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,
  leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,
  overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,overtime_reason text
)
language plpgsql
stable
security definer
set search_path=public,pg_catalog
as $$
begin
  if not public.has_common_permission((select auth.uid()),'export') then
    raise exception '沒有匯出權限' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date-p_start_date>366 then
    raise exception '單次匯出期間不可超過 366 天';
  end if;

  return query
  select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,
    department.name,employee.pay_by_day,schedule.work_date,schedule.leave_type_id,leave_type.code,
    leave_type.name,schedule.leave_all_day,schedule.leave_start_time,schedule.leave_end_time,
    schedule.leave_reason,schedule.overtime_type_id,overtime_type.name,schedule.overtime_start_time,
    schedule.overtime_end_time,schedule.overtime_use_rest_1,schedule.overtime_rest_1_start_time,
    schedule.overtime_rest_1_end_time,schedule.overtime_use_rest_2,schedule.overtime_rest_2_start_time,
    schedule.overtime_rest_2_end_time,schedule.overtime_reason
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id=schedule.member_id
  left join public.set_departments department on department.id=employee.home_department_id
  left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
  where schedule.work_date between p_start_date and p_end_date
    and public.has_group_permission((select auth.uid()),schedule.group_id,'schedule_view')
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end
$$;

create or replace function public.validate_member_group_change_v1(p_employee_code text,p_new_group_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_member public.set_employee%rowtype;
  v_count bigint;
begin
  select * into v_member
  from public.set_employee
  where lower(employee_code)=lower(btrim(p_employee_code))
    and deleted_at is null;
  if not found then raise exception '找不到人員資料'; end if;

  if v_member.group_id is not null
     and not public.has_group_permission((select auth.uid()),v_member.group_id,'schedule_manage') then
    raise exception '沒有管理人員原群組的權限' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.schedule_groups
    where id=p_new_group_id and deleted_at is null and status='active'
  ) or not public.has_group_permission((select auth.uid()),p_new_group_id,'schedule_manage') then
    raise exception '沒有管理目標群組的權限' using errcode='42501';
  end if;

  if v_member.group_id is not distinct from p_new_group_id then return; end if;

  select count(*) into v_count
  from public.schedule_entries
  where member_id=v_member.id
    and not public.is_schedule_date_archived(group_id,work_date);
  if v_count>0 then
    raise exception '此人員在原群組仍有未封存班表，請先處理後再變更所屬群組';
  end if;
end
$$;

create or replace function public.delete_schedule_group_v1(p_group_id uuid,p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_group public.schedule_groups%rowtype;
  v_counts jsonb;
begin
  if not public.has_common_permission((select auth.uid()),'settings') then
    raise exception '沒有刪除此群組的權限' using errcode='42501';
  end if;

  select * into v_group
  from public.schedule_groups
  where id=p_group_id and deleted_at is null
  for update;
  if not found then raise exception '找不到群組'; end if;
  if btrim(coalesce(p_confirm_name,''))<>v_group.name then raise exception '群組名稱確認不符'; end if;

  select jsonb_build_object(
    'departments',(select count(*) from public.set_departments where group_id=p_group_id and deleted_at is null),
    'shifts',(select count(*) from public.set_shift where group_id=p_group_id and deleted_at is null),
    'members',(select count(*) from public.set_employee where group_id=p_group_id and deleted_at is null),
    'unarchivedSchedules',(select count(*) from public.schedule_entries where group_id=p_group_id and not public.is_schedule_date_archived(p_group_id,work_date)),
    'archives',(select count(*) from public.schedule_archives where group_id=p_group_id)
  ) into v_counts;

  delete from public.schedule_entries
  where group_id=p_group_id and not public.is_schedule_date_archived(p_group_id,work_date);
  perform set_config('fyh.group_delete','on',true);
  update public.set_employee
    set group_id=null,home_department_id=null,schedule_shift_ids='{}',updated_at=now()
    where group_id=p_group_id and deleted_at is null;
  update public.set_shift set deleted_at=now(),updated_at=now()
    where group_id=p_group_id and deleted_at is null;
  update public.set_departments set deleted_at=now(),updated_at=now()
    where group_id=p_group_id and deleted_at is null;
  update public.schedule_groups set deleted_at=now(),status='inactive',updated_at=now()
    where id=p_group_id;

  return jsonb_build_object('ok',true,'counts',v_counts);
end
$$;

create or replace function public.reorder_schedule_groups_v1(p_group_ids uuid[])
returns void
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid;
  v_order integer:=0;
begin
  if not public.has_common_permission((select auth.uid()),'settings') then
    raise exception '沒有群組設定權限' using errcode='42501';
  end if;
  foreach v_id in array coalesce(p_group_ids,'{}'::uuid[]) loop
    update public.schedule_groups
    set sort_order=v_order,updated_at=now()
    where id=v_id and deleted_at is null;
    v_order:=v_order+1;
  end loop;
end
$$;

create or replace function public.save_vietnamese_label_v1(p_entity text,p_id uuid,p_value text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_value text:=nullif(btrim(coalesce(p_value,'')),'');
  v_group_id uuid;
begin
  if v_user_id is null or not public.is_effective_user(v_user_id) then
    raise exception '請先登入' using errcode='42501';
  end if;
  if p_id is null then raise exception '缺少資料識別碼'; end if;

  case p_entity
    when 'group' then
      if not public.has_common_permission(v_user_id,'settings') then
        raise exception '沒有群組設定權限' using errcode='42501';
      end if;
      update public.schedule_groups set name_vi=v_value,updated_at=now()
      where id=p_id and deleted_at is null;

    when 'department' then
      select group_id into v_group_id from public.set_departments where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'department_settings') then
        raise exception '沒有單位設定權限' using errcode='42501';
      end if;
      update public.set_departments set name_vi=v_value,updated_at=now()
      where id=p_id and deleted_at is null;

    when 'member' then
      select group_id into v_group_id from public.set_employee where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'schedule_manage') then
        raise exception '沒有人員設定權限' using errcode='42501';
      end if;
      update public.set_employee set full_name_vi=v_value,updated_at=now()
      where id=p_id and deleted_at is null;

    when 'shift' then
      select group_id into v_group_id from public.set_shift where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'schedule_manage') then
        raise exception '沒有班表管理權限' using errcode='42501';
      end if;
      update public.set_shift set name_vi=v_value,updated_at=now()
      where id=p_id and deleted_at is null;

    when 'leave' then
      if not public.has_common_permission(v_user_id,'leave_settings') then
        raise exception '沒有假別設定權限' using errcode='42501';
      end if;
      update public.set_leave set name_vi=v_value,updated_at=now()
      where id=p_id and deleted_at is null;

    when 'role' then
      if not public.has_common_permission(v_user_id,'settings') then
        raise exception '沒有權限設定權限' using errcode='42501';
      end if;
      update public.access_roles set name_vi=v_value,updated_at=now()
      where id=p_id;

    when 'meal_product' then
      if not public.has_any_group_permission(v_user_id,'meal_admin') then
        raise exception '沒有訂餐管理權限' using errcode='42501';
      end if;
      update public.meal_products set name_vi=v_value,updated_at=now()
      where id=p_id;

    else
      raise exception '不支援的越文名稱類型';
  end case;

  if not found then raise exception '找不到要更新的資料'; end if;
end
$$;

revoke all on function public.get_schedule_archives_v1(uuid) from public,anon;
revoke all on function public.get_schedule_archive_detail_v1(uuid) from public,anon;
revoke all on function public.get_schedule_export_rows_v2(date,date) from public,anon;
revoke all on function public.validate_member_group_change_v1(text,uuid) from public,anon,authenticated;
revoke all on function public.delete_schedule_group_v1(uuid,text) from public,anon;
revoke all on function public.reorder_schedule_groups_v1(uuid[]) from public,anon;
revoke all on function public.save_vietnamese_label_v1(text,uuid,text) from public,anon;

grant execute on function public.get_schedule_archives_v1(uuid) to authenticated,service_role;
grant execute on function public.get_schedule_archive_detail_v1(uuid) to authenticated,service_role;
grant execute on function public.get_schedule_export_rows_v2(date,date) to authenticated,service_role;
grant execute on function public.validate_member_group_change_v1(text,uuid) to service_role;
grant execute on function public.delete_schedule_group_v1(uuid,text) to authenticated,service_role;
grant execute on function public.reorder_schedule_groups_v1(uuid[]) to authenticated,service_role;
grant execute on function public.save_vietnamese_label_v1(text,uuid,text) to authenticated,service_role;

commit;
