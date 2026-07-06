# V2 Deployment

Edge Function deployment does not apply database SQL automatically.

## SQL order

Use `V2_SQL_ORDER_FINAL.md` as the only authoritative SQL application order. It currently includes migrations through `036_v2_synchronized_member_delete.sql`.

Apply every listed SQL file successfully before deploying Edge Functions. Stop immediately when SQL Editor reports an error; do not skip ahead.

## Edge Functions

After applying SQL, run `scripts/deploy-v2-final.ps1` from the repository root after Supabase CLI login and project linking.

The deployment script includes attendance, meal, overtime, account deletion, personal records and reporting functions.

## Important rules

- Do not expose attendance coordinates or fixed IP settings through normal REST reads.
- Do not allow direct authenticated writes to attendance, attendance overtime, or meal order tables.
- Keep attendance overtime independent from schedule overtime.
- Account deletion must start from the Auth user and use the database cascade defined in migration 036; never delete only `set_employee`.
- Keep `src/renderer/` and `docs/` synchronized when publishing web changes.
