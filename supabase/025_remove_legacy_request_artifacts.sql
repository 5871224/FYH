-- Final cleanup for the removed employee request workflow.
-- Leave and overtime now live only on public.schedule_entries.

drop function if exists public.get_public_schedule_requests();
drop function if exists public.enforce_single_effective_leave_request();
drop function if exists public.enforce_single_effective_overtime_request();

drop table if exists public.leave_requests cascade;
drop table if exists public.overtime_requests cascade;

drop type if exists public.request_status cascade;
drop type if exists public.request_type cascade;
