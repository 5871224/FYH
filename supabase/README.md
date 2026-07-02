# Supabase Schema

This folder contains the database migrations for the scheduler.

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

Migration `025_remove_legacy_request_artifacts.sql` is the final cleanup for these objects.

## Migration Order

1. `001_initial_schema.sql`: original base schema.
2. `002_data_api_grants.sql`: API grants.
3. `006_login_by_employee_code.sql`: employee-code login RPC.
4. `008_overtime_request_details.sql`: historical overtime request fields.
5. `015_auto_schedule_settings.sql`: auto-schedule settings.
6. `016_manager_schedule_entries_cleanup.sql`: historical request-flow cleanup.
7. `017_normalized_scheduler_storage.sql`: normalized storage migration from legacy JSON.
8. `018_drop_unused_tables.sql`: unused table cleanup.
9. `019_public_overtime_item_id.sql`: historical public request RPC adjustment.
10. `020_cleanup_demo_test_data.sql`: demo/test data cleanup.
11. `021_remove_schedule_months.sql`: remove `schedule_months`; schedule cells become unique by `member_id + work_date`.
12. `022_rename_settings_and_merge_schedule_entries.sql`: rename setting tables to `set_*` and merge leave/overtime into `schedule_entries`.
13. `023_fix_login_employee_table.sql`: login RPC fix for `set_employee`.
14. `024_schedule_entries_rpc.sql`: bulk RPC for schedule cell writes.
15. `025_remove_legacy_request_artifacts.sql`: final removal of old request RPC/tables/types.

## Notes For Changes

- Do not add new leave/overtime request tables. Use `schedule_entries`.
- If a frontend change writes schedule cells, keep `docs/` updated with `npm run web:publish`.
- If schedule cell columns change, update:
  - `024_schedule_entries_rpc.sql`
  - `src/renderer/web-api.js`
  - `scripts/check-normalized-storage.js`
