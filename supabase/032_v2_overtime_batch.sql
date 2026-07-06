begin;

alter table public.attendance_overtime_requests
  add column if not exists review_note text;

create or replace function public.admin_review_overtime_requests_v2(
  p_ids uuid[],
  p_status text,
  p_early_hours numeric default null,
  p_late_hours numeric default null,
  p_operator_user_id uuid default null,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_operator_role text;
  v_requested_count integer;
  v_found_count integer;
  v_result jsonb;
begin
  select role into v_operator_role
  from public.set_employee
  where id = p_operator_user_id
    and is_active = true
    and (hire_date is null or hire_date <= (timezone('Asia/Taipei', v_now))::date)
    and (leave_date is null or (timezone('Asia/Taipei', v_now))::date <= leave_date + 5);

  if v_operator_role <> 'admin' then
    raise exception '此功能限管理員使用' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception '缺少加班申請' using errcode = '23502';
  end if;
  if p_status not in ('approved', 'returned', 'pending') then
    raise exception '不支援的審核狀態' using errcode = '22023';
  end if;
  if p_early_hours is not null and (p_early_hours < 0 or mod(p_early_hours * 2, 1) <> 0) then
    raise exception '提早上班時數必須為 0.5 的倍數且不可為負數' using errcode = '23514';
  end if;
  if p_late_hours is not null and (p_late_hours < 0 or mod(p_late_hours * 2, 1) <> 0) then
    raise exception '延後下班時數必須為 0.5 的倍數且不可為負數' using errcode = '23514';
  end if;

  v_requested_count := cardinality(array(select distinct unnest(p_ids)));

  create temporary table if not exists pg_temp.overtime_batch_old
  (like public.attendance_overtime_requests including defaults)
  on commit drop;
  truncate pg_temp.overtime_batch_old;

  insert into pg_temp.overtime_batch_old
  select request.*
  from public.attendance_overtime_requests request
  where request.id = any(p_ids)
    and request.is_deleted_by_employee = false
  for update;

  get diagnostics v_found_count = row_count;
  if v_found_count <> v_requested_count then
    raise exception '部分加班申請不存在或已被刪除，整批未處理' using errcode = '23503';
  end if;

  if exists (
    select 1
    from pg_temp.overtime_batch_old old_row
    where coalesce(p_early_hours, old_row.early_overtime_hours, 0)
        + coalesce(p_late_hours, old_row.late_overtime_hours, 0) <= 0
  ) then
    raise exception '加班時數必須大於 0' using errcode = '23514';
  end if;

  with updated as (
    update public.attendance_overtime_requests request
    set status = p_status,
        early_overtime_hours = coalesce(p_early_hours, old_row.early_overtime_hours, 0),
        late_overtime_hours = coalesce(p_late_hours, old_row.late_overtime_hours, 0),
        total_overtime_hours = coalesce(p_early_hours, old_row.early_overtime_hours, 0)
          + coalesce(p_late_hours, old_row.late_overtime_hours, 0),
        attendance_changed_warning = false,
        reviewed_at = v_now,
        reviewed_by = p_operator_user_id,
        review_note = nullif(trim(coalesce(p_review_note, '')), ''),
        updated_at = v_now
    from pg_temp.overtime_batch_old old_row
    where request.id = old_row.id
    returning request.*
  )
  insert into public.overtime_review_logs (
    overtime_request_id,
    old_status,
    new_status,
    old_early_hours,
    new_early_hours,
    old_late_hours,
    new_late_hours,
    operator_user_id,
    created_at
  )
  select updated.id,
         old_row.status,
         updated.status,
         old_row.early_overtime_hours,
         updated.early_overtime_hours,
         old_row.late_overtime_hours,
         updated.late_overtime_hours,
         p_operator_user_id,
         v_now
  from updated
  join pg_temp.overtime_batch_old old_row on old_row.id = updated.id;

  select coalesce(jsonb_agg(to_jsonb(request) order by request.work_date, request.id), '[]'::jsonb)
  into v_result
  from public.attendance_overtime_requests request
  where request.id = any(p_ids);

  return jsonb_build_object('ok', true, 'requests', v_result);
end;
$$;

revoke all on function public.admin_review_overtime_requests_v2(uuid[], text, numeric, numeric, uuid, text)
from public, anon, authenticated;
grant execute on function public.admin_review_overtime_requests_v2(uuid[], text, numeric, numeric, uuid, text)
to service_role;

commit;
