begin;

-- The current attendance flow uses attendance_records and set_departments.
-- These two empty legacy tables are no longer referenced by views,
-- database functions, or the application.
drop table if exists public.attendance_logs;
drop table if exists public.clock_locations;

commit;
