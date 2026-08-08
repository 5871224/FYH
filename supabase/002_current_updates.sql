-- 福圓號 Supabase 現行增量更新
-- 執行順序：先執行 001_current_schema.sql，再完整執行本檔。
-- 本檔建立群組、角色權限、班表封存及群組化資料安全規則；可重複執行。

begin;

create table if not exists public.schedule_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  meal_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_role_groups (
  role_id uuid not null references public.access_roles(id) on delete cascade,
  group_id uuid not null references public.schedule_groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_id, group_id)
);

alter table public.set_departments
  add column if not exists group_id uuid,
  add column if not exists deleted_at timestamptz;

alter table public.set_employee
  add column if not exists group_id uuid,
  add column if not exists access_role_id uuid,
  add column if not exists deleted_at timestamptz;

alter table public.set_shift
  add column if not exists group_id uuid,
  add column if not exists deleted_at timestamptz;

alter table public.schedule_entries add column if not exists group_id uuid;
alter table public.attendance_days
  add column if not exists group_id uuid,
  add column if not exists group_name_snapshot text,
  add column if not exists department_name_snapshot text;
alter table public.meal_orders
  add column if not exists group_id uuid,
  add column if not exists group_name_snapshot text;

create table if not exists public.schedule_archives (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.schedule_groups(id) on delete set null,
  group_code_snapshot text not null,
  group_name_snapshot text not null,
  start_date date not null,
  end_date date not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.set_employee(id) on delete set null,
  archived_by_name_snapshot text not null default '',
  member_count integer not null default 0,
  entry_count integer not null default 0,
  check (start_date <= end_date)
);

create table if not exists public.schedule_archive_entries (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.schedule_archives(id) on delete cascade,
  source_schedule_entry_id uuid,
  source_member_id uuid,
  source_department_id uuid,
  source_shift_id uuid,
  source_leave_id uuid,
  source_overtime_id uuid,
  work_date date not null,
  employee_code_snapshot text not null default '',
  employee_name_snapshot text not null default '',
  member_sort_order integer not null default 0,
  department_name_snapshot text not null default '',
  department_sort_order integer not null default 0,
  shift_name_snapshot text not null default '',
  shift_start_time_snapshot time,
  shift_end_time_snapshot time,
  shift_color_snapshot text,
  shift_text_color_snapshot text,
  leave_code_snapshot text not null default '',
  leave_name_snapshot text not null default '',
  leave_color_snapshot text,
  overtime_name_snapshot text not null default '',
  overtime_color_snapshot text,
  leave_all_day boolean not null default true,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_reason text,
  note text,
  created_at timestamptz not null default now(),
  unique (archive_id, source_member_id, work_date)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='set_departments_group_id_fkey' and conrelid='public.set_departments'::regclass) then
    alter table public.set_departments add constraint set_departments_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='set_employee_group_id_fkey' and conrelid='public.set_employee'::regclass) then
    alter table public.set_employee add constraint set_employee_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='set_employee_access_role_id_fkey' and conrelid='public.set_employee'::regclass) then
    alter table public.set_employee add constraint set_employee_access_role_id_fkey foreign key(access_role_id) references public.access_roles(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='set_shift_group_id_fkey' and conrelid='public.set_shift'::regclass) then
    alter table public.set_shift add constraint set_shift_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='schedule_entries_group_id_fkey' and conrelid='public.schedule_entries'::regclass) then
    alter table public.schedule_entries add constraint schedule_entries_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='attendance_days_group_id_fkey' and conrelid='public.attendance_days'::regclass) then
    alter table public.attendance_days add constraint attendance_days_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='meal_orders_group_id_fkey' and conrelid='public.meal_orders'::regclass) then
    alter table public.meal_orders add constraint meal_orders_group_id_fkey foreign key(group_id) references public.schedule_groups(id) on delete set null;
  end if;
end $$;

create index if not exists idx_schedule_groups_active_sort on public.schedule_groups(deleted_at,status,sort_order,name);
create index if not exists idx_access_role_groups_group on public.access_role_groups(group_id,role_id);
create index if not exists idx_set_departments_group_id on public.set_departments(group_id) where deleted_at is null;
create index if not exists idx_set_employee_group_id on public.set_employee(group_id) where deleted_at is null;
create index if not exists idx_set_employee_access_role_id on public.set_employee(access_role_id) where deleted_at is null;
create index if not exists idx_set_shift_group_id on public.set_shift(group_id) where deleted_at is null;
create index if not exists idx_schedule_entries_group_date on public.schedule_entries(group_id,work_date);
create index if not exists idx_attendance_days_group_id on public.attendance_days(group_id);
create index if not exists idx_meal_orders_group_date on public.meal_orders(group_id,order_date);
create index if not exists idx_schedule_archives_group_date on public.schedule_archives(group_id,start_date,end_date);
create index if not exists idx_schedule_archive_entries_archive_date on public.schedule_archive_entries(archive_id,work_date);

insert into public.schedule_groups(code,name,meal_enabled,status,sort_order)
values('STORE','門市',true,'active',0)
on conflict(code) do nothing;

insert into public.access_roles(code,name,permissions,is_system) values
('admin','管理員',array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin'],true),
('manager','主管',array['schedule_view','schedule_manage','department_settings','member_settings','leave_settings','attendance_review','meal_admin'],true),
('employee','員工',array['schedule_view'],true)
on conflict(code) do nothing;

insert into public.access_role_groups(role_id,group_id)
select role.id, grp.id
from public.access_roles role
cross join public.schedule_groups grp
where role.code in ('admin','manager','employee') and grp.code='STORE'
on conflict do nothing;

update public.set_departments set group_id=(select id from public.schedule_groups where code='STORE') where group_id is null;
update public.set_employee set group_id=(select id from public.schedule_groups where code='STORE') where group_id is null and deleted_at is null;
update public.set_employee employee
set access_role_id=role.id
from public.access_roles role
where employee.access_role_id is null and role.code='employee';
update public.set_shift shift set group_id=department.group_id
from public.set_departments department
where shift.applicable_department_id=department.id and shift.group_id is distinct from department.group_id;
update public.schedule_entries entry set group_id=employee.group_id
from public.set_employee employee
where entry.member_id=employee.id and entry.group_id is distinct from employee.group_id;
update public.attendance_days day
set group_id=employee.group_id,
    group_name_snapshot=coalesce(nullif(day.group_name_snapshot,''),grp.name,''),
    department_name_snapshot=coalesce(nullif(day.department_name_snapshot,''),department.name,'')
from public.set_employee employee
left join public.schedule_groups grp on grp.id=employee.group_id
left join public.set_departments department on department.id=employee.home_department_id
where day.user_id=employee.id and (day.group_id is null or coalesce(day.group_name_snapshot,'')='' or coalesce(day.department_name_snapshot,'')='');
update public.meal_orders meal
set group_id=employee.group_id,
    group_name_snapshot=coalesce(nullif(meal.group_name_snapshot,''),grp.name,'')
from public.set_employee employee
left join public.schedule_groups grp on grp.id=employee.group_id
where meal.user_id=employee.id and (meal.group_id is null or coalesce(meal.group_name_snapshot,'')='');

alter table public.schedule_groups enable row level security;
alter table public.access_roles enable row level security;
alter table public.access_role_groups enable row level security;
alter table public.schedule_archives enable row level security;
alter table public.schedule_archive_entries enable row level security;

revoke all on public.schedule_groups,public.access_roles,public.access_role_groups,public.schedule_archives,public.schedule_archive_entries from public,anon,authenticated;
grant all on public.schedule_groups,public.access_roles,public.access_role_groups,public.schedule_archives,public.schedule_archive_entries to service_role;

commit;

create or replace function public.current_access_role_id(p_user_id uuid)
returns uuid language sql stable security definer set search_path=public,pg_catalog as $$
  select access_role_id from public.set_employee where id=p_user_id and deleted_at is null
$$;

create or replace function public.has_access_permission(p_user_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    join public.access_roles role on role.id=employee.access_role_id
    where employee.id=p_user_id and employee.deleted_at is null
      and p_permission=any(role.permissions)
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  )
$$;

create or replace function public.role_applies_to_group(p_user_id uuid,p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    join public.access_role_groups role_group on role_group.role_id=employee.access_role_id
    where employee.id=p_user_id and employee.deleted_at is null and role_group.group_id=p_group_id
  )
$$;

create or replace function public.can_access_group(p_user_id uuid,p_group_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select public.has_access_permission(p_user_id,p_permission) and public.role_applies_to_group(p_user_id,p_group_id)
$$;

create or replace function public.is_schedule_date_archived(p_group_id uuid,p_work_date date)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from public.schedule_archives where group_id=p_group_id and p_work_date between start_date and end_date)
$$;

create or replace function public.is_effective_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from public.set_employee employee
    where employee.id=p_user_id and employee.deleted_at is null
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date))
$$;

create or replace function public.set_shift_group_v1()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
declare v_group_id uuid;
begin
  if new.applicable_department_id is null then raise exception '班別必須綁定單位'; end if;
  select group_id into v_group_id from public.set_departments where id=new.applicable_department_id and deleted_at is null;
  if v_group_id is null then raise exception '班別所屬單位尚未設定群組或已刪除'; end if;
  if new.group_id is not null and new.group_id<>v_group_id then raise exception '班別群組必須與所屬單位一致'; end if;
  new.group_id:=v_group_id; return new;
end $$;

create or replace function public.set_schedule_entry_group_v1()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
declare v_group_id uuid;
begin
  select group_id into v_group_id from public.set_employee where id=new.member_id and deleted_at is null;
  if v_group_id is null then raise exception '排班人員尚未設定群組或已刪除'; end if;
  if new.group_id is not null and new.group_id<>v_group_id then raise exception '班表群組必須與人員所屬群組一致'; end if;
  if new.support_department_id is not null and not exists(select 1 from public.set_departments where id=new.support_department_id and group_id=v_group_id and deleted_at is null) then raise exception '支援單位不在人員所屬群組'; end if;
  if new.shift_type_id is not null and not exists(select 1 from public.set_shift where id=new.shift_type_id and group_id=v_group_id and deleted_at is null) then raise exception '班別不在人員所屬群組'; end if;
  new.group_id:=v_group_id; return new;
end $$;

create or replace function public.protect_archived_schedule_v1()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_old_group_id uuid; v_new_group_id uuid;
begin
  if tg_op in ('UPDATE','DELETE') then
    v_old_group_id:=old.group_id;
    if v_old_group_id is null then select group_id into v_old_group_id from public.set_employee where id=old.member_id; end if;
    if public.is_schedule_date_archived(v_old_group_id,old.work_date) then raise exception '此期間班表已封存，不可變動' using errcode='55000'; end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new_group_id:=new.group_id;
    if v_new_group_id is null then select group_id into v_new_group_id from public.set_employee where id=new.member_id; end if;
    if public.is_schedule_date_archived(v_new_group_id,new.work_date) then raise exception '此期間班表已封存，不可變動' using errcode='55000'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function public.stamp_attendance_group_v1()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group_id uuid; v_group_name text; v_department_name text;
begin
  if new.group_id is null or coalesce(new.group_name_snapshot,'')='' or coalesce(new.department_name_snapshot,'')='' then
    select employee.group_id,grp.name,department.name into v_group_id,v_group_name,v_department_name
    from public.set_employee employee left join public.schedule_groups grp on grp.id=employee.group_id
    left join public.set_departments department on department.id=employee.home_department_id where employee.id=new.user_id;
    new.group_id:=coalesce(new.group_id,v_group_id);
    new.group_name_snapshot:=coalesce(nullif(new.group_name_snapshot,''),v_group_name,'');
    new.department_name_snapshot:=coalesce(nullif(new.department_name_snapshot,''),v_department_name,'');
  end if; return new;
end $$;

create or replace function public.stamp_meal_group_v1()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group_id uuid; v_group_name text;
begin
  if new.group_id is null or coalesce(new.group_name_snapshot,'')='' then
    select employee.group_id,grp.name into v_group_id,v_group_name from public.set_employee employee
    left join public.schedule_groups grp on grp.id=employee.group_id where employee.id=new.user_id;
    new.group_id:=coalesce(new.group_id,v_group_id);
    new.group_name_snapshot:=coalesce(nullif(new.group_name_snapshot,''),v_group_name,'');
  end if; return new;
end $$;

create or replace function public.validate_member_group_change_v1(p_employee_code text,p_new_group_id uuid)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_member public.set_employee%rowtype; v_count bigint;
begin
  if not public.has_access_permission(auth.uid(),'member_settings') then raise exception '沒有人員設定權限' using errcode='42501'; end if;
  select * into v_member from public.set_employee where lower(employee_code)=lower(btrim(p_employee_code)) and deleted_at is null;
  if not found then raise exception '找不到人員資料'; end if;
  if v_member.group_id is not null and not public.role_applies_to_group(auth.uid(),v_member.group_id) then raise exception '此角色不可管理人員原群組' using errcode='42501'; end if;
  if not exists(select 1 from public.schedule_groups where id=p_new_group_id and deleted_at is null and status='active') or not public.role_applies_to_group(auth.uid(),p_new_group_id) then raise exception '此角色不可管理目標群組' using errcode='42501'; end if;
  if v_member.group_id is not distinct from p_new_group_id then return; end if;
  select count(*) into v_count from public.schedule_entries where member_id=v_member.id and not public.is_schedule_date_archived(group_id,work_date);
  if v_count>0 then raise exception '此人員在原群組仍有未封存班表，請先處理後再變更所屬群組'; end if;
end $$;

create or replace function public.save_schedule_group_v1(p_group jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_id uuid; v_code text; v_name text; v_meal boolean; v_status text; v_sort integer; v_actor_role uuid; v_created boolean:=false; v_row public.schedule_groups%rowtype;
begin
  if not public.has_access_permission(auth.uid(),'group_settings') then raise exception '沒有群組設定權限' using errcode='42501'; end if;
  begin v_id:=nullif(btrim(p_group->>'id'),'')::uuid; exception when invalid_text_representation then raise exception '群組識別碼格式錯誤'; end;
  v_code:=upper(regexp_replace(btrim(coalesce(p_group->>'code','')),'[^A-Za-z0-9_]+','','g')); v_name:=btrim(coalesce(p_group->>'name',''));
  v_meal:=coalesce((p_group->>'mealEnabled')::boolean,false); v_status:=case when p_group->>'status'='inactive' then 'inactive' else 'active' end; v_sort:=greatest(0,coalesce((p_group->>'sortOrder')::integer,0));
  if v_code='' or v_name='' then raise exception '群組代碼與群組名稱不可空白'; end if;
  if v_id is null then v_id:=gen_random_uuid(); v_created:=true;
  elsif not public.role_applies_to_group(auth.uid(),v_id) and not public.has_access_permission(auth.uid(),'permission_settings') then raise exception '此角色不可管理該群組' using errcode='42501'; end if;
  insert into public.schedule_groups(id,code,name,meal_enabled,status,sort_order,deleted_at) values(v_id,v_code,v_name,v_meal,v_status,v_sort,null)
  on conflict(id) do update set code=excluded.code,name=excluded.name,meal_enabled=excluded.meal_enabled,status=excluded.status,sort_order=excluded.sort_order,deleted_at=null,updated_at=now() returning * into v_row;
  if v_created then select access_role_id into v_actor_role from public.set_employee where id=auth.uid(); insert into public.access_role_groups values(v_actor_role,v_id,now()) on conflict do nothing; end if;
  return jsonb_build_object('ok',true,'group',jsonb_build_object('id',v_row.id,'code',v_row.code,'name',v_row.name,'mealEnabled',v_row.meal_enabled,'status',v_row.status,'sortOrder',v_row.sort_order));
end $$;

create or replace function public.reorder_schedule_groups_v1(p_group_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_id uuid; v_order integer:=0;
begin
  if not public.has_access_permission(auth.uid(),'group_settings') then raise exception '沒有群組設定權限' using errcode='42501'; end if;
  foreach v_id in array coalesce(p_group_ids,'{}') loop
    if public.role_applies_to_group(auth.uid(),v_id) or public.has_access_permission(auth.uid(),'permission_settings') then update public.schedule_groups set sort_order=v_order,updated_at=now() where id=v_id and deleted_at is null; v_order:=v_order+1; end if;
  end loop;
end $$;

create or replace function public.delete_schedule_group_v1(p_group_id uuid,p_confirm_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group public.schedule_groups%rowtype; v_counts jsonb;
begin
  if not public.has_access_permission(auth.uid(),'group_settings') or not public.role_applies_to_group(auth.uid(),p_group_id) then raise exception '沒有刪除此群組的權限' using errcode='42501'; end if;
  select * into v_group from public.schedule_groups where id=p_group_id and deleted_at is null for update; if not found then raise exception '找不到群組'; end if;
  if btrim(coalesce(p_confirm_name,''))<>v_group.name then raise exception '群組名稱確認不符'; end if;
  select jsonb_build_object('departments',(select count(*) from public.set_departments where group_id=p_group_id and deleted_at is null),'shifts',(select count(*) from public.set_shift where group_id=p_group_id and deleted_at is null),'members',(select count(*) from public.set_employee where group_id=p_group_id and deleted_at is null),'unarchivedSchedules',(select count(*) from public.schedule_entries where group_id=p_group_id and not public.is_schedule_date_archived(p_group_id,work_date)),'archives',(select count(*) from public.schedule_archives where group_id=p_group_id)) into v_counts;
  delete from public.schedule_entries where group_id=p_group_id and not public.is_schedule_date_archived(p_group_id,work_date);
  perform set_config('fyh.group_delete','on',true);
  update public.set_employee set group_id=null,home_department_id=null,schedule_shift_ids='{}',updated_at=now() where group_id=p_group_id and deleted_at is null;
  update public.set_shift set deleted_at=now(),updated_at=now() where group_id=p_group_id and deleted_at is null;
  update public.set_departments set deleted_at=now(),updated_at=now() where group_id=p_group_id and deleted_at is null;
  update public.schedule_groups set deleted_at=now(),status='inactive',updated_at=now() where id=p_group_id;
  return jsonb_build_object('ok',true,'counts',v_counts);
end $$;

create or replace function public.delete_access_role_v1(p_role_id uuid)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if not public.has_access_permission(auth.uid(),'permission_settings') then raise exception '沒有權限設定權限' using errcode='42501'; end if;
  if exists(select 1 from public.set_employee where access_role_id=p_role_id and deleted_at is null) then raise exception '此角色仍有人員使用，請先改用其他角色'; end if;
  if exists(select 1 from public.access_roles where id=p_role_id and 'permission_settings'=any(permissions)) and (select count(*) from public.access_roles where id<>p_role_id and 'permission_settings'=any(permissions))=0 then raise exception '系統必須保留至少一個權限設定角色'; end if;
  delete from public.access_roles where id=p_role_id;
end $$;

create or replace function public.archive_schedule_v1(p_group_id uuid,p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group public.schedule_groups%rowtype; v_actor_name text; v_archive_id uuid; v_entry_count integer; v_member_count integer;
begin
  if not public.can_access_group(auth.uid(),p_group_id,'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception '封存日期範圍不正確'; end if;
  if exists(select 1 from public.schedule_archives where group_id=p_group_id and daterange(start_date,end_date,'[]')&&daterange(p_start_date,p_end_date,'[]')) then raise exception '封存日期範圍不可重疊'; end if;
  select * into v_group from public.schedule_groups where id=p_group_id and deleted_at is null; if not found then raise exception '找不到群組'; end if;
  select full_name into v_actor_name from public.set_employee where id=auth.uid();
  insert into public.schedule_archives(group_id,group_code_snapshot,group_name_snapshot,start_date,end_date,archived_by,archived_by_name_snapshot)
  values(p_group_id,v_group.code,v_group.name,p_start_date,p_end_date,auth.uid(),coalesce(v_actor_name,'')) returning id into v_archive_id;
  insert into public.schedule_archive_entries(archive_id,source_schedule_entry_id,source_member_id,source_department_id,source_shift_id,source_leave_id,source_overtime_id,work_date,employee_code_snapshot,employee_name_snapshot,member_sort_order,department_name_snapshot,department_sort_order,shift_name_snapshot,shift_start_time_snapshot,shift_end_time_snapshot,shift_color_snapshot,shift_text_color_snapshot,leave_code_snapshot,leave_name_snapshot,leave_color_snapshot,overtime_name_snapshot,overtime_color_snapshot,leave_all_day,leave_start_time,leave_end_time,leave_reason,overtime_start_time,overtime_end_time,overtime_reason,note)
  select v_archive_id,entry.id,member.id,coalesce(entry.support_department_id,member.home_department_id),entry.shift_type_id,entry.leave_type_id,entry.overtime_type_id,archive_date.work_date,coalesce(member.employee_code,''),coalesce(member.full_name,''),coalesce(member.sort_order,0),coalesce(department.name,''),coalesce(department.sort_order,0),coalesce(shift.name,''),shift.start_time,shift.end_time,shift.color,shift.text_color,coalesce(leave_type.code,''),coalesce(leave_type.name,''),leave_type.color,coalesce(overtime_type.name,''),overtime_type.color,coalesce(entry.leave_all_day,true),entry.leave_start_time,entry.leave_end_time,entry.leave_reason,entry.overtime_start_time,entry.overtime_end_time,entry.overtime_reason,null
  from public.set_employee member cross join lateral(select generated_date::date work_date from generate_series(p_start_date,p_end_date,interval '1 day') generated_date) archive_date
  left join public.schedule_entries entry on entry.member_id=member.id and entry.work_date=archive_date.work_date and entry.group_id=p_group_id
  left join public.set_departments department on department.id=coalesce(entry.support_department_id,member.home_department_id)
  left join public.set_shift shift on shift.id=entry.shift_type_id left join public.set_leave leave_type on leave_type.id=entry.leave_type_id left join public.set_overtime overtime_type on overtime_type.id=entry.overtime_type_id
  where member.group_id=p_group_id and member.deleted_at is null and public.is_employee_employed_on(member.hire_date,member.leave_date,archive_date.work_date);
  select count(*),count(distinct source_member_id) into v_entry_count,v_member_count from public.schedule_archive_entries where archive_id=v_archive_id;
  update public.schedule_archives set entry_count=v_entry_count,member_count=v_member_count where id=v_archive_id;
  return jsonb_build_object('ok',true,'archiveId',v_archive_id,'entryCount',v_entry_count,'memberCount',v_member_count);
end $$;

create or replace function public.get_schedule_archives_v1(p_group_id uuid default null)
returns table(id uuid,group_id uuid,group_code text,group_name text,start_date date,end_date date,archived_at timestamptz,archived_by_name text,member_count integer,entry_count integer)
language sql stable security definer set search_path=public,pg_catalog as $$
 select archive.id,archive.group_id,archive.group_code_snapshot,archive.group_name_snapshot,archive.start_date,archive.end_date,archive.archived_at,archive.archived_by_name_snapshot,archive.member_count,archive.entry_count
 from public.schedule_archives archive where (p_group_id is null or archive.group_id=p_group_id) and public.role_applies_to_group(auth.uid(),archive.group_id) and public.has_access_permission(auth.uid(),'schedule_view') order by archive.start_date desc,archive.archived_at desc
$$;

create or replace function public.get_schedule_archive_detail_v1(p_archive_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_catalog as $$
declare v_archive public.schedule_archives%rowtype; v_rows jsonb;
begin
 select * into v_archive from public.schedule_archives where id=p_archive_id;
 if not found or not public.role_applies_to_group(auth.uid(),v_archive.group_id) or not public.has_access_permission(auth.uid(),'schedule_view') then raise exception '沒有查看此封存班表的權限' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(entry) order by entry.department_sort_order,entry.department_name_snapshot,entry.member_sort_order,entry.employee_name_snapshot,entry.work_date),'[]') into v_rows from public.schedule_archive_entries entry where archive_id=p_archive_id;
 return jsonb_build_object('archive',to_jsonb(v_archive),'entries',v_rows);
end $$;

create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text)
language plpgsql stable security definer set search_path=public,pg_catalog as $$
begin
 if not public.has_access_permission(auth.uid(),'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
 if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception '匯出日期範圍不正確'; end if;
 if p_end_date-p_start_date>366 then raise exception '單次匯出期間不可超過 366 天'; end if;
 return query select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,department.name,employee.pay_by_day,schedule.work_date,schedule.leave_type_id,leave_type.code,leave_type.name,schedule.leave_all_day,schedule.leave_start_time,schedule.leave_end_time,schedule.leave_reason,schedule.overtime_type_id,overtime_type.name,schedule.overtime_start_time,schedule.overtime_end_time,schedule.overtime_use_rest_1,schedule.overtime_rest_1_start_time,schedule.overtime_rest_1_end_time,schedule.overtime_use_rest_2,schedule.overtime_rest_2_start_time,schedule.overtime_rest_2_end_time,schedule.overtime_reason
 from public.schedule_entries schedule join public.set_employee employee on employee.id=schedule.member_id left join public.set_departments department on department.id=employee.home_department_id left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
 where schedule.work_date between p_start_date and p_end_date and public.role_applies_to_group(auth.uid(),schedule.group_id) and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
 order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end $$;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_profile public.set_employee%rowtype; v_unarchived bigint;
begin
 select * into v_profile from public.set_employee where id=p_target_id and deleted_at is null for update;
 if not found then return jsonb_build_object('ok',true,'deleted',false,'softDeleted',false,'blocked',false); end if;
 select count(*) into v_unarchived from public.schedule_entries where member_id=p_target_id and not public.is_schedule_date_archived(group_id,work_date);
 if v_unarchived>0 then return jsonb_build_object('ok',false,'deleted',false,'softDeleted',false,'blocked',true,'code','MEMBER_HAS_UNARCHIVED_SCHEDULE','message','此人員仍有未封存班表，請先完成班表封存或清除相關排班。','history',jsonb_build_object('unarchivedSchedule',v_unarchived)); end if;
 update public.set_employee set deleted_at=now(),leave_date=least(coalesce(leave_date,current_date-6),current_date-6),updated_at=now() where id=p_target_id;
 return jsonb_build_object('ok',true,'deleted',true,'softDeleted',true,'blocked',false,'employeeCode',v_profile.employee_code);
end $$;

begin;

drop trigger if exists trg_set_shift_group_v1 on public.set_shift;
create trigger trg_set_shift_group_v1 before insert or update on public.set_shift for each row execute function public.set_shift_group_v1();
drop trigger if exists trg_set_schedule_entry_group_v1 on public.schedule_entries;
create trigger trg_set_schedule_entry_group_v1 before insert or update on public.schedule_entries for each row execute function public.set_schedule_entry_group_v1();
drop trigger if exists trg_protect_archived_schedule_v1 on public.schedule_entries;
create trigger trg_protect_archived_schedule_v1 before insert or update or delete on public.schedule_entries for each row execute function public.protect_archived_schedule_v1();
drop trigger if exists trg_attendance_days_stamp_group on public.attendance_days;
create trigger trg_attendance_days_stamp_group before insert or update on public.attendance_days for each row execute function public.stamp_attendance_group_v1();
drop trigger if exists trg_meal_orders_stamp_group on public.meal_orders;
create trigger trg_meal_orders_stamp_group before insert or update on public.meal_orders for each row execute function public.stamp_meal_group_v1();


































revoke all on function public.delete_member_account_v4(uuid) from public,anon,authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;


commit;

-- 2026-08-08 班表解除封存與共用主檔軟刪除
begin;

alter table public.set_leave add column if not exists deleted_at timestamptz;
alter table public.set_overtime add column if not exists deleted_at timestamptz;

create index if not exists idx_set_leave_active_sort on public.set_leave(sort_order, code, id) where deleted_at is null;
create index if not exists idx_set_overtime_active_sort on public.set_overtime(sort_order, name, id) where deleted_at is null;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_unarchived_schedule_count bigint := 0;
begin
  select * into v_profile
  from public.set_employee
  where id=p_target_id and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok',true,'deleted',false,'softDeleted',false,'blocked',false);
  end if;

  select count(*) into v_unarchived_schedule_count
  from public.schedule_entries entry
  where entry.member_id=p_target_id
    and not public.is_schedule_date_archived(entry.group_id,entry.work_date);

  if v_unarchived_schedule_count>0 then
    return jsonb_build_object(
      'ok',false,
      'deleted',false,
      'softDeleted',false,
      'blocked',true,
      'code','MEMBER_HAS_UNARCHIVED_SCHEDULE',
      'message','此人員仍有未封存班表，請先完成班表封存或清除相關排班。',
      'history',jsonb_build_object('unarchivedSchedule',v_unarchived_schedule_count)
    );
  end if;

  update public.set_employee
  set deleted_at=now(), updated_at=now()
  where id=p_target_id;

  return jsonb_build_object(
    'ok',true,
    'deleted',true,
    'softDeleted',true,
    'blocked',false,
    'employeeCode',v_profile.employee_code
  );
end;
$$;

create or replace function public.archive_schedule_v1(p_group_id uuid,p_start_date date,p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_group public.schedule_groups%rowtype;
  v_actor_name text;
  v_archive_id uuid;
  v_entry_count integer;
  v_member_count integer;
begin
  if not public.can_access_group(auth.uid(),p_group_id,'schedule_manage') then
    raise exception '沒有班表管理權限' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then
    raise exception '封存日期範圍不正確';
  end if;
  if exists(
    select 1 from public.schedule_archives
    where group_id=p_group_id
      and daterange(start_date,end_date,'[]')&&daterange(p_start_date,p_end_date,'[]')
  ) then
    raise exception '封存日期範圍不可重疊';
  end if;

  select * into v_group
  from public.schedule_groups
  where id=p_group_id and deleted_at is null;
  if not found then raise exception '找不到群組'; end if;

  select full_name into v_actor_name from public.set_employee where id=auth.uid();

  insert into public.schedule_archives(
    group_id,group_code_snapshot,group_name_snapshot,start_date,end_date,archived_by,archived_by_name_snapshot
  ) values(
    p_group_id,v_group.code,v_group.name,p_start_date,p_end_date,auth.uid(),coalesce(v_actor_name,'')
  ) returning id into v_archive_id;

  insert into public.schedule_archive_entries(
    archive_id,source_schedule_entry_id,source_member_id,source_department_id,source_shift_id,source_leave_id,source_overtime_id,
    work_date,employee_code_snapshot,employee_name_snapshot,member_sort_order,department_name_snapshot,department_sort_order,
    shift_name_snapshot,shift_start_time_snapshot,shift_end_time_snapshot,shift_color_snapshot,shift_text_color_snapshot,
    leave_code_snapshot,leave_name_snapshot,leave_color_snapshot,overtime_name_snapshot,overtime_color_snapshot,
    leave_all_day,leave_start_time,leave_end_time,leave_reason,overtime_start_time,overtime_end_time,overtime_reason,note
  )
  select
    v_archive_id,entry.id,member.id,coalesce(entry.support_department_id,member.home_department_id),entry.shift_type_id,entry.leave_type_id,entry.overtime_type_id,
    archive_date.work_date,coalesce(member.employee_code,''),coalesce(member.full_name,''),coalesce(member.sort_order,0),
    coalesce(department.name,''),coalesce(department.sort_order,0),coalesce(shift.name,''),shift.start_time,shift.end_time,shift.color,shift.text_color,
    coalesce(leave_type.code,''),coalesce(leave_type.name,''),leave_type.color,coalesce(overtime_type.name,''),overtime_type.color,
    coalesce(entry.leave_all_day,true),entry.leave_start_time,entry.leave_end_time,entry.leave_reason,
    entry.overtime_start_time,entry.overtime_end_time,entry.overtime_reason,null
  from public.set_employee member
  cross join lateral(
    select generated_date::date work_date
    from generate_series(p_start_date,p_end_date,interval '1 day') generated_date
  ) archive_date
  left join public.schedule_entries entry
    on entry.member_id=member.id and entry.work_date=archive_date.work_date and entry.group_id=p_group_id
  left join public.set_departments department on department.id=coalesce(entry.support_department_id,member.home_department_id)
  left join public.set_shift shift on shift.id=entry.shift_type_id
  left join public.set_leave leave_type on leave_type.id=entry.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id=entry.overtime_type_id
  where member.group_id=p_group_id
    and (
      (member.deleted_at is null and public.is_employee_employed_on(member.hire_date,member.leave_date,archive_date.work_date))
      or entry.id is not null
    );

  select count(*),count(distinct source_member_id)
  into v_entry_count,v_member_count
  from public.schedule_archive_entries
  where archive_id=v_archive_id;

  update public.schedule_archives
  set entry_count=v_entry_count,member_count=v_member_count
  where id=v_archive_id;

  return jsonb_build_object('ok',true,'archiveId',v_archive_id,'entryCount',v_entry_count,'memberCount',v_member_count);
end;
$$;

create or replace function public.unarchive_schedule_v1(p_archive_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_archive public.schedule_archives%rowtype;
begin
  select * into v_archive
  from public.schedule_archives
  where id=p_archive_id
  for update;

  if not found then raise exception '找不到封存班表'; end if;
  if not public.can_access_group(auth.uid(),v_archive.group_id,'schedule_manage') then
    raise exception '沒有解除封存權限' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.schedule_groups
    where id=v_archive.group_id and deleted_at is null
  ) then
    raise exception '群組已刪除，無法解除封存';
  end if;

  delete from public.schedule_archives where id=p_archive_id;

  return jsonb_build_object(
    'ok',true,
    'groupId',v_archive.group_id,
    'startDate',v_archive.start_date,
    'endDate',v_archive.end_date
  );
end;
$$;

create or replace function public.set_schedule_entry_group_v1()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_member public.set_employee%rowtype;
  v_existing public.schedule_entries%rowtype;
begin
  select * into v_member from public.set_employee where id=new.member_id;
  if not found or v_member.group_id is null then
    raise exception '排班人員尚未設定群組或已刪除';
  end if;
  if v_member.deleted_at is not null then
    raise exception '已刪除人員不可新增或修改班表；只能刪除原有班表';
  end if;

  if new.group_id is not null and new.group_id<>v_member.group_id then
    raise exception '班表群組必須與人員所屬群組一致';
  end if;

  select * into v_existing
  from public.schedule_entries
  where member_id=new.member_id and work_date=new.work_date;

  if new.support_department_id is not null and not exists(
    select 1 from public.set_departments d
    where d.id=new.support_department_id
      and d.group_id=v_member.group_id
      and (d.deleted_at is null or (v_existing.id is not null and v_existing.support_department_id=d.id))
  ) then
    raise exception '支援單位不在人員所屬群組或已刪除';
  end if;

  if new.shift_type_id is not null and not exists(
    select 1 from public.set_shift s
    where s.id=new.shift_type_id
      and s.group_id=v_member.group_id
      and (s.deleted_at is null or (v_existing.id is not null and v_existing.shift_type_id=s.id))
  ) then
    raise exception '班別不在人員所屬群組或已刪除';
  end if;

  if new.leave_type_id is not null and not exists(
    select 1 from public.set_leave l
    where l.id=new.leave_type_id
      and (l.deleted_at is null or (v_existing.id is not null and v_existing.leave_type_id=l.id))
  ) then
    raise exception '假別已刪除，不可重新選用';
  end if;

  if new.overtime_type_id is not null and not exists(
    select 1 from public.set_overtime o
    where o.id=new.overtime_type_id
      and (o.deleted_at is null or (v_existing.id is not null and v_existing.overtime_type_id=o.id))
  ) then
    raise exception '加班設定已刪除，不可重新選用';
  end if;

  new.group_id:=v_member.group_id;
  return new;
end;
$$;

-- 軟刪除主檔不得由一般 REST 實體刪除。




-- 已刪除班別只有在未封存歷史班表仍引用時可讀，且不可再新增／修改成已刪除狀態。



-- 假別與加班設定採軟刪除；歷史引用仍可顯示，但已刪除項目不可由 REST 寫回。












revoke all on function public.unarchive_schedule_v1(uuid) from public,anon;
grant execute on function public.unarchive_schedule_v1(uuid) to authenticated,service_role;

revoke all on function public.set_schedule_entry_group_v1() from public,anon,authenticated;

commit;

-- ============================================================================
-- Canonical permission access architecture
-- Browser clients call named SECURITY DEFINER RPCs only. Core tables are not
-- directly granted to anon/authenticated.
-- ============================================================================



create or replace function public.get_schedule_entries_v3(p_start_date date,p_end_date date)
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
      and 'schedule_view'=any(coalesce(role.permissions,'{}'::text[]))
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
    limit 1
  ),
  allowed_groups as materialized (
    select role_group.group_id
    from actor
    join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
  )
  select entry.*
  from public.schedule_entries entry
  join allowed_groups allowed on allowed.group_id=entry.group_id
  where p_start_date is not null
    and p_end_date is not null
    and p_start_date<=p_end_date
    and entry.work_date between p_start_date and p_end_date
  order by entry.work_date,entry.member_id
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
    and 'schedule_manage'=any(coalesce(role.permissions,'{}'::text[]))
    and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  limit 1;

  if v_role_id is null then
    raise exception '沒有班表管理權限' using errcode='42501';
  end if;
  if entries is null or jsonb_typeof(entries)<>'array' then
    raise exception '班表資料格式錯誤' using errcode='22023';
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
         select 1 from public.access_role_groups allowed
         where allowed.role_id=v_role_id and allowed.group_id=member.group_id
       )
       or exists(
         select 1 from public.schedule_archives archive
         where archive.group_id=member.group_id
           and item.work_date between archive.start_date and archive.end_date
       )
       or (member.deleted_at is not null and not (
         coalesce(item.delete_entry,false)
         or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null)
       ))
  ) into v_invalid;

  if v_invalid then
    raise exception '包含無權管理、已封存或已刪除人員的班表資料' using errcode='42501';
  end if;

  return query
  with incoming as materialized (
    select * from jsonb_to_recordset(entries) as item(
      member_id uuid,work_date date,delete_entry boolean,support_department_id uuid,
      shift_type_id uuid,leave_type_id uuid,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,
      overtime_type_id uuid,overtime_start_time time,overtime_end_time time,
      overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,
      overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text,note text
    )
  ),
  deleted as (
    delete from public.schedule_entries entry using incoming item
    where entry.member_id=item.member_id and entry.work_date=item.work_date
      and (coalesce(item.delete_entry,false) or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null))
    returning entry.*
  ),
  upserted as (
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
      shift_type_id=excluded.shift_type_id,leave_type_id=excluded.leave_type_id,leave_all_day=excluded.leave_all_day,
      leave_start_time=excluded.leave_start_time,leave_end_time=excluded.leave_end_time,leave_reason=excluded.leave_reason,
      overtime_type_id=excluded.overtime_type_id,overtime_start_time=excluded.overtime_start_time,overtime_end_time=excluded.overtime_end_time,
      overtime_use_rest_1=excluded.overtime_use_rest_1,overtime_rest_1_start_time=excluded.overtime_rest_1_start_time,overtime_rest_1_end_time=excluded.overtime_rest_1_end_time,
      overtime_use_rest_2=excluded.overtime_use_rest_2,overtime_rest_2_start_time=excluded.overtime_rest_2_start_time,overtime_rest_2_end_time=excluded.overtime_rest_2_end_time,
      overtime_reason=excluded.overtime_reason,note=excluded.note,updated_at=now()
    returning *
  )
  select * from upserted;
end
$$;

create or replace function public.save_shift_v3(p_shift jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid;
  v_name text;
  v_department_id uuid;
  v_group_id uuid;
  v_old_group_id uuid;
  v_existing_deleted timestamptz;
begin
  begin
    v_id:=nullif(btrim(p_shift->>'id'),'')::uuid;
    v_department_id:=nullif(btrim(p_shift->>'applicableDepartmentId'),'')::uuid;
  exception when invalid_text_representation then raise exception '班別識別碼格式錯誤'; end;
  v_name:=btrim(coalesce(p_shift->>'name',''));
  if v_id is null or v_department_id is null or v_name='' then raise exception '班別名稱與適用單位不可空白'; end if;

  select d.group_id into v_group_id from public.set_departments d
  where d.id=v_department_id and d.deleted_at is null;
  if v_group_id is null then raise exception '找不到可使用的適用單位'; end if;
  if not public.can_access_group(auth.uid(),v_group_id,'schedule_manage') then raise exception '沒有管理此群組班別的權限' using errcode='42501'; end if;

  select s.group_id,s.deleted_at into v_old_group_id,v_existing_deleted from public.set_shift s where s.id=v_id;
  if v_existing_deleted is not null then raise exception '已刪除班別不可重新啟用'; end if;
  if v_old_group_id is not null and v_old_group_id is distinct from v_group_id then
    if not public.can_access_group(auth.uid(),v_old_group_id,'schedule_manage') then raise exception '沒有管理原群組班別的權限' using errcode='42501'; end if;
    if exists(select 1 from public.schedule_entries e where e.shift_type_id=v_id and not public.is_schedule_date_archived(e.group_id,e.work_date)) then
      raise exception '此班別仍有未封存班表，無法跨群組移動';
    end if;
  end if;

  insert into public.set_shift(id,name,applicable_department_id,group_id,color,text_color,auto_text_color,hidden_from_toolbar,start_time,end_time,required_staff_count,sort_order)
  values(
    v_id,v_name,v_department_id,v_group_id,nullif(p_shift->>'color',''),nullif(p_shift->>'textColor',''),coalesce((p_shift->>'autoTextColor')::boolean,true),
    coalesce((p_shift->>'hiddenFromToolbar')::boolean,false),nullif(p_shift->>'startTime','')::time,nullif(p_shift->>'endTime','')::time,
    greatest(0,coalesce((p_shift->>'requiredStaffCount')::integer,0)),greatest(0,coalesce((p_shift->>'sortOrder')::integer,0))
  )
  on conflict(id) do update set name=excluded.name,applicable_department_id=excluded.applicable_department_id,group_id=excluded.group_id,
    color=excluded.color,text_color=excluded.text_color,auto_text_color=excluded.auto_text_color,hidden_from_toolbar=excluded.hidden_from_toolbar,
    start_time=excluded.start_time,end_time=excluded.end_time,required_staff_count=excluded.required_staff_count,sort_order=excluded.sort_order,updated_at=now()
  where public.set_shift.deleted_at is null;
  return jsonb_build_object('ok',true,'id',v_id,'groupId',v_group_id);
end
$$;

create or replace function public.save_catalog_item_v3(p_category text,p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_id uuid; v_category text:=lower(btrim(coalesce(p_category,''))); begin
  if not public.has_access_permission(auth.uid(),'leave_settings') then raise exception '沒有假別設定權限' using errcode='42501'; end if;
  begin v_id:=nullif(btrim(p_item->>'id'),'')::uuid; exception when invalid_text_representation then raise exception '設定識別碼格式錯誤'; end;
  if v_id is null then raise exception '缺少設定識別碼'; end if;
  if v_category='leave' then
    if btrim(coalesce(p_item->>'code',''))='' or btrim(coalesce(p_item->>'name',''))='' then raise exception '假別代碼與名稱不可空白'; end if;
    insert into public.set_leave(id,code,name,color,text_color,auto_text_color,hidden_from_toolbar,requires_time,requires_reason,sort_order)
    values(v_id,btrim(p_item->>'code'),btrim(p_item->>'name'),nullif(p_item->>'color',''),nullif(p_item->>'textColor',''),coalesce((p_item->>'autoTextColor')::boolean,true),coalesce((p_item->>'hiddenFromToolbar')::boolean,false),coalesce((p_item->>'requiresTime')::boolean,false),coalesce((p_item->>'requiresReason')::boolean,false),greatest(0,coalesce((p_item->>'sortOrder')::integer,0)))
    on conflict(id) do update set code=excluded.code,name=excluded.name,color=excluded.color,text_color=excluded.text_color,auto_text_color=excluded.auto_text_color,hidden_from_toolbar=excluded.hidden_from_toolbar,requires_time=excluded.requires_time,requires_reason=excluded.requires_reason,sort_order=excluded.sort_order,updated_at=now()
    where public.set_leave.deleted_at is null;
  elsif v_category='overtime' then
    if btrim(coalesce(p_item->>'name',''))='' then raise exception '加班名稱不可空白'; end if;
    insert into public.set_overtime(id,name,color,text_color,auto_text_color,hidden_from_toolbar,start_time,end_time,use_rest_1,rest_1_start_time,rest_1_end_time,use_rest_2,rest_2_start_time,rest_2_end_time,sort_order)
    values(v_id,btrim(p_item->>'name'),nullif(p_item->>'color',''),nullif(p_item->>'textColor',''),coalesce((p_item->>'autoTextColor')::boolean,true),coalesce((p_item->>'hiddenFromToolbar')::boolean,false),nullif(p_item->>'startTime','')::time,nullif(p_item->>'endTime','')::time,coalesce((p_item->>'useRest1')::boolean,false),nullif(p_item->>'rest1StartTime','')::time,nullif(p_item->>'rest1EndTime','')::time,coalesce((p_item->>'useRest2')::boolean,false),nullif(p_item->>'rest2StartTime','')::time,nullif(p_item->>'rest2EndTime','')::time,greatest(0,coalesce((p_item->>'sortOrder')::integer,0)))
    on conflict(id) do update set name=excluded.name,color=excluded.color,text_color=excluded.text_color,auto_text_color=excluded.auto_text_color,hidden_from_toolbar=excluded.hidden_from_toolbar,start_time=excluded.start_time,end_time=excluded.end_time,use_rest_1=excluded.use_rest_1,rest_1_start_time=excluded.rest_1_start_time,rest_1_end_time=excluded.rest_1_end_time,use_rest_2=excluded.use_rest_2,rest_2_start_time=excluded.rest_2_start_time,rest_2_end_time=excluded.rest_2_end_time,sort_order=excluded.sort_order,updated_at=now()
    where public.set_overtime.deleted_at is null;
  else raise exception '不支援的設定類型'; end if;
  return jsonb_build_object('ok',true,'id',v_id,'category',v_category);
end
$$;

create or replace function public.delete_catalog_item_v3(p_category text,p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_category text:=lower(btrim(coalesce(p_category,''))); v_group_id uuid; v_deleted timestamptz; begin
  if p_item_id is null then raise exception '缺少設定識別碼'; end if;
  if v_category='shift' then
    select group_id,deleted_at into v_group_id,v_deleted from public.set_shift where id=p_item_id;
    if not found or v_deleted is not null then return jsonb_build_object('ok',true,'deleted',false); end if;
    if not public.can_access_group(auth.uid(),v_group_id,'schedule_manage') then raise exception '沒有管理此群組班別的權限' using errcode='42501'; end if;
    if exists(select 1 from public.schedule_entries e where e.shift_type_id=p_item_id and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '此班別仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
    update public.set_employee set schedule_shift_ids=array_remove(schedule_shift_ids,p_item_id),updated_at=now() where deleted_at is null and p_item_id=any(schedule_shift_ids);
    update public.set_shift set deleted_at=now(),updated_at=now() where id=p_item_id and deleted_at is null;
  elsif v_category in ('leave','overtime') then
    if not public.has_access_permission(auth.uid(),'leave_settings') then raise exception '沒有假別設定權限' using errcode='42501'; end if;
    if v_category='leave' then
      select deleted_at into v_deleted from public.set_leave where id=p_item_id;
      if not found or v_deleted is not null then return jsonb_build_object('ok',true,'deleted',false); end if;
      if exists(select 1 from public.schedule_entries e where e.leave_type_id=p_item_id and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '此假別仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
      update public.set_leave set deleted_at=now(),updated_at=now() where id=p_item_id and deleted_at is null;
    else
      select deleted_at into v_deleted from public.set_overtime where id=p_item_id;
      if not found or v_deleted is not null then return jsonb_build_object('ok',true,'deleted',false); end if;
      if exists(select 1 from public.schedule_entries e where e.overtime_type_id=p_item_id and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '此加班設定仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
      update public.set_overtime set deleted_at=now(),updated_at=now() where id=p_item_id and deleted_at is null;
    end if;
  else raise exception '不支援的設定類型'; end if;
  return jsonb_build_object('ok',true,'deleted',true,'softDeleted',true,'category',v_category,'itemId',p_item_id);
end
$$;

create or replace function public.save_department_v3(p_department jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid; v_group_id uuid; v_old_group_id uuid; v_name text; v_existing public.set_departments%rowtype; v_can_admin boolean;
begin
  begin v_id:=nullif(btrim(p_department->>'id'),'')::uuid; v_group_id:=nullif(btrim(p_department->>'groupId'),'')::uuid; exception when invalid_text_representation then raise exception '單位識別碼格式錯誤'; end;
  v_name:=btrim(coalesce(p_department->>'name',''));
  if v_id is null or v_group_id is null or v_name='' then raise exception '單位名稱與群組不可空白'; end if;
  if not exists(select 1 from public.schedule_groups g where g.id=v_group_id and g.deleted_at is null and g.status='active') then raise exception '找不到可使用的群組'; end if;
  if not public.can_access_group(auth.uid(),v_group_id,'department_settings') then raise exception '沒有管理此群組單位的權限' using errcode='42501'; end if;
  select * into v_existing from public.set_departments where id=v_id for update;
  v_old_group_id:=v_existing.group_id;
  if found and v_existing.deleted_at is not null then raise exception '已刪除單位不可重新啟用'; end if;
  if v_old_group_id is not null and v_old_group_id is distinct from v_group_id then
    if not public.can_access_group(auth.uid(),v_old_group_id,'department_settings') then raise exception '沒有管理原群組單位的權限' using errcode='42501'; end if;
    if exists(select 1 from public.set_employee m where m.home_department_id=v_id and m.deleted_at is null) then raise exception '此單位仍有人員，請先調整人員'; end if;
    if exists(select 1 from public.schedule_entries e left join public.set_employee m on m.id=e.member_id left join public.set_shift s on s.id=e.shift_type_id where (e.support_department_id=v_id or m.home_department_id=v_id or s.applicable_department_id=v_id) and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '此單位仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
  end if;
  v_can_admin:=public.has_access_permission(auth.uid(),'permission_settings');
  insert into public.set_departments(id,name,group_id,start_date,end_date,hidden_from_schedule,sort_order,address,latitude,longitude,public_ip,attendance_enabled)
  values(v_id,v_name,v_group_id,nullif(p_department->>'startDate','')::date,nullif(p_department->>'endDate','')::date,coalesce((p_department->>'hiddenFromSchedule')::boolean,false),greatest(0,coalesce((p_department->>'sortOrder')::integer,0)),case when v_can_admin then nullif(btrim(coalesce(p_department->>'address','')),'') else null end,case when v_can_admin and nullif(p_department->>'latitude','') is not null then (p_department->>'latitude')::double precision else null end,case when v_can_admin and nullif(p_department->>'longitude','') is not null then (p_department->>'longitude')::double precision else null end,case when v_can_admin then nullif(btrim(coalesce(p_department->>'publicIp','')),'') else null end,case when v_can_admin then coalesce((p_department->>'attendanceEnabled')::boolean,false) else false end)
  on conflict(id) do update set name=excluded.name,group_id=excluded.group_id,start_date=excluded.start_date,end_date=excluded.end_date,hidden_from_schedule=excluded.hidden_from_schedule,sort_order=excluded.sort_order,
    address=case when v_can_admin then excluded.address else public.set_departments.address end,
    latitude=case when v_can_admin then excluded.latitude else public.set_departments.latitude end,
    longitude=case when v_can_admin then excluded.longitude else public.set_departments.longitude end,
    public_ip=case when v_can_admin then excluded.public_ip else public.set_departments.public_ip end,
    attendance_enabled=case when v_can_admin then excluded.attendance_enabled else public.set_departments.attendance_enabled end,
    attendance_settings_updated_at=case when v_can_admin then now() else public.set_departments.attendance_settings_updated_at end,
    attendance_settings_updated_by=case when v_can_admin then auth.uid() else public.set_departments.attendance_settings_updated_by end,
    updated_at=now()
  where public.set_departments.deleted_at is null;
  if v_old_group_id is not null and v_old_group_id is distinct from v_group_id then update public.set_shift set group_id=v_group_id,updated_at=now() where applicable_department_id=v_id and deleted_at is null; end if;
  return jsonb_build_object('ok',true,'id',v_id,'groupId',v_group_id);
end
$$;

create or replace function public.delete_department_v3(p_department_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_group_id uuid; begin
  select group_id into v_group_id from public.set_departments where id=p_department_id and deleted_at is null;
  if not found then return jsonb_build_object('ok',true,'deleted',false); end if;
  if not public.can_access_group(auth.uid(),v_group_id,'department_settings') then raise exception '沒有刪除此單位的權限' using errcode='42501'; end if;
  if exists(select 1 from public.set_employee where home_department_id=p_department_id and deleted_at is null) then raise exception '這個單位仍有人員，請先將人員移轉到其他單位'; end if;
  if exists(select 1 from public.set_shift where applicable_department_id=p_department_id and deleted_at is null) then raise exception '這個單位仍有班別使用，請先修改相關班別'; end if;
  if exists(select 1 from public.schedule_entries e left join public.set_employee m on m.id=e.member_id where (e.support_department_id=p_department_id or m.home_department_id=p_department_id) and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '這個單位仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
  update public.set_departments set deleted_at=now(),updated_at=now() where id=p_department_id and deleted_at is null;
  return jsonb_build_object('ok',true,'deleted',true,'softDeleted',true,'id',p_department_id);
end
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
    else raise exception '不支援的排序類型'; end if;
    v_index:=v_index+1;
  end loop;
  return jsonb_build_object('ok',true,'category',v_category,'count',coalesce(array_length(p_ids,1),0));
end
$$;

create or replace function public.save_scheduler_preferences_v3(p_document_id text,p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_id text:=coalesce(nullif(btrim(p_document_id),''),'default'); begin
  if not public.has_access_permission(auth.uid(),'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
  insert into public.scheduler_settings(id,current_year,current_month,dept_filter,table_view,table_dept_scope_filter,table_stats_visible,schedule_start_date,week_start,month_start_day,eight_week_start_date,updated_at)
  values(v_id,coalesce((p_settings->>'currentYear')::integer,extract(year from now())::integer),greatest(0,least(11,coalesce((p_settings->>'currentMonth')::integer,0))),coalesce(nullif(p_settings->>'deptFilter',''),'all'),case when p_settings->>'tableView'='shift' then 'shift' else 'member' end,coalesce(nullif(p_settings->>'tableDeptScopeFilter',''),'all'),coalesce((p_settings->>'tableStatsVisible')::boolean,true),nullif(p_settings->>'scheduleStartDate','')::date,greatest(0,least(6,coalesce((p_settings->>'weekStart')::integer,0))),greatest(1,least(31,coalesce((p_settings->>'monthStartDay')::integer,1))),nullif(p_settings->>'eightWeekStartDate','')::date,now())
  on conflict(id) do update set current_year=excluded.current_year,current_month=excluded.current_month,dept_filter=excluded.dept_filter,table_view=excluded.table_view,table_dept_scope_filter=excluded.table_dept_scope_filter,table_stats_visible=excluded.table_stats_visible,schedule_start_date=excluded.schedule_start_date,week_start=excluded.week_start,month_start_day=excluded.month_start_day,eight_week_start_date=excluded.eight_week_start_date,updated_at=now();
  return jsonb_build_object('ok',true,'id',v_id);
end
$$;

create or replace function public.save_holidays_v3(p_holidays jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  x jsonb;
  v_ids uuid[]:='{}'::uuid[];
  v_requested_id uuid;
  v_actual_id uuid;
  v_count integer:=0;
begin
  if not public.has_access_permission(auth.uid(),'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_holidays,'[]'::jsonb))<>'array' then raise exception '假日資料格式錯誤'; end if;
  if exists(
    select 1 from (
      select value->>'date' as holiday_date,count(*) as item_count
      from jsonb_array_elements(coalesce(p_holidays,'[]'::jsonb))
      where coalesce(value->>'date','')<>''
      group by value->>'date'
      having count(*)>1
    ) duplicated
  ) then raise exception '假日日期不可重複'; end if;

  for x in select value from jsonb_array_elements(coalesce(p_holidays,'[]'::jsonb)) loop
    begin v_requested_id:=nullif(x->>'id','')::uuid; exception when invalid_text_representation then raise exception '假日識別碼格式錯誤'; end;
    if v_requested_id is null or nullif(x->>'date','') is null then continue; end if;
    insert into public.holidays(id,holiday_date,name,sort_order)
    values(v_requested_id,(x->>'date')::date,coalesce(nullif(btrim(x->>'name'),''),'假日'),v_count)
    on conflict(holiday_date) do update set name=excluded.name,sort_order=excluded.sort_order,updated_at=now()
    returning id into v_actual_id;
    v_ids:=array_append(v_ids,v_actual_id);
    v_count:=v_count+1;
  end loop;

  delete from public.holidays where not (id=any(v_ids));
  return jsonb_build_object('ok',true,'count',v_count);
end
$$;

create or replace function public.get_department_attendance_settings_v3()
returns table(
  department_id uuid,
  address text,
  latitude double precision,
  longitude double precision,
  attendance_enabled boolean,
  public_ip text
)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select d.id,d.address,d.latitude,d.longitude,d.attendance_enabled,d.public_ip
  from public.set_departments d
  where d.deleted_at is null
    and public.has_access_permission(auth.uid(),'permission_settings')
    and public.can_access_group(auth.uid(),d.group_id,'department_settings')
  order by d.sort_order,d.name,d.id
$$;

create or replace function public.get_employee_admin_directory_v3()
returns setof public.set_employee
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select e.*
  from public.set_employee e
  where e.deleted_at is null
    and public.can_access_group(auth.uid(),e.group_id,'member_settings')
  order by e.sort_order,e.full_name,e.id
$$;

alter function public.set_shift_group_v1() security definer;
alter function public.set_shift_group_v1() set search_path=public,pg_catalog;

revoke all on function public.get_scheduler_bootstrap_v3(text) from public,anon;
revoke all on function public.get_schedule_entries_v3(date,date) from public,anon;
revoke all on function public.save_schedule_entries_v3(jsonb) from public,anon;
revoke all on function public.save_shift_v3(jsonb) from public,anon;
revoke all on function public.save_catalog_item_v3(text,jsonb) from public,anon;
revoke all on function public.delete_catalog_item_v3(text,uuid) from public,anon;
revoke all on function public.save_department_v3(jsonb) from public,anon;
revoke all on function public.delete_department_v3(uuid) from public,anon;
revoke all on function public.reorder_settings_v3(text,uuid[]) from public,anon;
revoke all on function public.save_scheduler_preferences_v3(text,jsonb) from public,anon;
revoke all on function public.save_holidays_v3(jsonb) from public,anon;
revoke all on function public.get_department_attendance_settings_v3() from public,anon;
revoke all on function public.get_employee_admin_directory_v3() from public,anon;

grant execute on function public.get_scheduler_bootstrap_v3(text) to authenticated,service_role;
grant execute on function public.get_schedule_entries_v3(date,date) to authenticated,service_role;
grant execute on function public.save_schedule_entries_v3(jsonb) to authenticated,service_role;
grant execute on function public.save_shift_v3(jsonb) to authenticated,service_role;
grant execute on function public.save_catalog_item_v3(text,jsonb) to authenticated,service_role;
grant execute on function public.delete_catalog_item_v3(text,uuid) to authenticated,service_role;
grant execute on function public.save_department_v3(jsonb) to authenticated,service_role;
grant execute on function public.delete_department_v3(uuid) to authenticated,service_role;
grant execute on function public.reorder_settings_v3(text,uuid[]) to authenticated,service_role;
grant execute on function public.save_scheduler_preferences_v3(text,jsonb) to authenticated,service_role;
grant execute on function public.save_holidays_v3(jsonb) to authenticated,service_role;
grant execute on function public.get_department_attendance_settings_v3() to authenticated,service_role;
grant execute on function public.get_employee_admin_directory_v3() to authenticated,service_role;

-- Browser clients have no direct table privileges. RLS remains enabled as a
-- second line of defense, but application authorization is enforced by the
-- named RPC/Edge API layer.
revoke all privileges on table public.access_role_groups from anon,authenticated;
revoke all privileges on table public.access_roles from anon,authenticated;
revoke all privileges on table public.attendance_audit_logs from anon,authenticated;
revoke all privileges on table public.attendance_days from anon,authenticated;
revoke all privileges on table public.holidays from anon,authenticated;
revoke all privileges on table public.meal_orders from anon,authenticated;
revoke all privileges on table public.meal_products from anon,authenticated;
revoke all privileges on table public.meal_settings from anon,authenticated;
revoke all privileges on table public.schedule_archive_entries from anon,authenticated;
revoke all privileges on table public.schedule_archives from anon,authenticated;
revoke all privileges on table public.schedule_entries from anon,authenticated;
revoke all privileges on table public.schedule_groups from anon,authenticated;
revoke all privileges on table public.scheduler_settings from anon,authenticated;
revoke all privileges on table public.set_departments from anon,authenticated;
revoke all privileges on table public.set_employee from anon,authenticated;
revoke all privileges on table public.set_leave from anon,authenticated;
revoke all privileges on table public.set_overtime from anon,authenticated;
revoke all privileges on table public.set_shift from anon,authenticated;

-- Existing purpose-specific RPCs used by the canonical browser API.
revoke all on function public.get_group_access_bundle_v1() from public,anon;
revoke all on function public.get_schedule_export_rows_v2(date,date) from public,anon;
revoke all on function public.save_schedule_group_v1(jsonb) from public,anon;
revoke all on function public.delete_schedule_group_v1(uuid,text) from public,anon;
revoke all on function public.reorder_schedule_groups_v1(uuid[]) from public,anon;
revoke all on function public.save_access_role_v1(jsonb) from public,anon;
revoke all on function public.delete_access_role_v1(uuid) from public,anon;
revoke all on function public.validate_member_group_change_v1(text,uuid) from public,anon;
revoke all on function public.get_schedule_archives_v1(uuid) from public,anon;
revoke all on function public.archive_schedule_v1(uuid,date,date) from public,anon;
revoke all on function public.unarchive_schedule_v1(uuid) from public,anon;
revoke all on function public.get_schedule_archive_detail_v1(uuid) from public,anon;

grant execute on function public.get_group_access_bundle_v1() to authenticated,service_role;
grant execute on function public.get_schedule_export_rows_v2(date,date) to authenticated,service_role;
grant execute on function public.save_schedule_group_v1(jsonb) to authenticated,service_role;
grant execute on function public.delete_schedule_group_v1(uuid,text) to authenticated,service_role;
grant execute on function public.reorder_schedule_groups_v1(uuid[]) to authenticated,service_role;
grant execute on function public.save_access_role_v1(jsonb) to authenticated,service_role;
grant execute on function public.delete_access_role_v1(uuid) to authenticated,service_role;
grant execute on function public.validate_member_group_change_v1(text,uuid) to authenticated,service_role;
grant execute on function public.get_schedule_archives_v1(uuid) to authenticated,service_role;
grant execute on function public.archive_schedule_v1(uuid,date,date) to authenticated,service_role;
grant execute on function public.unarchive_schedule_v1(uuid) to authenticated,service_role;
grant execute on function public.get_schedule_archive_detail_v1(uuid) to authenticated,service_role;

revoke all on function public.delete_member_account_v4(uuid) from public,anon,authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;

-- ============================================================================
-- 2026-08-08 全系統權限守門收斂
-- 最終授權只依 access_role_id + permissions + access_role_groups；不保留舊文字角色
-- 相容欄位或相容授權。此區段可重複執行。
-- ============================================================================

begin;

drop function if exists public.protect_admin_member();
drop function if exists public.protect_last_effective_admin_v2();
drop function if exists public.is_effective_admin_row(text,date,date);















drop trigger if exists attendance_days_touch_updated_at on public.attendance_days;
drop function if exists public.touch_attendance_day_updated_at();

revoke all on function public.is_employee_account_effective(date,date,date) from public,anon,authenticated;
revoke all on function public.is_employee_employed_on(date,date,date) from public,anon,authenticated;

commit;


begin;
-- Canonical RPC-only table access: authenticated has no direct write policies.

















commit;

-- ============================================================================
-- Canonical permission model / APIs / RLS
-- ============================================================================
begin;

create or replace function public.get_my_profile_v3()
returns table (
  id uuid,
  employee_code text,
  full_name text,
  home_department_id uuid,
  position_name text,
  hire_date date,
  leave_date date,
  pay_by_day boolean,
  created_at timestamptz,
  updated_at timestamptz,
  schedule_department_ids text[],
  monthly_rest_days integer,
  fixed_rest_weekday integer,
  schedule_shift_ids uuid[],
  sort_order integer,
  group_id uuid,
  access_role_id uuid,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select employee.id,employee.employee_code,employee.full_name,employee.home_department_id,
    employee.position_name,employee.hire_date,employee.leave_date,employee.pay_by_day,
    employee.created_at,employee.updated_at,employee.schedule_department_ids,employee.monthly_rest_days,
    employee.fixed_rest_weekday,employee.schedule_shift_ids,employee.sort_order,employee.group_id,
    employee.access_role_id,employee.deleted_at
  from public.set_employee employee
  where employee.id=(select auth.uid()) and employee.deleted_at is null
$$;

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
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  ), allowed_groups as (
    select role_group.group_id
    from actor
    join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'groupId',archive.group_id,'startDate',archive.start_date,'endDate',archive.end_date
  ) order by archive.start_date,archive.end_date,archive.id),'[]'::jsonb)
  from public.schedule_archives archive
  join allowed_groups allowed on allowed.group_id=archive.group_id
$$;

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
 select role.id,role.code,role.name,role.permissions,role.is_system,
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
   'id',id,'code',code,'name',name,'permissions',permissions,'isSystem',is_system,'groupIds',group_ids
 ) order by name) from role_rows),'[]'::jsonb)
)
$$;

create or replace function public.save_access_role_v1(p_role jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_id uuid; v_code text; v_name text; v_permissions text[]; v_group_ids uuid[];
  v_role public.access_roles%rowtype; v_existing public.access_roles%rowtype;
  v_was_privileged boolean:=false; v_will_be_privileged boolean:=false;
  v_today date:=(timezone('Asia/Taipei',now()))::date;
begin
  if not public.has_access_permission((select auth.uid()),'permission_settings') then raise exception '沒有權限設定權限' using errcode='42501'; end if;
  begin v_id:=nullif(btrim(p_role->>'id'),'')::uuid; exception when invalid_text_representation then raise exception '角色識別碼格式錯誤'; end;
  v_name:=btrim(coalesce(p_role->>'name',''));
  v_code:=lower(regexp_replace(btrim(coalesce(p_role->>'code','')),'[^A-Za-z0-9_-]+','-','g'));
  if v_name='' then raise exception '角色名稱不可空白'; end if;
  if v_id is null then v_id:=gen_random_uuid(); end if;
  if v_code='' then v_code:='role-'||replace(v_id::text,'-',''); end if;
  select coalesce(array_agg(distinct value),'{}') into v_permissions
  from jsonb_array_elements_text(coalesce(p_role->'permissions','[]')) value
  where value=any(array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','leave_settings','permission_settings','attendance_review','meal_admin']);
  if 'schedule_manage'=any(v_permissions) and not 'schedule_view'=any(v_permissions) then v_permissions:=array_append(v_permissions,'schedule_view'); end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_group_ids
  from jsonb_array_elements_text(coalesce(p_role->'groupIds','[]')) value
  join public.schedule_groups grp on grp.id=value::uuid and grp.deleted_at is null;
  if v_permissions && array['schedule_view','schedule_manage','group_settings','department_settings','member_settings','attendance_review','meal_admin']::text[]
     and cardinality(v_group_ids)=0 then raise exception '請至少選擇一個適用群組'; end if;
  select * into v_existing from public.access_roles where id=v_id for update;
  if found then v_was_privileged:='permission_settings'=any(coalesce(v_existing.permissions,'{}'::text[])); end if;
  v_will_be_privileged:='permission_settings'=any(coalesce(v_permissions,'{}'::text[]));
  if v_was_privileged and not v_will_be_privileged
     and exists(
       select 1 from public.set_employee employee
       where employee.access_role_id=v_id and employee.deleted_at is null
         and public.is_employee_account_effective(employee.hire_date,employee.leave_date,v_today)
     )
     and not exists(
       select 1 from public.set_employee employee
       join public.access_roles other_role on other_role.id=employee.access_role_id
       where employee.access_role_id<>v_id and employee.deleted_at is null
         and 'permission_settings'=any(coalesce(other_role.permissions,'{}'::text[]))
         and public.is_employee_account_effective(employee.hire_date,employee.leave_date,v_today)
     ) then raise exception '系統必須保留至少一個有效的權限管理帳號' using errcode='23514'; end if;

  insert into public.access_roles(id,code,name,permissions,is_system)
  values(v_id,v_code,v_name,v_permissions,false)
  on conflict(id) do update set name=excluded.name,permissions=excluded.permissions,updated_at=now()
  returning * into v_role;
  delete from public.access_role_groups where role_id=v_id and group_id in(select id from public.schedule_groups where deleted_at is null);
  insert into public.access_role_groups(role_id,group_id) select v_id,unnest(v_group_ids) on conflict do nothing;
  return jsonb_build_object('ok',true,'role',jsonb_build_object(
    'id',v_role.id,'code',v_role.code,'name',v_role.name,'permissions',v_role.permissions,
    'isSystem',v_role.is_system,'groupIds',v_group_ids));
end $$;

create or replace function public.protect_employee_role_changes()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_new_role public.access_roles%rowtype;
  v_old_role public.access_roles%rowtype;
  v_actor_can_permissions boolean:=false;
  v_today date:=(timezone('Asia/Taipei',now()))::date;
  v_old_privileged boolean:=false;
  v_new_privileged boolean:=false;
begin
  select * into v_new_role from public.access_roles where id=new.access_role_id;
  if not found then raise exception '找不到權限角色'; end if;
  if tg_op='UPDATE' then
    select * into v_old_role from public.access_roles where id=old.access_role_id;
    v_old_privileged:=old.deleted_at is null and v_old_role.id is not null
      and 'permission_settings'=any(coalesce(v_old_role.permissions,'{}'::text[]))
      and public.is_employee_account_effective(old.hire_date,old.leave_date,v_today);
    v_new_privileged:=new.deleted_at is null
      and 'permission_settings'=any(coalesce(v_new_role.permissions,'{}'::text[]))
      and public.is_employee_account_effective(new.hire_date,new.leave_date,v_today);
    if v_old_privileged and not v_new_privileged and not exists(
      select 1 from public.set_employee other_employee
      join public.access_roles other_role on other_role.id=other_employee.access_role_id
      where other_employee.id<>old.id and other_employee.deleted_at is null
        and 'permission_settings'=any(coalesce(other_role.permissions,'{}'::text[]))
        and public.is_employee_account_effective(other_employee.hire_date,other_employee.leave_date,v_today)
    ) then raise exception '系統必須保留至少一個有效的權限管理帳號' using errcode='23514'; end if;
  end if;
  if (select auth.uid()) is not null and (select auth.role())<>'service_role' and coalesce(current_setting('fyh.group_delete',true),'')<>'on' then
    if not public.has_access_permission((select auth.uid()),'member_settings') then raise exception '沒有人員設定權限' using errcode='42501'; end if;
    if tg_op='UPDATE' and old.group_id is not null and not public.role_applies_to_group((select auth.uid()),old.group_id) then raise exception '此角色不可管理人員原群組' using errcode='42501'; end if;
    if new.group_id is null or not public.role_applies_to_group((select auth.uid()),new.group_id) then raise exception '此角色不可管理人員所屬群組' using errcode='42501'; end if;
    if new.home_department_id is null or not exists(select 1 from public.set_departments department where department.id=new.home_department_id and department.group_id=new.group_id and department.deleted_at is null) then raise exception '所屬單位不在所選群組'; end if;
    if exists(select 1 from unnest(coalesce(new.schedule_shift_ids,'{}'::uuid[])) shift_id where not exists(select 1 from public.set_shift shift where shift.id=shift_id and shift.group_id=new.group_id and shift.deleted_at is null)) then raise exception '排班班別不在人員所屬群組'; end if;
    if tg_op='UPDATE' and new.group_id is distinct from old.group_id then perform public.validate_member_group_change_v1(old.employee_code,new.group_id); end if;
    v_actor_can_permissions:=public.has_access_permission((select auth.uid()),'permission_settings');
    if not v_actor_can_permissions then
      if tg_op='UPDATE' and new.access_role_id is distinct from old.access_role_id then raise exception '沒有變更權限角色的權限' using errcode='42501'; end if;
      if tg_op='INSERT' and not (coalesce(v_new_role.permissions,'{}'::text[]) <@ array['schedule_view']::text[]) then
        raise exception '沒有指派管理權限角色的權限' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.protect_department_attendance_fields()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_group_id uuid; v_sensitive_changed boolean:=false;
begin
  if (select auth.uid()) is null or (select auth.role())='service_role' then return new; end if;
  v_group_id:=coalesce(new.group_id,old.group_id);
  if tg_op='INSERT' then
    v_sensitive_changed:=new.address is not null or new.latitude is not null or new.longitude is not null
      or new.public_ip is not null or new.attendance_enabled is true
      or new.attendance_settings_updated_at is not null or new.attendance_settings_updated_by is not null;
  else
    v_sensitive_changed:=new.address is distinct from old.address or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude or new.public_ip is distinct from old.public_ip
      or new.attendance_enabled is distinct from old.attendance_enabled
      or new.attendance_settings_updated_at is distinct from old.attendance_settings_updated_at
      or new.attendance_settings_updated_by is distinct from old.attendance_settings_updated_by;
  end if;
  if v_sensitive_changed and (
    not public.has_access_permission((select auth.uid()),'permission_settings')
    or not public.can_access_group((select auth.uid()),v_group_id,'department_settings')
  ) then raise exception '沒有修改打卡設定的權限' using errcode='42501'; end if;
  return new;
end $$;

drop trigger if exists trg_protect_employee_role_changes on public.set_employee;
create trigger trg_protect_employee_role_changes before insert or update on public.set_employee
for each row execute function public.protect_employee_role_changes();
drop trigger if exists trg_protect_department_attendance_fields on public.set_departments;
create trigger trg_protect_department_attendance_fields before insert or update on public.set_departments
for each row execute function public.protect_department_attendance_fields();



revoke all on function public.get_my_profile_v3() from public,anon;
revoke all on function public.get_schedule_archive_ranges_v1() from public,anon;
revoke all on function public.get_group_access_bundle_v1() from public,anon;
revoke all on function public.save_access_role_v1(jsonb) from public,anon;
revoke all on function public.protect_employee_role_changes() from public,anon,authenticated;
revoke all on function public.protect_department_attendance_fields() from public,anon,authenticated;
grant execute on function public.get_my_profile_v3(),public.get_schedule_archive_ranges_v1(),public.get_group_access_bundle_v1(),public.save_access_role_v1(jsonb) to authenticated,service_role;
grant execute on function public.protect_employee_role_changes(),public.protect_department_attendance_fields() to service_role;
commit;


begin;
-- Canonical RLS: browser writes are named RPC/Edge only.
drop policy if exists write_holidays on public.holidays;
drop policy if exists read_meal_orders on public.meal_orders;
create policy read_meal_orders on public.meal_orders for select to authenticated using(public.is_effective_user((select (select auth.uid()))) and (user_id=(select (select auth.uid())) or public.can_access_group((select (select auth.uid())),group_id,'meal_admin')));
drop policy if exists write_meal_products on public.meal_products;
drop policy if exists write_meal_settings on public.meal_settings;
drop policy if exists delete_schedule_entries on public.schedule_entries;
drop policy if exists insert_schedule_entries on public.schedule_entries;
drop policy if exists read_schedule_entries on public.schedule_entries;
create policy read_schedule_entries on public.schedule_entries for select to authenticated using(public.can_access_group((select (select auth.uid())),group_id,'schedule_view'));
drop policy if exists update_schedule_entries on public.schedule_entries;
drop policy if exists write_schedule_entries on public.schedule_entries;
drop policy if exists write_scheduler_settings on public.scheduler_settings;
drop policy if exists delete_set_departments_group on public.set_departments;
drop policy if exists insert_set_departments_group on public.set_departments;
drop policy if exists read_set_departments on public.set_departments;
create policy read_set_departments on public.set_departments for select to authenticated using(deleted_at is null and public.role_applies_to_group((select (select auth.uid())),group_id));
drop policy if exists update_set_departments_group on public.set_departments;
drop policy if exists write_set_departments on public.set_departments;
drop policy if exists delete_set_employee on public.set_employee;
drop policy if exists insert_set_employee on public.set_employee;
drop policy if exists read_set_employee on public.set_employee;
create policy read_set_employee on public.set_employee for select to authenticated using(deleted_at is null and (id=(select (select auth.uid())) or public.role_applies_to_group((select (select auth.uid())),group_id)));
drop policy if exists update_set_employee on public.set_employee;
drop policy if exists insert_set_leave on public.set_leave;
drop policy if exists read_set_leave on public.set_leave;
create policy read_set_leave on public.set_leave
for select to authenticated
using(
  public.is_effective_user((select (select auth.uid())))
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.leave_type_id=set_leave.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.role_applies_to_group((select (select auth.uid())),entry.group_id)
    )
  )
);
drop policy if exists update_set_leave on public.set_leave;
drop policy if exists write_set_leave on public.set_leave;
drop policy if exists insert_set_overtime on public.set_overtime;
drop policy if exists read_set_overtime on public.set_overtime;
create policy read_set_overtime on public.set_overtime
for select to authenticated
using(
  public.is_effective_user((select (select auth.uid())))
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.overtime_type_id=set_overtime.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.role_applies_to_group((select (select auth.uid())),entry.group_id)
    )
  )
);
drop policy if exists update_set_overtime on public.set_overtime;
drop policy if exists write_set_overtime on public.set_overtime;
drop policy if exists delete_set_shift_group on public.set_shift;
drop policy if exists insert_set_shift_group on public.set_shift;
drop policy if exists read_set_shift on public.set_shift;
create policy read_set_shift on public.set_shift
for select to authenticated
using(
  public.role_applies_to_group((select (select auth.uid())),group_id)
  and (
    deleted_at is null
    or exists(
      select 1 from public.schedule_entries entry
      where entry.shift_type_id=set_shift.id
        and not public.is_schedule_date_archived(entry.group_id,entry.work_date)
        and public.role_applies_to_group((select (select auth.uid())),entry.group_id)
    )
  )
);
drop policy if exists update_set_shift_group on public.set_shift;
drop policy if exists write_set_shift on public.set_shift;
commit;


create or replace function public.get_scheduler_bootstrap_v3(p_document_id text default 'default')
returns jsonb
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
    and 'schedule_view'=any(coalesce(role.permissions,'{}'::text[]))
    and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  limit 1
),
allowed_groups as materialized (
  select role_group.group_id
  from actor
  join public.access_role_groups role_group on role_group.role_id=actor.access_role_id
),
visible_schedule as materialized (
  select entry.*
  from public.schedule_entries entry
  join allowed_groups allowed on allowed.group_id=entry.group_id
  where not exists(
    select 1 from public.schedule_archives archive
    where archive.group_id=entry.group_id
      and entry.work_date between archive.start_date and archive.end_date
  )
),
visible_departments as (
  select department.*
  from public.set_departments department
  join allowed_groups allowed on allowed.group_id=department.group_id
  where department.deleted_at is null
     or exists(
       select 1
       from visible_schedule entry
       left join public.set_employee member on member.id=entry.member_id
       where entry.support_department_id=department.id
          or (entry.support_department_id is null and member.home_department_id=department.id)
     )
),
visible_members as (
  select member.*
  from public.set_employee member
  join allowed_groups allowed on allowed.group_id=member.group_id
  where member.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.member_id=member.id)
),
visible_shifts as (
  select shift.*
  from public.set_shift shift
  join allowed_groups allowed on allowed.group_id=shift.group_id
  where shift.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.shift_type_id=shift.id)
),
visible_leaves as (
  select leave_item.*
  from public.set_leave leave_item
  where leave_item.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.leave_type_id=leave_item.id)
),
visible_overtime as (
  select overtime_item.*
  from public.set_overtime overtime_item
  where overtime_item.deleted_at is null
     or exists(select 1 from visible_schedule entry where entry.overtime_type_id=overtime_item.id)
)
select case when exists(select 1 from actor) then jsonb_build_object(
  'settings',coalesce((select to_jsonb(setting) from public.scheduler_settings setting where setting.id=coalesce(nullif(p_document_id,''),'default') limit 1),'{}'::jsonb),
  'departments',coalesce((select jsonb_agg(jsonb_build_object(
    'id',department.id,'name',department.name,'group_id',department.group_id,'start_date',department.start_date,'end_date',department.end_date,
    'hidden_from_schedule',department.hidden_from_schedule,'sort_order',department.sort_order,'deleted_at',department.deleted_at
  ) order by department.sort_order,department.name,department.id) from visible_departments department),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object(
    'id',member.id,'employee_code',member.employee_code,'full_name',member.full_name,'group_id',member.group_id,'access_role_id',member.access_role_id,
    'home_department_id',member.home_department_id,'hire_date',member.hire_date,'leave_date',member.leave_date,'pay_by_day',member.pay_by_day,
    'fixed_rest_weekday',member.fixed_rest_weekday,'schedule_shift_ids',member.schedule_shift_ids,'monthly_rest_days',member.monthly_rest_days,
    'sort_order',member.sort_order,'deleted_at',member.deleted_at
  ) order by member.sort_order,member.full_name,member.id) from visible_members member),'[]'::jsonb),
  'shifts',coalesce((select jsonb_agg(to_jsonb(shift) order by shift.sort_order,shift.name,shift.id) from visible_shifts shift),'[]'::jsonb),
  'leaves',coalesce((select jsonb_agg(to_jsonb(leave_item) order by leave_item.sort_order,leave_item.code,leave_item.id) from visible_leaves leave_item),'[]'::jsonb),
  'overtime',coalesce((select jsonb_agg(to_jsonb(overtime_item) order by overtime_item.sort_order,overtime_item.name,overtime_item.id) from visible_overtime overtime_item),'[]'::jsonb),
  'holidays',coalesce((select jsonb_agg(to_jsonb(holiday) order by holiday.sort_order,holiday.holiday_date,holiday.id) from public.holidays holiday),'[]'::jsonb),
  'accessBundle',public.get_group_access_bundle_v1(),
) else null end
$$;
-- 內部群組異動驗證只由 Trigger / 後端呼叫，不作為瀏覽器公開 RPC。
revoke all on function public.validate_member_group_change_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.validate_member_group_change_v1(text,uuid) to service_role;
