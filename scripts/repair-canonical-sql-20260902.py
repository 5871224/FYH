from pathlib import Path

path = Path("supabase/002_current_updates.sql")
sql = path.read_text(encoding="utf-8")

# Replace the last schedule-export definition before the Vietnamese section with a valid canonical definition.
marker = "-- ============================================================================\n-- Canonical Vietnamese display names"
marker_index = sql.index(marker)
start = sql.rfind("create or replace function public.get_schedule_export_rows_v2", 0, marker_index)
if start < 0:
    raise SystemExit("schedule export definition not found")
end_marker = "revoke all on function public.reorder_settings_v3(text,uuid[])"
end = sql.index(end_marker, start)
clean_export = r'''create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text)
language plpgsql stable security definer set search_path=public,pg_catalog as $$
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
  select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,department.name,employee.pay_by_day,
    schedule.work_date,schedule.leave_type_id,leave_type.code,leave_type.name,schedule.leave_all_day,schedule.leave_start_time,
    schedule.leave_end_time,schedule.leave_reason,schedule.overtime_type_id,overtime_type.name,schedule.overtime_start_time,
    schedule.overtime_end_time,schedule.overtime_use_rest_1,schedule.overtime_rest_1_start_time,schedule.overtime_rest_1_end_time,
    schedule.overtime_use_rest_2,schedule.overtime_rest_2_start_time,schedule.overtime_rest_2_end_time,schedule.overtime_reason
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

'''
sql = sql[:start] + clean_export + sql[end:]

marker_index = sql.index(marker)
clean_vietnamese = r'''-- ============================================================================
-- Canonical Vietnamese display names
-- ============================================================================
-- 福圓號繁中／越文顯示名稱擴充
-- 2026-08-31
-- 中文主欄位維持既有資料；越文欄位允許空白，前端空白時回退顯示中文。

alter table public.schedule_groups add column if not exists name_vi text;
alter table public.set_departments add column if not exists name_vi text;
alter table public.set_employee add column if not exists full_name_vi text;
alter table public.set_shift add column if not exists name_vi text;
alter table public.set_leave add column if not exists name_vi text;
alter table public.meal_products add column if not exists name_vi text;
alter table public.access_roles add column if not exists name_vi text;

comment on column public.schedule_groups.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_departments.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_employee.full_name_vi is 'Vietnamese display name; blank falls back to full_name.';
comment on column public.set_shift.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_leave.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.meal_products.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.access_roles.name_vi is 'Vietnamese display name; blank falls back to name.';

create or replace function public.save_meal_admin_settings(
  p_products jsonb,
  p_daily_cutoff_time text,
  p_company_subsidy integer,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  item jsonb;
  v_id uuid;
  v_name text;
  v_name_vi text;
  v_price numeric(10,2);
  v_active boolean;
  v_sort integer:=0;
begin
  if not public.has_any_group_permission(p_operator_user_id,'meal_admin') then
    raise exception '沒有訂餐管理權限' using errcode='42501';
  end if;
  if p_company_subsidy is null or p_company_subsidy<=0 then
    raise exception '公司補助只能輸入正整數';
  end if;
  if coalesce(p_daily_cutoff_time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception '訂餐截止時間格式錯誤';
  end if;

  insert into public.meal_settings(id,daily_cutoff_time,company_subsidy,updated_by,updated_at)
  values('default',p_daily_cutoff_time::time,p_company_subsidy,p_operator_user_id,now())
  on conflict(id) do update
  set daily_cutoff_time=excluded.daily_cutoff_time,
      company_subsidy=excluded.company_subsidy,
      updated_by=excluded.updated_by,
      updated_at=now();

  if jsonb_typeof(coalesce(p_products,'[]'::jsonb))<>'array' then
    raise exception '訂餐品項格式錯誤';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_products,'[]'::jsonb)) loop
    begin
      v_id:=nullif(btrim(item->>'id'),'')::uuid;
    exception when invalid_text_representation then
      raise exception '品項識別碼格式錯誤';
    end;
    if v_id is null then v_id:=gen_random_uuid(); end if;
    v_name:=btrim(coalesce(item->>'name',''));
    if v_name='' then raise exception '品項名稱不可空白'; end if;
    v_name_vi:=nullif(btrim(coalesce(item->>'nameVi',item->>'name_vi','')),'');
    v_price:=coalesce((item->>'price')::numeric,0);
    if v_price<0 then raise exception '品項價格不可小於 0'; end if;
    v_active:=coalesce((item->>'is_active')::boolean,(item->>'isActive')::boolean,true);
    v_sort:=coalesce((item->>'sort_order')::integer,(item->>'sortOrder')::integer,v_sort);

    insert into public.meal_products(id,name,name_vi,price,is_active,sort_order,updated_at)
    values(v_id,v_name,v_name_vi,v_price,v_active,v_sort,now())
    on conflict(id) do update
    set name=excluded.name,
        name_vi=excluded.name_vi,
        price=excluded.price,
        is_active=excluded.is_active,
        sort_order=excluded.sort_order,
        updated_at=now();
    v_sort:=v_sort+1;
  end loop;

  return jsonb_build_object('ok',true,'count',jsonb_array_length(coalesce(p_products,'[]'::jsonb)));
end
$$;

create or replace function public.get_vietnamese_labels_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
begin
  if v_user_id is null or not public.is_effective_user(v_user_id) then
    raise exception '請先登入' using errcode='42501';
  end if;

  return jsonb_build_object(
    'groups',coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'nameVi',coalesce(g.name_vi,'')) order by g.sort_order,g.name)
      from public.schedule_groups g
      where g.deleted_at is null and public.has_group_access(v_user_id,g.id)
    ),'[]'::jsonb),
    'departments',coalesce((
      select jsonb_agg(jsonb_build_object('id',d.id,'nameVi',coalesce(d.name_vi,'')) order by d.sort_order,d.name)
      from public.set_departments d
      where d.deleted_at is null and d.group_id is not null and public.has_group_access(v_user_id,d.group_id)
    ),'[]'::jsonb),
    'members',coalesce((
      select jsonb_agg(jsonb_build_object('id',e.id,'nameVi',coalesce(e.full_name_vi,'')) order by e.sort_order,e.full_name)
      from public.set_employee e
      where e.deleted_at is null and e.group_id is not null and public.has_group_access(v_user_id,e.group_id)
    ),'[]'::jsonb),
    'shifts',coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'nameVi',coalesce(s.name_vi,'')) order by s.sort_order,s.name)
      from public.set_shift s
      where s.deleted_at is null and s.group_id is not null and public.has_group_access(v_user_id,s.group_id)
    ),'[]'::jsonb),
    'leaves',coalesce((
      select jsonb_agg(jsonb_build_object('id',l.id,'nameVi',coalesce(l.name_vi,'')) order by l.sort_order,l.name)
      from public.set_leave l where l.deleted_at is null
    ),'[]'::jsonb),
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'nameVi',coalesce(r.name_vi,'')) order by r.sort_order,r.name)
      from public.access_roles r
    ),'[]'::jsonb),
    'mealProducts',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'nameVi',coalesce(p.name_vi,'')) order by p.sort_order,p.name)
      from public.meal_products p
    ),'[]'::jsonb)
  );
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
      if not public.has_common_permission(v_user_id,'settings') then raise exception '沒有群組設定權限' using errcode='42501'; end if;
      update public.schedule_groups set name_vi=v_value,updated_at=now() where id=p_id and deleted_at is null;
    when 'department' then
      select group_id into v_group_id from public.set_departments where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'department_settings') then raise exception '沒有單位設定權限' using errcode='42501'; end if;
      update public.set_departments set name_vi=v_value,updated_at=now() where id=p_id and deleted_at is null;
    when 'member' then
      select group_id into v_group_id from public.set_employee where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'schedule_manage') then raise exception '沒有人員設定權限' using errcode='42501'; end if;
      update public.set_employee set full_name_vi=v_value,updated_at=now() where id=p_id and deleted_at is null;
    when 'shift' then
      select group_id into v_group_id from public.set_shift where id=p_id and deleted_at is null;
      if v_group_id is null or not public.has_group_permission(v_user_id,v_group_id,'schedule_manage') then raise exception '沒有班表管理權限' using errcode='42501'; end if;
      update public.set_shift set name_vi=v_value,updated_at=now() where id=p_id and deleted_at is null;
    when 'leave' then
      if not public.has_common_permission(v_user_id,'leave_settings') then raise exception '沒有假別設定權限' using errcode='42501'; end if;
      update public.set_leave set name_vi=v_value,updated_at=now() where id=p_id and deleted_at is null;
    when 'role' then
      if not public.has_common_permission(v_user_id,'settings') then raise exception '沒有權限設定權限' using errcode='42501'; end if;
      update public.access_roles set name_vi=v_value,updated_at=now() where id=p_id;
    when 'meal_product' then
      if not public.has_any_group_permission(v_user_id,'meal_admin') then raise exception '沒有訂餐管理權限' using errcode='42501'; end if;
      update public.meal_products set name_vi=v_value,updated_at=now() where id=p_id;
    else
      raise exception '不支援的越文名稱類型';
  end case;

  if not found then raise exception '找不到要更新的資料'; end if;
end
$$;

revoke all on function public.save_meal_admin_settings(jsonb,text,integer,uuid) from public,anon;
revoke all on function public.get_vietnamese_labels_v1() from public,anon;
revoke all on function public.save_vietnamese_label_v1(text,uuid,text) from public,anon;
grant execute on function public.save_meal_admin_settings(jsonb,text,integer,uuid) to authenticated,service_role;
grant execute on function public.get_vietnamese_labels_v1() to authenticated,service_role;
grant execute on function public.save_vietnamese_label_v1(text,uuid,text) to authenticated,service_role;
'''
sql = sql[:marker_index] + clean_vietnamese.rstrip() + "\n"

path.write_text(sql, encoding="utf-8", newline="\n")
