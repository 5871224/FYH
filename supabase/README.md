# Supabase Schema

This folder contains the current database schema and RPC definitions for the scheduler.
Historical one-off migrations were removed after the schema was normalized.

## Current Model

- `schedule_entries` is the single source of truth for schedule cells.
- A schedule cell is unique by `member_id + work_date`.
- Shift, leave, and overtime are columns on the same `schedule_entries` row.
- Attendance overtime requests are independent from schedule overtime columns.
- Bulk cell writes go through `public.save_schedule_entries_bulk(entries jsonb)`.
- Attendance clock writes go through `public.save_attendance_clock(...)` so duplicate clicks do not overwrite the first clock time.
- Meal order saves go through `public.save_meal_order(...)` so delete/insert happens in one database transaction.
- Department fixed public IP values live in `department_attendance_settings`, not directly in `set_departments`.
- Employee overtime deletes are soft deletes so review/history rows are preserved.
- Catalog tables use their UUID `id` as the only application identifier; `scheduler_item_id` is retired.
- Shift applicability uses the required single `set_shift.applicable_department_id` column.
- RLS policies are created in `001_current_schema.sql`; direct table writes should still stay narrow and manager-only.

## Active Tables

- `scheduler_settings`: global scheduler settings.
- `set_departments`: departments/locations.
- `department_attendance_settings`: sensitive attendance settings such as fixed public IP.
- `set_employee`: scheduler members, roles, and ordered schedulable shift IDs.
- `set_shift`: shift catalog.
- `set_leave`: leave catalog.
- `set_overtime`: overtime catalog.
- `holidays`: holiday catalog.
- `schedule_entries`: schedule cells by member and date.
- `attendance_records`: current effective clock-in/out data by person/date.
- `attendance_action_logs`: admin attendance change history.
- `attendance_overtime_requests`: attendance-based overtime requests, separate from schedule overtime.
- `overtime_review_logs`: overtime review history.
- `meal_products`: meal ordering products.
- `meal_settings`: meal cutoff settings.
- `meal_orders`: meal order item rows.

## Removed Legacy Objects

These are legacy artifacts from the old employee request workflow and should not be used by new code:

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `public.get_public_schedule_requests()`
- `clock_locations`
- `attendance_logs`

## Files

1. `001_current_schema.sql`: current tables, indexes, RLS policies, admin protection trigger, and attendance/meal RPCs.
2. `024_schedule_entries_rpc.sql`: bulk RPC for schedule cell writes.

## Notes For Changes

- Do not restore the old schedule leave/overtime request workflow. Attendance overtime requests must stay independent from schedule overtime.
- If a frontend change writes schedule cells, keep `docs/` updated with `npm run web:publish`.
- If table or schedule cell columns change, update:
  - `001_current_schema.sql`
  - `024_schedule_entries_rpc.sql`
  - `src/renderer/web-api.js`
  - `scripts/check-normalized-storage.js`
