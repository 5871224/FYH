begin;

alter table public.attendance_overtime_requests
  drop constraint if exists attendance_overtime_requests_user_id_work_date_key;

alter table public.attendance_overtime_requests
  drop constraint if exists attendance_overtime_requests_user_work_date_key;

drop index if exists public.attendance_overtime_requests_user_id_work_date_key;
drop index if exists public.attendance_overtime_requests_user_work_date_key;

create unique index if not exists attendance_overtime_requests_active_user_date_uidx
on public.attendance_overtime_requests(user_id, work_date)
where is_deleted_by_employee = false;

create index if not exists attendance_overtime_requests_history_user_date_idx
on public.attendance_overtime_requests(user_id, work_date, submitted_at desc);

commit;
