# V2 Deployment

Edge Function deployment does not apply database SQL automatically.

## SQL order

Apply these files in Supabase SQL Editor in this order:

1. `001_current_schema.sql`
2. `024_schedule_entries_rpc.sql`
3. `026_meal_admin_settings_rpc.sql`
4. `027_v2_security.sql`
5. `028_v2_attendance_clock.sql`
6. `029_v2_attendance_admin.sql`
7. `030_v2_meal_snapshot.sql`
8. `031_v2_role_department_protection.sql`

The later files depend on columns and functions created by the earlier files.

## Edge Functions

After applying SQL, deploy:

- `attendance-clock`
- `meal-order`
- `attendance-overtime-employee`
- `attendance-overtime-admin-list`
- `attendance-overtime-admin-action`
- `attendance-admin-list-v2`
- `attendance-admin-action-v2`
- `department-attendance-v2`
- `member-delete-v2`
- `personal-records-v2`
- `meal-report-v2`
- `meal-cancel-v2`

Run `scripts/deploy-v2.ps1` from the repository root after Supabase CLI login and project linking.

## Important rules

- Do not expose attendance coordinates or fixed IP settings through normal REST reads.
- Do not allow direct authenticated writes to attendance, attendance overtime, or meal order tables.
- Keep attendance overtime independent from schedule overtime.
- Keep `src/renderer/` and `docs/` synchronized when publishing web changes.
