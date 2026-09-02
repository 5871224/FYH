-- 2026-09-02 access-control v2 正式升級
-- 目的：由 legacy access_roles.permissions + access_role_groups
--       升級為 common_permissions + access_role_group_permissions。
-- 本 migration 針對既有正式資料庫執行；全程交易，任一步失敗即回滾。

begin;

alter table public.access_roles
  add column if not exists common_permissions text[] not null default '{}';

create table if not exists public.access_role_group_permissions (
  role_id uuid not null references public.access_roles(id) on delete cascade,
  group_id uuid not null references public.schedule_groups(id) on delete cascade,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, group_id)
);

create index if not exists idx_access_role_group_permissions_group
  on public.access_role_group_permissions(group_id,role_id);

alter table public.access_role_group_permissions enable row level security;
revoke all privileges on table public.access_role_group_permissions from public,anon,authenticated;
grant all privileges on table public.access_role_group_permissions to service_role;

-- 先直接從 legacy 欄位／關聯表搬資料；此時尚不依賴任何新 helper。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_roles' and column_name='permissions'
  ) then
    execute $migrate$
      update public.access_roles
      set common_permissions = array_remove(array[
        case when permissions && array['permission_settings','group_settings']::text[] then 'settings' end,
        case when 'schedule_manage'=any(coalesce(permissions,'{}'::text[])) then 'export' end,
        case when 'leave_settings'=any(coalesce(permissions,'{}'::text[])) then 'leave_settings' end
      ], null)
    $migrate$;
  end if;

  if to_regclass('public.access_role_groups') is not null and exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_roles' and column_name='permissions'
  ) then
    execute $migrate$
      insert into public.access_role_group_permissions(role_id,group_id,permissions)
      select legacy.role_id,legacy.group_id,
        array_remove(array[
          case when role.permissions && array['schedule_view','schedule_manage','member_settings']::text[] then 'schedule_view' end,
          case when role.permissions && array['schedule_manage','member_settings']::text[] then 'schedule_manage' end,
          case when 'department_settings'=any(coalesce(role.permissions,'{}'::text[])) then 'department_settings' end,
          case when 'attendance_review'=any(coalesce(role.permissions,'{}'::text[])) then 'attendance_review' end,
          case when 'meal_admin'=any(coalesce(role.permissions,'{}'::text[])) then 'meal_admin' end
        ], null)
      from public.access_role_groups legacy
      join public.access_roles role on role.id=legacy.role_id
      on conflict(role_id,group_id) do update
      set permissions=excluded.permissions,updated_at=now()
    $migrate$;
  end if;
end
$$;

create or replace function public.current_access_role_id(p_user_id uuid)
returns uuid
language sql stable security definer set search_path=public,pg_catalog
as $$
  select access_role_id
  from public.set_employee
  where id=p_user_id and deleted_at is null
$$;

create or replace function public.role_has_common_permission(p_role_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.access_roles role
    where role.id=p_role_id
      and p_permission=any(coalesce(role.common_permissions,'{}'::text[]))
  )
$$;

create or replace function public.role_has_group_permission(p_role_id uuid,p_group_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.access_role_group_permissions item
    where item.role_id=p_role_id
      and item.group_id=p_group_id
      and p_permission=any(coalesce(item.permissions,'{}'::text[]))
  )
$$;

create or replace function public.role_has_any_group_permission(p_role_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.access_role_group_permissions item
    where item.role_id=p_role_id
      and p_permission=any(coalesce(item.permissions,'{}'::text[]))
  )
$$;

create or replace function public.has_common_permission(p_user_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.set_employee employee
    where employee.id=p_user_id
      and employee.deleted_at is null
      and public.role_has_common_permission(employee.access_role_id,p_permission)
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
  )
$$;

create or replace function public.has_group_permission(p_user_id uuid,p_group_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.set_employee employee
    where employee.id=p_user_id
      and employee.deleted_at is null
      and public.role_has_group_permission(employee.access_role_id,p_group_id,p_permission)
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
  )
$$;

create or replace function public.has_any_group_permission(p_user_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.set_employee employee
    where employee.id=p_user_id
      and employee.deleted_at is null
      and public.role_has_any_group_permission(employee.access_role_id,p_permission)
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
  )
$$;

create or replace function public.has_group_access(p_user_id uuid,p_group_id uuid)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select exists(
    select 1
    from public.set_employee employee
    join public.access_role_group_permissions item
      on item.role_id=employee.access_role_id and item.group_id=p_group_id
    where employee.id=p_user_id
      and employee.deleted_at is null
      and cardinality(coalesce(item.permissions,'{}'::text[]))>0
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
  )
$$;

-- 過渡期內仍可能被既有 RPC 呼叫的舊 helper，改為只讀新版唯一權限來源。
-- 不再讀 access_roles.permissions 或 access_role_groups，且不授權瀏覽器直接呼叫。
create or replace function public.has_access_permission(p_user_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select case p_permission
    when 'permission_settings' then public.has_common_permission(p_user_id,'settings')
    when 'group_settings' then public.has_common_permission(p_user_id,'settings')
    when 'leave_settings' then public.has_common_permission(p_user_id,'leave_settings')
    when 'schedule_manage' then public.has_common_permission(p_user_id,'export')
    when 'member_settings' then public.has_any_group_permission(p_user_id,'schedule_manage')
    when 'schedule_view' then public.has_any_group_permission(p_user_id,'schedule_view')
    when 'department_settings' then public.has_any_group_permission(p_user_id,'department_settings')
    when 'attendance_review' then public.has_any_group_permission(p_user_id,'attendance_review')
    when 'meal_admin' then public.has_any_group_permission(p_user_id,'meal_admin')
    else false
  end
$$;

create or replace function public.role_applies_to_group(p_user_id uuid,p_group_id uuid)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select public.has_group_access(p_user_id,p_group_id)
$$;

create or replace function public.can_access_group(p_user_id uuid,p_group_id uuid,p_permission text)
returns boolean
language sql stable security definer set search_path=public,pg_catalog
as $$
  select case p_permission
    when 'member_settings' then public.has_group_permission(p_user_id,p_group_id,'schedule_manage')
    when 'schedule_manage' then public.has_group_permission(p_user_id,p_group_id,'schedule_manage')
    when 'schedule_view' then public.has_group_permission(p_user_id,p_group_id,'schedule_view')
    when 'department_settings' then public.has_group_permission(p_user_id,p_group_id,'department_settings')
    when 'attendance_review' then public.has_group_permission(p_user_id,p_group_id,'attendance_review')
    when 'meal_admin' then public.has_group_permission(p_user_id,p_group_id,'meal_admin')
    when 'permission_settings' then public.has_common_permission(p_user_id,'settings') and public.has_group_access(p_user_id,p_group_id)
    when 'group_settings' then public.has_common_permission(p_user_id,'settings') and public.has_group_access(p_user_id,p_group_id)
    when 'leave_settings' then public.has_common_permission(p_user_id,'leave_settings') and public.has_group_access(p_user_id,p_group_id)
    else false
  end
$$;

revoke all on function public.has_access_permission(uuid,text) from public,anon,authenticated;
revoke all on function public.role_applies_to_group(uuid,uuid) from public,anon,authenticated;
revoke all on function public.can_access_group(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.has_access_permission(uuid,text),public.role_applies_to_group(uuid,uuid),public.can_access_group(uuid,uuid,text) to service_role;

-- 直接引用 legacy 表／欄位的現役 RPC 改成新版模型。
create or replace function public.get_schedule_archive_ranges_v1()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  with actor as (
    select employee.access_role_id
    from public.set_employee employee
    where employee.id=(select auth.uid())
      and employee.deleted_at is null
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
  ), allowed_groups as (
    select role_group.group_id
    from actor
    join public.access_role_group_permissions role_group
      on role_group.role_id=actor.access_role_id
    where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'groupId',archive.group_id,'startDate',archive.start_date,'endDate',archive.end_date
  ) order by archive.start_date,archive.end_date,archive.id),'[]'::jsonb)
  from public.schedule_archives archive
  join allowed_groups allowed on allowed.group_id=archive.group_id
$$;

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
      and public.is_employee_account_effective(
        employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
      )
    limit 1
  ), allowed_groups as materialized (
    select role_group.group_id
    from actor
    join public.access_role_group_permissions role_group
      on role_group.role_id=actor.access_role_id
    where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))
  )
  select entry.*
  from public.schedule_entries entry
  join allowed_groups allowed on allowed.group_id=entry.group_id
  where p_start_date is not null
    and p_end_date is not null
    and p_start_date<=p_end_date
    and entry.work_date between p_start_date and p_end_date
  order by entry.work_date,entry.member_id,entry.id
  limit least(greatest(coalesce(p_limit,1000),1),1000)
  offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.save_schedule_entries_v3(entries jsonb)
returns setof public.schedule_entries
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_role_id uuid;
  v_invalid boolean:=false;
begin
  select employee.access_role_id
  into v_role_id
  from public.set_employee employee
  join public.access_roles role on role.id=employee.access_role_id
  where employee.id=(select auth.uid())
    and employee.deleted_at is null
    and public.role_has_any_group_permission(role.id,'schedule_manage')
    and public.is_employee_account_effective(
      employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
    )
  limit 1;

  if v_role_id is null then
    raise exception '沒有班表管理權限' using errcode='42501';
  end if;
  if entries is null or jsonb_typeof(entries)<>'array' then
    raise exception '班表資料格式錯誤' using errcode='22023';
  end if;

  select exists(
    select 1
    from jsonb_to_recordset(entries) as item(
      delete_entry boolean,shift_type_id uuid,leave_type_id uuid,overtime_type_id uuid
    )
    where not coalesce(item.delete_entry,false)
      and item.shift_type_id is null
      and item.leave_type_id is null
      and item.overtime_type_id is null
  ) into v_invalid;
  if v_invalid then
    raise exception '班表儲存內容不可空白' using errcode='22023';
  end if;

  with incoming as materialized (
    select *
    from jsonb_to_recordset(entries) as item(
      member_id uuid,work_date date,delete_entry boolean,support_department_id uuid,
      shift_type_id uuid,leave_type_id uuid,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,
      overtime_type_id uuid,overtime_start_time time,overtime_end_time time,
      overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,
      overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text,note text
    )
  )
  select exists(
    select 1
    from incoming item
    left join public.set_employee member on member.id=item.member_id
    where item.member_id is null
       or item.work_date is null
       or member.id is null
       or member.group_id is null
       or not exists(
         select 1
         from public.access_role_group_permissions allowed
         where allowed.role_id=v_role_id
           and allowed.group_id=member.group_id
           and 'schedule_manage'=any(coalesce(allowed.permissions,'{}'::text[]))
       )
       or exists(
         select 1
         from public.schedule_archives archive
         where archive.group_id=member.group_id
           and item.work_date between archive.start_date and archive.end_date
       )
       or (member.deleted_at is not null and not coalesce(item.delete_entry,false))
  ) into v_invalid;

  if v_invalid then
    raise exception '包含無權管理、已封存或已刪除人員的班表資料' using errcode='42501';
  end if;

  return query
  with incoming as materialized (
    select *
    from jsonb_to_recordset(entries) as item(
      member_id uuid,work_date date,delete_entry boolean,support_department_id uuid,
      shift_type_id uuid,leave_type_id uuid,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,
      overtime_type_id uuid,overtime_start_time time,overtime_end_time time,
      overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,
      overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text,note text
    )
  ), deleted as (
    delete from public.schedule_entries entry
    using incoming item
    where entry.member_id=item.member_id
      and entry.work_date=item.work_date
      and coalesce(item.delete_entry,false)
    returning entry.*
  ), upserted as (
    insert into public.schedule_entries(
      member_id,work_date,support_department_id,shift_type_id,leave_type_id,leave_all_day,leave_start_time,leave_end_time,leave_reason,
      overtime_type_id,overtime_start_time,overtime_end_time,overtime_use_rest_1,overtime_rest_1_start_time,overtime_rest_1_end_time,
      overtime_use_rest_2,overtime_rest_2_start_time,overtime_rest_2_end_time,overtime_reason,note
    )
    select item.member_id,item.work_date,item.support_department_id,item.shift_type_id,item.leave_type_id,coalesce(item.leave_all_day,true),
      case when item.leave_type_id is null then null else item.leave_start_time end,
      case when item.leave_type_id is null then null else item.leave_end_time end,
      case when item.leave_type_id is null then null else item.leave_reason end,
      item.overtime_type_id,
      case when item.overtime_type_id is null then null else item.overtime_start_time end,
      case when item.overtime_type_id is null then null else item.overtime_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_1,false) end,
      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1,false) then null else item.overtime_rest_1_start_time end,
      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1,false) then null else item.overtime_rest_1_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_2,false) end,
      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2,false) then null else item.overtime_rest_2_start_time end,
      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2,false) then null else item.overtime_rest_2_end_time end,
      case when item.overtime_type_id is null then null else item.overtime_reason end,
      item.note
    from incoming item
    where not coalesce(item.delete_entry,false)
      and (item.shift_type_id is not null or item.leave_type_id is not null or item.overtime_type_id is not null)
    on conflict(member_id,work_date) do update set
      support_department_id=excluded.support_department_id,
      shift_type_id=excluded.shift_type_id,
      leave_type_id=excluded.leave_type_id,
      leave_all_day=excluded.leave_all_day,
      leave_start_time=excluded.leave_start_time,
      leave_end_time=excluded.leave_end_time,
      leave_reason=excluded.leave_reason,
      overtime_type_id=excluded.overtime_type_id,
      overtime_start_time=excluded.overtime_start_time,
      overtime_end_time=excluded.overtime_end_time,
      overtime_use_rest_1=excluded.overtime_use_rest_1,
      overtime_rest_1_start_time=excluded.overtime_rest_1_start_time,
      overtime_rest_1_end_time=excluded.overtime_rest_1_end_time,
      overtime_use_rest_2=excluded.overtime_use_rest_2,
      overtime_rest_2_start_time=excluded.overtime_rest_2_start_time,
      overtime_rest_2_end_time=excluded.overtime_rest_2_end_time,
      overtime_reason=excluded.overtime_reason,
      note=excluded.note,
      updated_at=now()
    returning *
  )
  select * from upserted;
end
$$;

create or replace function public.save_schedule_group_v1(p_group jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_meal boolean;
  v_status text;
  v_sort integer;
  v_row public.schedule_groups%rowtype;
begin
  if not public.has_common_permission(auth.uid(),'settings') then
    raise exception '沒有群組設定權限' using errcode='42501';
  end if;
  begin
    v_id:=nullif(btrim(p_group->>'id'),'')::uuid;
  exception when invalid_text_representation then
    raise exception '群組識別碼格式錯誤';
  end;
  v_code:=upper(regexp_replace(btrim(coalesce(p_group->>'code','')),'[^A-Za-z0-9_]+','','g'));
  v_name:=btrim(coalesce(p_group->>'name',''));
  v_meal:=coalesce((p_group->>'mealEnabled')::boolean,false);
  v_status:=case when p_group->>'status'='inactive' then 'inactive' else 'active' end;
  v_sort:=greatest(0,coalesce((p_group->>'sortOrder')::integer,0));
  if v_code='' or v_name='' then raise exception '群組代碼與群組名稱不可空白'; end if;
  if v_id is null then v_id:=gen_random_uuid(); end if;

  insert into public.schedule_groups(id,code,name,meal_enabled,status,sort_order,deleted_at)
  values(v_id,v_code,v_name,v_meal,v_status,v_sort,null)
  on conflict(id) do update set
    code=excluded.code,
    name=excluded.name,
    meal_enabled=excluded.meal_enabled,
    status=excluded.status,
    sort_order=excluded.sort_order,
    deleted_at=null,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object('ok',true,'group',jsonb_build_object(
    'id',v_row.id,'code',v_row.code,'name',v_row.name,'mealEnabled',v_row.meal_enabled,
    'status',v_row.status,'sortOrder',v_row.sort_order
  ));
end
$$;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_schedule_count bigint:=0;
  v_unarchived_schedule_count bigint:=0;
  v_attendance_count bigint:=0;
  v_meal_count bigint:=0;
  v_today date:=(timezone('Asia/Taipei',now()))::date;
begin
  select * into v_profile
  from public.set_employee
  where id=p_target_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok',true,'deleted',false,'softDeleted',false,'hardDeleted',false,'blocked',false);
  end if;

  select count(*),count(*) filter(where not public.is_schedule_date_archived(entry.group_id,entry.work_date))
  into v_schedule_count,v_unarchived_schedule_count
  from public.schedule_entries entry
  where entry.member_id=p_target_id;

  if v_unarchived_schedule_count>0 then
    return jsonb_build_object('ok',false,'deleted',false,'softDeleted',false,'hardDeleted',false,
      'blocked',true,'code','MEMBER_HAS_UNARCHIVED_SCHEDULE',
      'message','此人員仍有未封存班表，請先完成班表封存或清除相關排班。',
      'history',jsonb_build_object('unarchivedSchedule',v_unarchived_schedule_count));
  end if;

  if public.role_has_common_permission(v_profile.access_role_id,'settings')
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

  if v_schedule_count=0 and v_attendance_count=0 and v_meal_count=0 then
    delete from public.set_employee where id=p_target_id;
    return jsonb_build_object('ok',true,'deleted',true,'softDeleted',false,'hardDeleted',true,
      'blocked',false,'employeeCode',v_profile.employee_code);
  end if;

  update public.set_employee set deleted_at=now(),updated_at=now() where id=p_target_id;
  return jsonb_build_object('ok',true,'deleted',true,'softDeleted',true,'hardDeleted',false,
    'blocked',false,'employeeCode',v_profile.employee_code,
    'history',jsonb_build_object('schedule',v_schedule_count,'attendance',v_attendance_count,'mealOrders',v_meal_count));
end
$$;

create or replace function public.get_scheduler_bootstrap_v3(p_document_id text default 'default'::text)
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_catalog'
as $function$
with actor as materialized (
  select employee.access_role_id,
         public.role_has_common_permission(role.id,'settings') as can_manage_permissions
  from public.set_employee employee
  join public.access_roles role on role.id=employee.access_role_id
  where employee.id=(select auth.uid())
    and employee.deleted_at is null
    and public.role_has_any_group_permission(role.id,'schedule_view')
    and public.is_employee_account_effective(
      employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date
    )
  limit 1
), allowed_groups as materialized (
  select role_group.group_id
  from actor
  join public.access_role_group_permissions role_group on role_group.role_id=actor.access_role_id
  where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))
), visible_schedule as materialized (
  select entry.*
  from public.schedule_entries entry
  join allowed_groups allowed on allowed.group_id=entry.group_id
  where not exists(
    select 1 from public.schedule_archives archive
    where archive.group_id=entry.group_id
      and entry.work_date between archive.start_date and archive.end_date
  )
), visible_departments as (
  select department.*
  from public.set_departments department
  join allowed_groups allowed on allowed.group_id=department.group_id
  where department.deleted_at is null
     or exists(
       select 1 from visible_schedule entry
       left join public.set_employee member on member.id=entry.member_id
       where entry.support_department_id=department.id
          or (entry.support_department_id is null and member.home_department_id=department.id)
     )
), visible_members as (
  select member.*
  from public.set_employee member
  join allowed_groups allowed on allowed.group_id=member.group_id
  where member.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.member_id=member.id)
), visible_shifts as (
  select shift.*
  from public.set_shift shift
  join allowed_groups allowed on allowed.group_id=shift.group_id
  where shift.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.shift_type_id=shift.id)
), visible_leaves as (
  select leave_item.*
  from public.set_leave leave_item
  where leave_item.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.leave_type_id=leave_item.id)
), visible_overtime as (
  select overtime_item.*
  from public.set_overtime overtime_item
  where overtime_item.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.overtime_type_id=overtime_item.id)
)
select case when exists(select 1 from actor) then jsonb_build_object(
  'settings',coalesce((select to_jsonb(setting) from public.scheduler_settings setting where setting.id=coalesce(nullif(p_document_id,''),'default') limit 1),'{}'::jsonb),
  'departments',coalesce((select jsonb_agg(jsonb_build_object(
    'id',department.id,'name',department.name,'group_id',department.group_id,
    'start_date',department.start_date,'end_date',department.end_date,
    'hidden_from_schedule',department.hidden_from_schedule,'sort_order',department.sort_order,
    'deleted_at',department.deleted_at,
    'address',case when (select can_manage_permissions from actor limit 1) then department.address else null end,
    'latitude',case when (select can_manage_permissions from actor limit 1) then department.latitude else null end,
    'longitude',case when (select can_manage_permissions from actor limit 1) then department.longitude else null end,
    'public_ip',case when (select can_manage_permissions from actor limit 1) then department.public_ip else null end,
    'attendance_enabled',case when (select can_manage_permissions from actor limit 1) then department.attendance_enabled else false end
  ) order by department.sort_order,department.name,department.id) from visible_departments department),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object(
    'id',member.id,'employee_code',member.employee_code,'full_name',member.full_name,
    'group_id',member.group_id,'access_role_id',member.access_role_id,
    'home_department_id',member.home_department_id,'hire_date',member.hire_date,
    'leave_date',member.leave_date,'pay_by_day',member.pay_by_day,
    'fixed_rest_weekday',member.fixed_rest_weekday,'schedule_shift_ids',member.schedule_shift_ids,
    'monthly_rest_days',member.monthly_rest_days,'sort_order',member.sort_order,'deleted_at',member.deleted_at
  ) order by member.sort_order,member.full_name,member.id) from visible_members member),'[]'::jsonb),
  'shifts',coalesce((select jsonb_agg(to_jsonb(shift) order by shift.sort_order,shift.name,shift.id) from visible_shifts shift),'[]'::jsonb),
  'leaves',coalesce((select jsonb_agg(to_jsonb(leave_item) order by leave_item.sort_order,leave_item.code,leave_item.id) from visible_leaves leave_item),'[]'::jsonb),
  'overtime',coalesce((select jsonb_agg(to_jsonb(overtime_item) order by overtime_item.sort_order,overtime_item.name,overtime_item.id) from visible_overtime overtime_item),'[]'::jsonb),
  'holidays',coalesce((select jsonb_agg(to_jsonb(holiday) order by holiday.sort_order,holiday.holiday_date,holiday.id) from public.holidays holiday),'[]'::jsonb)
) else null end
$function$;

-- RLS 直接改用新版 helper。
drop policy if exists read_meal_orders on public.meal_orders;
create policy read_meal_orders on public.meal_orders
for select to authenticated
using(
  public.is_effective_user((select auth.uid()))
  and (user_id=(select auth.uid()) or public.has_group_permission((select auth.uid()),group_id,'meal_admin'))
);

drop policy if exists read_schedule_entries on public.schedule_entries;
create policy read_schedule_entries on public.schedule_entries
for select to authenticated
using(public.has_group_permission((select auth.uid()),group_id,'schedule_view'));

drop policy if exists read_set_departments on public.set_departments;
create policy read_set_departments on public.set_departments
for select to authenticated
using(deleted_at is null and public.has_group_access((select auth.uid()),group_id));

drop policy if exists read_set_employee on public.set_employee;
create policy read_set_employee on public.set_employee
for select to authenticated
using(deleted_at is null and (id=(select auth.uid()) or public.has_group_access((select auth.uid()),group_id)));

drop policy if exists read_set_leave on public.set_leave;
create policy read_set_leave on public.set_leave
for select to authenticated
using(
  public.is_effective_user((select auth.uid()))
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.leave_type_id=set_leave.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.has_group_access((select auth.uid()),entry.group_id)
    )
  )
);

drop policy if exists read_set_overtime on public.set_overtime;
create policy read_set_overtime on public.set_overtime
for select to authenticated
using(
  public.is_effective_user((select auth.uid()))
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.overtime_type_id=set_overtime.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.has_group_access((select auth.uid()),entry.group_id)
    )
  )
);

drop policy if exists read_set_shift on public.set_shift;
create policy read_set_shift on public.set_shift
for select to authenticated
using(
  public.has_group_access((select auth.uid()),group_id)
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.shift_type_id=set_shift.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.has_group_access((select auth.uid()),entry.group_id)
    )
  )
);

-- 舊角色 bundle / CRUD 已由 access-control Edge Function 取代。
revoke all on function public.get_group_access_bundle_v1() from public,anon,authenticated;
revoke all on function public.save_access_role_v1(jsonb) from public,anon,authenticated;
revoke all on function public.delete_access_role_v1(uuid) from public,anon,authenticated;
drop function if exists public.get_group_access_bundle_v1();
drop function if exists public.save_access_role_v1(jsonb);
drop function if exists public.delete_access_role_v1(uuid);

-- 此時現役函式已不直接依賴 legacy 欄位／關聯表；移除舊資料來源。
drop table if exists public.access_role_groups;
alter table public.access_roles drop column if exists permissions;

commit;
