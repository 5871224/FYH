begin;

create or replace function public.save_meal_order_v2(
  p_user_id uuid,
  p_items jsonb,
  p_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_date date := (timezone('Asia/Taipei', now()))::date;
  v_department_id uuid;
  v_department_name text;
  v_clock_location_id uuid;
  v_result jsonb;
begin
  select department_id, department_name_snapshot, clock_location_id
  into v_department_id, v_department_name, v_clock_location_id
  from public.meal_orders
  where user_id = p_user_id
    and order_date = v_date
  order by submitted_at asc
  limit 1;

  v_result := public.save_meal_order(p_user_id, p_items, p_note);

  if v_department_id is not null then
    update public.meal_orders
    set department_id = v_department_id,
        department_name_snapshot = coalesce(v_department_name, ''),
        clock_location_id = coalesce(v_clock_location_id, v_department_id)
    where user_id = p_user_id
      and order_date = v_date;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_meal_order_v2(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_meal_order_v2(uuid, jsonb, text) to service_role;

commit;
