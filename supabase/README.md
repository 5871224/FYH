# Supabase Schema

This folder contains the current database schema and RPC definitions for the scheduler.
Historical one-off migrations were removed after the schema was normalized.

## Current Model

- `schedule_entries` is the single source of truth for schedule cells.
- A schedule cell is unique by `member_id + work_date`.
- Shift, leave, and overtime are columns on the same `schedule_entries` row.
- Employee leave/overtime request tables are no longer part of the active model.
- Bulk cell writes go through `public.save_schedule_entries_bulk(entries jsonb)`.

## Active Tables

- `scheduler_settings`: global scheduler settings.
- `set_departments`: departments/locations.
- `set_employee`: scheduler members and roles.
- `set_employee_departments`: member department priority/order.
- `set_shift`: shift catalog.
- `set_leave`: leave catalog.
- `set_overtime`: overtime catalog.
- `holidays`: holiday catalog.
- `schedule_entries`: schedule cells by member and date.
- `clock_locations` / `attendance_logs`: reserved for attendance features.

## Removed Legacy Objects

These are legacy artifacts from the old employee request workflow and should not be used by new code:

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `public.get_public_schedule_requests()`

## Files

1. `001_current_schema.sql`: current tables, indexes, RLS enablement, and `is_manager`.
2. `023_fix_login_employee_table.sql`: login email column and employee-code login RPC.
3. `024_schedule_entries_rpc.sql`: bulk RPC for schedule cell writes.

## Notes For Changes

- Do not add new leave/overtime request tables. Use `schedule_entries`.
- If a frontend change writes schedule cells, keep `docs/` updated with `npm run web:publish`.
- If table or schedule cell columns change, update:
  - `001_current_schema.sql`
  - `024_schedule_entries_rpc.sql`
  - `src/renderer/web-api.js`
  - `scripts/check-normalized-storage.js`
