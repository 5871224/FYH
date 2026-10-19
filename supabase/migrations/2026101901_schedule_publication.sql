-- 2026-10-19 群組獨立的班表公開日期
begin;
alter table public.schedule_groups add column if not exists published_until date;

-- 班表公開日期（無設定時維持原有可查詢日期）。
create or replace function public.schedule_date_visible_to_actor_v1(p_group_id uuid,p_work_date date)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select p_group_id is not null and p_work_date is not null
    and public.has_group_permission(auth.uid(),p_group_id,'schedule_view')
    and exists (
      select 1 from public.schedule_groups grp where grp.id=p_group_id
        and (grp.published_until is null or p_work_date<=grp.published_until
          or public.has_group_permission(auth.uid(),p_group_id,'schedule_manage'))
    )
$$;
revoke all on function public.schedule_date_visible_to_actor_v1(uuid,date) from public,anon,authenticated;
grant execute on function public.schedule_date_visible_to_actor_v1(uuid,date) to service_role;

create or replace function public.set_group_schedule_publication_v1(p_group_id uuid,p_published_until date)
returns date language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_date date;
begin
  if p_group_id is null or not public.has_group_permission(auth.uid(),p_group_id,'schedule_manage') then
    raise exception '沒有班表管理權限' using errcode='42501';
  end if;
  if p_published_until is null then raise exception '請選擇公開截止日期' using errcode='22023'; end if;
  update public.schedule_groups set published_until=p_published_until,updated_at=now()
  where id=p_group_id and deleted_at is null returning published_until into v_date;
  if not found then raise exception '找不到群組' using errcode='22023'; end if;
  return v_date;
end
$$;
revoke all on function public.set_group_schedule_publication_v1(uuid,date) from public,anon,authenticated;
grant execute on function public.set_group_schedule_publication_v1(uuid,date) to authenticated,service_role;

create or replace function public.get_schedule_entries_v3(
  p_start_date date,
  p_end_date date,
  p_offset integer,
  p_limit integer
)
returns setof public.schedule_entries
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  with actor as materialized (
    select employee.access_role_id
    from public.set_employee employee
    join public.access_roles role on role.id=employee.access_role_id
    where employee.id=(select auth.uid())
      and employee.deleted_at is null
      and public.role_has_any_group_permission(role.id,'schedule_view')
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
    limit 1
  ),
  allowed_groups as materialized (
    select role_group.group_id
    from actor
    join public.access_role_group_permissions role_group on role_group.role_id=actor.access_role_id
  where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))
  )
  select entry.*
  from public.schedule_entries entry
  join allowed_groups allowed on allowed.group_id=entry.group_id
  where p_start_date is not null
    and p_end_date is not null
    and p_start_date<=p_end_date
    and entry.work_date between p_start_date and p_end_date
    and public.schedule_date_visible_to_actor_v1(entry.group_id,entry.work_date)
  order by entry.work_date,entry.member_id,entry.id
  limit least(greatest(coalesce(p_limit,1000),1),1000)
  offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text)
language plpgsql stable security definer set search_path=public,pg_catalog as $$
begin
 if not public.has_common_permission(auth.uid(),'export') then raise exception '沒有匯出權限' using errcode='42501'; end if;
 if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception '匯出日期範圍不正確'; end if;
 if p_end_date-p_start_date>366 then raise exception '單次匯出期間不可超過 366 天'; end if;
 return query select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,department.name,employee.pay_by_day,schedule.work_date,schedule.leave_type_id,leave_type.code,leave_type.name,schedule.leave_all_day,schedule.leave_start_time,schedule.leave_end_time,schedule.leave_reason,schedule.overtime_type_id,overtime_type.name,schedule.overtime_start_time,schedule.overtime_end_time,schedule.overtime_use_rest_1,schedule.overtime_rest_1_start_time,schedule.overtime_rest_1_end_time,schedule.overtime_use_rest_2,schedule.overtime_rest_2_start_time,schedule.overtime_rest_2_end_time,schedule.overtime_reason
 from public.schedule_entries schedule join public.set_employee employee on employee.id=schedule.member_id left join public.set_departments department on department.id=employee.home_department_id left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
 where schedule.work_date between p_start_date and p_end_date and public.schedule_date_visible_to_actor_v1(schedule.group_id,schedule.work_date) and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
 order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end $$;

create or replace function public.get_schedule_archives_v1(p_group_id uuid default null)
returns table(id uuid,group_id uuid,group_code text,group_name text,start_date date,end_date date,archived_at timestamptz,archived_by_name text,member_count integer,entry_count integer)
language sql stable security definer set search_path=public,pg_catalog as $$
 select archive.id,archive.group_id,archive.group_code_snapshot,archive.group_name_snapshot,archive.start_date,archive.end_date,archive.archived_at,archive.archived_by_name_snapshot,archive.member_count,archive.entry_count
 from public.schedule_archives archive where (p_group_id is null or archive.group_id=p_group_id) and public.has_group_access(auth.uid(),archive.group_id) and public.schedule_date_visible_to_actor_v1(archive.group_id,archive.start_date) order by archive.start_date desc,archive.archived_at desc
$$;

create or replace function public.get_schedule_archive_detail_v1(p_archive_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_catalog as $$
declare v_archive public.schedule_archives%rowtype; v_rows jsonb;
begin
 select * into v_archive from public.schedule_archives where id=p_archive_id;
 if not found or not public.has_group_access(auth.uid(),v_archive.group_id) or not public.schedule_date_visible_to_actor_v1(v_archive.group_id,v_archive.start_date) then raise exception '沒有查看此封存班表的權限' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(entry) order by entry.department_sort_order,entry.department_name_snapshot,entry.member_sort_order,entry.employee_name_snapshot,entry.work_date),'[]') into v_rows from public.schedule_archive_entries entry where archive_id=p_archive_id and public.schedule_date_visible_to_actor_v1(v_archive.group_id,entry.work_date);
 return jsonb_build_object('archive',to_jsonb(v_archive),'entries',v_rows);
end $$;
commit;
