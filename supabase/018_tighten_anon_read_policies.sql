begin;

-- 公開網域部署：移除匿名讀取班表與主檔資料的政策。
-- 登入流程仍保留 anon 可執行 login_email_by_employee_code。
-- 員工請假/加班 overlay 改為僅 authenticated 可呼叫 get_public_schedule_requests。

drop policy if exists "anon_can_read_scheduler_settings" on public.scheduler_settings;
drop policy if exists "anon_can_read_departments" on public.departments;
drop policy if exists "anon_can_read_profiles" on public.profiles;
drop policy if exists "anon_can_read_leave_types" on public.leave_types;
drop policy if exists "anon_can_read_overtime_types" on public.overtime_types;
drop policy if exists "anon_can_read_member_departments" on public.member_departments;
drop policy if exists "anon_can_read_shift_types" on public.shift_types;
drop policy if exists "anon_can_read_schedule_months" on public.schedule_months;
drop policy if exists "anon_can_read_schedule_entries" on public.schedule_entries;
drop policy if exists "anon_can_read_holidays" on public.holidays;

revoke select on table public.scheduler_settings from anon;
revoke select on table public.departments from anon;
revoke select on table public.profiles from anon;
revoke select on table public.leave_types from anon;
revoke select on table public.overtime_types from anon;
revoke select on table public.member_departments from anon;
revoke select on table public.shift_types from anon;
revoke select on table public.schedule_months from anon;
revoke select on table public.schedule_entries from anon;
revoke select on table public.holidays from anon;

revoke execute on function public.get_public_schedule_requests() from anon;
grant execute on function public.get_public_schedule_requests() to authenticated;

commit;
