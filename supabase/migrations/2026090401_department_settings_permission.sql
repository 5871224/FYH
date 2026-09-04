-- 單位設定權限一致化：只要有該群組 department_settings，即可讀寫單位所有欄位。
begin;

create or replace function public.save_department_v3(p_department jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid; v_group_id uuid; v_old_group_id uuid; v_name text; v_existing public.set_departments%rowtype;
begin
  begin v_id:=nullif(btrim(p_department->>'id'),'')::uuid; v_group_id:=nullif(btrim(p_department->>'groupId'),'')::uuid; exception when invalid_text_representation then raise exception '單位識別碼格式錯誤'; end;
  v_name:=btrim(coalesce(p_department->>'name',''));
  if v_id is null or v_group_id is null or v_name='' then raise exception '單位名稱與群組不可空白'; end if;
  if not exists(select 1 from public.schedule_groups g where g.id=v_group_id and g.deleted_at is null and g.status='active') then raise exception '找不到可使用的群組'; end if;
  if not public.has_group_permission(auth.uid(),v_group_id,'department_settings') then raise exception '沒有管理此群組單位的權限' using errcode='42501'; end if;
  select * into v_existing from public.set_departments where id=v_id for update;
  v_old_group_id:=v_existing.group_id;
  if found and v_existing.deleted_at is not null then raise exception '已刪除單位不可重新啟用'; end if;
  if v_old_group_id is not null and v_old_group_id is distinct from v_group_id then
    if not public.has_group_permission(auth.uid(),v_old_group_id,'department_settings') then raise exception '沒有管理原群組單位的權限' using errcode='42501'; end if;
    if exists(select 1 from public.set_employee m where m.home_department_id=v_id and m.deleted_at is null) then raise exception '此單位仍有人員，請先調整人員'; end if;
    if exists(select 1 from public.schedule_entries e left join public.set_employee m on m.id=e.member_id left join public.set_shift s on s.id=e.shift_type_id where (e.support_department_id=v_id or m.home_department_id=v_id or s.applicable_department_id=v_id) and not public.is_schedule_date_archived(e.group_id,e.work_date)) then raise exception '此單位仍有未封存班表，請先完成班表封存或清除相關排班'; end if;
  end if;
  insert into public.set_departments(id,name,group_id,start_date,end_date,hidden_from_schedule,sort_order,address,latitude,longitude,public_ip,attendance_enabled)
  values(v_id,v_name,v_group_id,nullif(p_department->>'startDate','')::date,nullif(p_department->>'endDate','')::date,coalesce((p_department->>'hiddenFromSchedule')::boolean,false),greatest(0,coalesce((p_department->>'sortOrder')::integer,0)),nullif(btrim(coalesce(p_department->>'address','')),''),case when nullif(p_department->>'latitude','') is not null then (p_department->>'latitude')::double precision else null end,case when nullif(p_department->>'longitude','') is not null then (p_department->>'longitude')::double precision else null end,nullif(btrim(coalesce(p_department->>'publicIp','')),''),coalesce((p_department->>'attendanceEnabled')::boolean,false))
  on conflict(id) do update set name=excluded.name,group_id=excluded.group_id,start_date=excluded.start_date,end_date=excluded.end_date,hidden_from_schedule=excluded.hidden_from_schedule,sort_order=excluded.sort_order,
    address=excluded.address,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    public_ip=excluded.public_ip,
    attendance_enabled=excluded.attendance_enabled,
    attendance_settings_updated_at=now(),
    attendance_settings_updated_by=auth.uid(),
    updated_at=now()
  where public.set_departments.deleted_at is null;
  if v_old_group_id is not null and v_old_group_id is distinct from v_group_id then update public.set_shift set group_id=v_group_id,updated_at=now() where applicable_department_id=v_id and deleted_at is null; end if;
  return jsonb_build_object('ok',true,'id',v_id,'groupId',v_group_id);
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
    and public.has_group_permission(auth.uid(),d.group_id,'department_settings')
  order by d.sort_order,d.name,d.id
$$;

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
  if v_sensitive_changed and not public.has_group_permission((select auth.uid()),v_group_id,'department_settings') then
    raise exception '沒有修改單位設定的權限' using errcode='42501';
  end if;
  return new;
end $$;

revoke all on function public.get_department_attendance_settings_v3() from public,anon;
grant execute on function public.get_department_attendance_settings_v3() to authenticated,service_role;
revoke all on function public.save_department_v3(jsonb) from public,anon;
grant execute on function public.save_department_v3(jsonb) to authenticated,service_role;
revoke all on function public.protect_department_attendance_fields() from public,anon,authenticated;
grant execute on function public.protect_department_attendance_fields() to service_role;

commit;
