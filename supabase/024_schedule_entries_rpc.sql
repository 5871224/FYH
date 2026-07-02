create or replace function public.save_schedule_entries_bulk(entries jsonb)
returns setof public.schedule_entries
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_manager(auth.uid()) then
    raise exception 'manager permission required' using errcode = '42501';
  end if;

  if entries is null or jsonb_typeof(entries) <> 'array' then
    raise exception 'entries must be a json array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(entries) as item(member_id uuid, work_date date)
    where item.member_id is null or item.work_date is null
  ) then
    raise exception 'member_id and work_date are required' using errcode = '23502';
  end if;

  return query
  with incoming as (
    select *
    from jsonb_to_recordset(entries) as item(
      member_id uuid,
      work_date date,
      delete_entry boolean,
      shift_type_id uuid,
      leave_type_id uuid,
      leave_all_day boolean,
      leave_start_time time,
      leave_end_time time,
      leave_reason text,
      overtime_type_id uuid,
      overtime_start_time time,
      overtime_end_time time,
      overtime_use_rest_1 boolean,
      overtime_rest_1_start_time time,
      overtime_rest_1_end_time time,
      overtime_use_rest_2 boolean,
      overtime_rest_2_start_time time,
      overtime_rest_2_end_time time,
      overtime_reason text
    )
  ),
  deleted as (
    delete from public.schedule_entries se
    using incoming item
    where se.member_id = item.member_id
      and se.work_date = item.work_date
      and (
        item.delete_entry is true
        or (
          item.shift_type_id is null
          and item.leave_type_id is null
          and item.overtime_type_id is null
        )
      )
    returning se.*
  ),
  upserted as (
    insert into public.schedule_entries (
      member_id,
      work_date,
      shift_type_id,
      leave_type_id,
      leave_all_day,
      leave_start_time,
      leave_end_time,
      leave_reason,
      overtime_type_id,
      overtime_start_time,
      overtime_end_time,
      overtime_use_rest_1,
      overtime_rest_1_start_time,
      overtime_rest_1_end_time,
      overtime_use_rest_2,
      overtime_rest_2_start_time,
      overtime_rest_2_end_time,
      overtime_reason
    )
    select
      item.member_id,
      item.work_date,
      item.shift_type_id,
      item.leave_type_id,
      coalesce(item.leave_all_day, true),
      case when item.leave_type_id is null then null else item.leave_start_time end,
      case when item.leave_type_id is null then null else item.leave_end_time end,
      case when item.leave_type_id is null then null else item.leave_reason end,
      item.overtime_type_id,
      case when item.overtime_type_id is null then null else item.overtime_start_time end,
      case when item.overtime_type_id is null then null else item.overtime_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_1, false) end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_1, false) is false then null else item.overtime_rest_1_start_time end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_1, false) is false then null else item.overtime_rest_1_end_time end,
      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_2, false) end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_2, false) is false then null else item.overtime_rest_2_start_time end,
      case when item.overtime_type_id is null or coalesce(item.overtime_use_rest_2, false) is false then null else item.overtime_rest_2_end_time end,
      case when item.overtime_type_id is null then null else item.overtime_reason end
    from incoming item
    where coalesce(item.delete_entry, false) is false
      and (
        item.shift_type_id is not null
        or item.leave_type_id is not null
        or item.overtime_type_id is not null
      )
    on conflict (member_id, work_date)
    do update set
      shift_type_id = excluded.shift_type_id,
      leave_type_id = excluded.leave_type_id,
      leave_all_day = excluded.leave_all_day,
      leave_start_time = excluded.leave_start_time,
      leave_end_time = excluded.leave_end_time,
      leave_reason = excluded.leave_reason,
      overtime_type_id = excluded.overtime_type_id,
      overtime_start_time = excluded.overtime_start_time,
      overtime_end_time = excluded.overtime_end_time,
      overtime_use_rest_1 = excluded.overtime_use_rest_1,
      overtime_rest_1_start_time = excluded.overtime_rest_1_start_time,
      overtime_rest_1_end_time = excluded.overtime_rest_1_end_time,
      overtime_use_rest_2 = excluded.overtime_use_rest_2,
      overtime_rest_2_start_time = excluded.overtime_rest_2_start_time,
      overtime_rest_2_end_time = excluded.overtime_rest_2_end_time,
      overtime_reason = excluded.overtime_reason
    returning *
  )
  select *
  from upserted;
end;
$$;

grant execute on function public.save_schedule_entries_bulk(jsonb) to authenticated;
