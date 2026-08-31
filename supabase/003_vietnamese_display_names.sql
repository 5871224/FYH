-- 福圓號繁中／越文顯示名稱擴充
-- 2026-08-31
-- 中文主欄位維持既有資料；越文欄位允許空白，前端空白時回退顯示中文。

alter table public.schedule_groups add column if not exists name_vi text;
alter table public.set_departments add column if not exists name_vi text;
alter table public.set_employee add column if not exists full_name_vi text;
alter table public.set_shift add column if not exists name_vi text;
alter table public.set_leave add column if not exists name_vi text;
alter table public.meal_products add column if not exists name_vi text;

comment on column public.schedule_groups.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_departments.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_employee.full_name_vi is 'Vietnamese display name; blank falls back to full_name.';
comment on column public.set_shift.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.set_leave.name_vi is 'Vietnamese display name; blank falls back to name.';
comment on column public.meal_products.name_vi is 'Vietnamese display name; blank falls back to name.';

create or replace function public.get_vietnamese_labels_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.is_effective_user(v_user_id) then
    raise exception '請先登入' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nameVi', coalesce(g.name_vi, '')) order by g.sort_order, g.name)
      from public.schedule_groups g
      where g.deleted_at is null
        and public.role_applies_to_group(v_user_id, g.id)
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'nameVi', coalesce(d.name_vi, '')) order by d.sort_order, d.name)
      from public.set_departments d
      where d.deleted_at is null
        and d.group_id is not null
        and public.role_applies_to_group(v_user_id, d.group_id)
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nameVi', coalesce(e.full_name_vi, '')) order by e.sort_order, e.full_name)
      from public.set_employee e
      where e.deleted_at is null
        and e.group_id is not null
        and public.role_applies_to_group(v_user_id, e.group_id)
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nameVi', coalesce(s.name_vi, '')) order by s.sort_order, s.name)
      from public.set_shift s
      where s.deleted_at is null
        and s.group_id is not null
        and public.role_applies_to_group(v_user_id, s.group_id)
    ), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'nameVi', coalesce(l.name_vi, '')) order by l.sort_order, l.name)
      from public.set_leave l
      where l.deleted_at is null
    ), '[]'::jsonb),
    'mealProducts', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nameVi', coalesce(p.name_vi, '')) order by p.sort_order, p.name)
      from public.meal_products p
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.save_vietnamese_label_v1(
  p_entity text,
  p_id uuid,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_value text := nullif(btrim(coalesce(p_value, '')), '');
  v_group_id uuid;
begin
  if v_user_id is null or not public.is_effective_user(v_user_id) then
    raise exception '請先登入' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception '缺少資料識別碼';
  end if;

  case p_entity
    when 'group' then
      if not public.has_access_permission(v_user_id, 'group_settings')
         or not public.role_applies_to_group(v_user_id, p_id) then
        raise exception '沒有群組設定權限' using errcode = '42501';
      end if;
      update public.schedule_groups set name_vi = v_value, updated_at = now()
      where id = p_id and deleted_at is null;

    when 'department' then
      select group_id into v_group_id from public.set_departments where id = p_id and deleted_at is null;
      if v_group_id is null
         or not public.has_access_permission(v_user_id, 'department_settings')
         or not public.role_applies_to_group(v_user_id, v_group_id) then
        raise exception '沒有單位設定權限' using errcode = '42501';
      end if;
      update public.set_departments set name_vi = v_value, updated_at = now()
      where id = p_id and deleted_at is null;

    when 'member' then
      select group_id into v_group_id from public.set_employee where id = p_id and deleted_at is null;
      if v_group_id is null
         or not public.has_access_permission(v_user_id, 'member_settings')
         or not public.role_applies_to_group(v_user_id, v_group_id) then
        raise exception '沒有人員設定權限' using errcode = '42501';
      end if;
      update public.set_employee set full_name_vi = v_value, updated_at = now()
      where id = p_id and deleted_at is null;

    when 'shift' then
      select group_id into v_group_id from public.set_shift where id = p_id and deleted_at is null;
      if v_group_id is null
         or not public.has_access_permission(v_user_id, 'schedule_manage')
         or not public.role_applies_to_group(v_user_id, v_group_id) then
        raise exception '沒有班表管理權限' using errcode = '42501';
      end if;
      update public.set_shift set name_vi = v_value, updated_at = now()
      where id = p_id and deleted_at is null;

    when 'leave' then
      if not public.has_access_permission(v_user_id, 'leave_settings') then
        raise exception '沒有假別設定權限' using errcode = '42501';
      end if;
      update public.set_leave set name_vi = v_value, updated_at = now()
      where id = p_id and deleted_at is null;

    when 'meal_product' then
      if not public.has_access_permission(v_user_id, 'meal_admin') then
        raise exception '沒有訂餐管理權限' using errcode = '42501';
      end if;
      update public.meal_products set name_vi = v_value, updated_at = now()
      where id = p_id;

    else
      raise exception '不支援的越文名稱類型';
  end case;

  if not found then
    raise exception '找不到要更新的資料';
  end if;
end
$$;

revoke all on function public.get_vietnamese_labels_v1() from public, anon;
revoke all on function public.save_vietnamese_label_v1(text, uuid, text) from public, anon;
grant execute on function public.get_vietnamese_labels_v1() to authenticated;
grant execute on function public.save_vietnamese_label_v1(text, uuid, text) to authenticated;
