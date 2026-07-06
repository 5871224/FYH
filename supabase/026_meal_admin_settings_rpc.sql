begin;

create or replace function public.save_meal_admin_settings(
  p_products jsonb,
  p_daily_cutoff_time time,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := (timezone('Asia/Taipei', v_now))::date;
  v_now_time time := (timezone('Asia/Taipei', v_now))::time;
  v_operator public.set_employee%rowtype;
  v_products jsonb := coalesce(p_products, '[]'::jsonb);
begin
  select * into v_operator from public.set_employee where id = p_operator_user_id;
  if not found or v_operator.role not in ('admin', 'manager') then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_daily_cutoff_time is null then
    raise exception '缺少訂餐截止時間' using errcode = '23502';
  end if;
  if jsonb_typeof(v_products) <> 'array' then
    raise exception '商品資料格式錯誤' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_products) with ordinality raw(item, index)
    where nullif(trim(raw.item->>'name'), '') is null
      or coalesce(nullif(raw.item->>'price', '')::numeric, 0) < 0
  ) then
    raise exception '商品名稱必填，價格不可為負數' using errcode = '22023';
  end if;

  insert into public.meal_settings (id, daily_cutoff_time, updated_by, updated_at)
  values ('default', p_daily_cutoff_time, p_operator_user_id, v_now)
  on conflict (id) do update
  set daily_cutoff_time = excluded.daily_cutoff_time,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.meal_products (id, name, price, is_active, sort_order, created_at, updated_at)
  select
    coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid()),
    trim(item->>'name'),
    coalesce(nullif(item->>'price', '')::numeric, 0),
    coalesce(nullif(item->>'isActive', '')::boolean, true),
    (index - 1)::integer,
    v_now,
    v_now
  from jsonb_array_elements(v_products) with ordinality raw(item, index)
  on conflict (id) do update
  set name = excluded.name,
      price = excluded.price,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;

  update public.meal_orders mo
  set
    unit_price = mp.price,
    updated_at = v_now
  from public.meal_products mp
  where mo.product_id = mp.id
    and mo.order_date = v_today
    and v_now_time <= p_daily_cutoff_time
    and mo.unit_price is distinct from mp.price;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_meal_admin_settings(jsonb, time, uuid) from public, anon, authenticated;
grant execute on function public.save_meal_admin_settings(jsonb, time, uuid) to service_role;

commit;
