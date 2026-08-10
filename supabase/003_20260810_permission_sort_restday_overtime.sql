-- 2026-08-10：權限角色排序持久化 + 例假／休息日排班納入加班匯出
-- 執行順序：001_current_schema.sql -> 002_current_updates.sql -> 本檔。
-- 可重複執行。

begin;

alter table public.access_roles
  add column if not exists sort_order integer not null default 1000000;

with ranked as (
  select
    id,
    row_number() over (
      order by
        case code when 'admin' then 0 when 'manager' then 1 when 'employee' then 2 else 3 end,
        created_at,
        id
    ) - 1 as new_sort_order
  from public.access_roles
)
update public.access_roles role
set sort_order=ranked.new_sort_order
from ranked
where role.id=ranked.id
  and role.sort_order=1000000;

create index if not exists idx_access_roles_sort
  on public.access_roles(sort_order,name,id);

create or replace function public.get_group_access_bundle_v1()
returns jsonb language sql stable security definer set search_path=public,pg_catalog as $$
with actor as(
 select employee.id,employee.group_id,employee.access_role_id,role.name role_name,role.permissions
 from public.set_employee employee join public.access_roles role on role.id=employee.access_role_id
 where employee.id=(select auth.uid()) and employee.deleted_at is null
   and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
), actor_groups as(
 select role_group.group_id from actor join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
), visible_groups as(
 select grp.* from public.schedule_groups grp
 where grp.deleted_at is null and (public.has_access_permission((select auth.uid()),'permission_settings') or grp.id in(select group_id from actor_groups))
), role_rows as(
 select role.id,role.code,role.name,role.permissions,role.is_system,role.sort_order,
   coalesce(array_agg(role_group.group_id order by grp.sort_order,grp.name) filter(where grp.id is not null),'{}') group_ids
 from public.access_roles role
 left join public.access_role_groups role_group on role_group.role_id=role.id
 left join public.schedule_groups grp on grp.id=role_group.group_id and grp.deleted_at is null
 where exists(select 1 from actor)
   and (public.has_access_permission((select auth.uid()),'permission_settings')
     or public.has_access_permission((select auth.uid()),'member_settings')
     or role.id=(select access_role_id from actor))
 group by role.id
)
select jsonb_build_object(
 'actor',coalesce((select jsonb_build_object(
   'groupId',group_id,'roleId',access_role_id,'roleName',role_name,'permissions',permissions,
   'applicableGroupIds',coalesce((select jsonb_agg(group_id) from actor_groups),'[]'::jsonb)
 ) from actor),'{}'::jsonb),
 'groups',coalesce((select jsonb_agg(jsonb_build_object(
   'id',grp.id,'code',grp.code,'name',grp.name,'mealEnabled',grp.meal_enabled,'status',grp.status,
   'sortOrder',grp.sort_order,'unitNames',coalesce((select jsonb_agg(department.name order by department.sort_order,department.name)
      from public.set_departments department where department.group_id=grp.id and department.deleted_at is null),'[]'::jsonb)
 ) order by grp.sort_order,grp.name) from visible_groups grp),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object(
   'id',id,'code',code,'name',name,'permissions',permissions,'isSystem',is_system,'groupIds',group_ids,'sortOrder',sort_order
 ) order by sort_order,name,id) from role_rows),'[]'::jsonb)
)
$$;

create or replace function public.reorder_settings_v3(p_category text,p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_category text:=lower(btrim(coalesce(p_category,''))); v_id uuid; v_index integer:=0; v_group_id uuid; begin
  if p_ids is null then raise exception '排序資料不可空白'; end if;
  foreach v_id in array p_ids loop
    if v_category='department' then
      select group_id into v_group_id from public.set_departments where id=v_id and deleted_at is null;
      if v_group_id is null or not public.can_access_group(auth.uid(),v_group_id,'department_settings') then raise exception '沒有單位排序權限' using errcode='42501'; end if;
      update public.set_departments set sort_order=v_index,updated_at=now() where id=v_id;
    elsif v_category='member' then
      select group_id into v_group_id from public.set_employee where id=v_id and deleted_at is null;
      if v_group_id is null or not public.can_access_group(auth.uid(),v_group_id,'member_settings') then raise exception '沒有人員排序權限' using errcode='42501'; end if;
      update public.set_employee set sort_order=v_index,updated_at=now() where id=v_id;
    elsif v_category='shift' then
      select group_id into v_group_id from public.set_shift where id=v_id and deleted_at is null;
      if v_group_id is null or not public.can_access_group(auth.uid(),v_group_id,'schedule_manage') then raise exception '沒有班別排序權限' using errcode='42501'; end if;
      update public.set_shift set sort_order=v_index,updated_at=now() where id=v_id;
    elsif v_category='leave' then
      if not public.has_access_permission(auth.uid(),'leave_settings') then raise exception '沒有假別排序權限' using errcode='42501'; end if;
      update public.set_leave set sort_order=v_index,updated_at=now() where id=v_id and deleted_at is null;
    elsif v_category='overtime' then
      if not public.has_access_permission(auth.uid(),'leave_settings') then raise exception '沒有加班設定排序權限' using errcode='42501'; end if;
      update public.set_overtime set sort_order=v_index,updated_at=now() where id=v_id and deleted_at is null;
    elsif v_category='access-role' then
      if not public.has_access_permission(auth.uid(),'permission_settings') then raise exception '沒有角色排序權限' using errcode='42501'; end if;
      if not exists(select 1 from public.access_roles where id=v_id) then raise exception '找不到權限角色'; end if;
      update public.access_roles set sort_order=v_index,updated_at=now() where id=v_id;
    else
      raise exception '不支援的排序類型';
    end if;
    v_index:=v_index+1;
  end loop;
  return jsonb_build_object('ok',true,'category',v_category,'count',coalesce(array_length(p_ids,1),0));
end
$$;

create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(
  member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,
  leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,
  overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,
  overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text
)
language plpgsql
stable
security definer
set search_path=public,pg_catalog
as $$
begin
  if not public.has_access_permission(auth.uid(),'schedule_manage') then
    raise exception '沒有班表管理權限' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date-p_start_date>366 then
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
    case
      when schedule.overtime_type_id is not null then schedule.overtime_type_id
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例假','休息日'))
        then schedule.shift_type_id
      else null
    end,
    case
      when schedule.overtime_type_id is not null then overtime_type.name
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例假','休息日'))
        then '例休排班'
      else null
    end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_start_time
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例假','休息日'))
        then shift_type.start_time
      else null
    end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_end_time
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例假','休息日'))
        then shift_type.end_time
      else null
    end,
    case when schedule.overtime_type_id is not null then schedule.overtime_use_rest_1 else false end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_1_start_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_1_end_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_use_rest_2 else false end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_2_start_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_2_end_time else null end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_reason
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例假','休息日'))
        then '例假／休息日排班'
      else null
    end
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id=schedule.member_id
  left join public.set_departments department on department.id=employee.home_department_id
  left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
  left join public.set_shift shift_type on shift_type.id=schedule.shift_type_id
  where schedule.work_date between p_start_date and p_end_date
    and public.role_applies_to_group(auth.uid(),schedule.group_id)
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end;
$$;

revoke all on function public.get_group_access_bundle_v1() from public,anon;
revoke all on function public.reorder_settings_v3(text,uuid[]) from public,anon;
revoke all on function public.get_schedule_export_rows_v2(date,date) from public,anon;
grant execute on function public.get_group_access_bundle_v1() to authenticated,service_role;
grant execute on function public.reorder_settings_v3(text,uuid[]) to authenticated,service_role;
grant execute on function public.get_schedule_export_rows_v2(date,date) to authenticated,service_role;

commit;
