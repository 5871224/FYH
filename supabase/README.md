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
- Meal order saves go through `public.save_meal_order_v2(...)` so delete/insert happens in one database transaction.
- Department fixed public IP values live in `set_departments.public_ip`; only admins can read or update protected attendance fields.
- Employee overtime deletes are soft deletes so review/history rows are preserved.
- Catalog tables use their UUID `id` as the only application identifier; `scheduler_item_id` is retired.
- Shift applicability uses the required single `set_shift.applicable_department_id` column.
- RLS policies are created in `001_current_schema.sql`; direct table writes should still stay narrow and manager-only.

## Active Tables

- `scheduler_settings`: global scheduler settings.
- `set_departments`: departments/locations.
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
3. `026_meal_admin_settings_rpc.sql`: meal product and cutoff settings RPC.
4. `027_v2_security.sql`: active employee, role, and session helper RPCs.
5. `028_v2_attendance_clock.sql`: V2 attendance clock RPC.
6. `029_v2_attendance_admin.sql`: admin attendance edit RPC and action log details.
7. `030_v2_meal_snapshot.sql`: V2 meal order snapshot RPC.
8. `031_v2_role_department_protection.sql`: role and sensitive department protection.
9. `032_v2_overtime_batch.sql`: overtime batch review RPC.
10. `033_v2_employee_visibility.sql`: active/near-resigned employee visibility helper.
11. `034_v2_overtime_reapply.sql`: overtime reapply support.
12. `035_v2_last_admin.sql`: last-admin protection.

## Notes For Changes

- Do not restore the old schedule leave/overtime request workflow. Attendance overtime requests must stay independent from schedule overtime.
- If a frontend change writes schedule cells, keep `docs/` updated with `npm run web:publish`.
- If table or schedule cell columns change, update:
  - `001_current_schema.sql`
  - `024_schedule_entries_rpc.sql`
  - `src/renderer/web-api.js`
  - `scripts/check-normalized-storage.js`
