select 'profiles' as table_name, count(*) as row_count from public.profiles
union all
select 'departments', count(*) from public.departments
union all
select 'shift_types', count(*) from public.shift_types
union all
select 'leave_types', count(*) from public.leave_types
union all
select 'overtime_types', count(*) from public.overtime_types
union all
select 'schedule_months', count(*) from public.schedule_months
union all
select 'schedule_entries', count(*) from public.schedule_entries
union all
select 'scheduler_settings', count(*) from public.scheduler_settings
union all
select 'leave_requests', count(*) from public.leave_requests
union all
select 'overtime_requests', count(*) from public.overtime_requests
order by table_name;
