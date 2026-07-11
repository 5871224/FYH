# Repo Notes For Agents

This repo is the scheduler system.

## Start Here

- Frontend source: `src/renderer/`
- GitHub Pages output: `docs/`
- Supabase current schema / RPC: `supabase/`
- Scripts: `scripts/`

## Encoding

- Text files in this repo should be saved as UTF-8.
- Keep Chinese documentation in Chinese unless the user asks for English.

## Required Rules

0. Keep responses concise. Share high-level status updates only.

1. If a task changes webpage UI, interactions, styling, or frontend data flow, run:

```bash
npm run web:publish
```

2. GitHub Pages uses `docs/`, not `src/renderer/`. If `docs/` is stale, the published site is stale.

3. If frontend code changed and the user did not explicitly say not to, commit and push to `main` so GitHub Pages updates.

4. In the final reply, say whether `docs/` was updated and whether `main` was pushed.

## Schedule Storage

- `schedule_entries` is the only active schedule-cell table.
- One row is one member/date cell: `member_id + work_date`.
- Shift, leave, and overtime are columns on the same row.
- Old employee request objects are retired:
  - `leave_requests`
  - `overtime_requests`
  - `request_status`
  - `request_type`
  - `get_public_schedule_requests()`
- Schedule cell writes should use the bulk RPC in `supabase/002_current_updates.sql`.

## Auto-Schedule Status

The auto-schedule feature has foundation settings and a preview/apply flow. Treat these fields as active:

- `rules.weekStart`
- `rules.monthStartDay`
- `shift.requiredStaffCount`
- `member.scheduleDeptIds`
- `member.monthlyRestDays`

Current rule assumptions unless the user changes them:

- One member can have at most one shift per day.
- Prefer the member's own department, then support other departments.
- Manually assigned shifts/leaves are locked input.
- Monthly rest days are fixed targets.
- Existing regular/rest leave counts toward monthly rest days.
- Leave empty cells if demand cannot be filled.
- If a department has multiple shift shortages on the same day, fill in shift order.

## Rest Compliance

Current checks:

- At least 1 regular holiday in every 7 days.
- At least 1 rest day in every 7 days.
- Consecutive work days must not exceed 6.

The consecutive-work check is sliding and includes the previous-month carryover.

## SQL / Sync Reminders

If a task touches auto-schedule foundation fields, check:

- `supabase/001_current_schema.sql`
- `supabase/functions/member-auth-admin/index.ts`
- `src/renderer/web-api.js`

If a task touches schedule cell persistence, check:

- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `src/renderer/web-api.js`
- `scripts/check-normalized-storage.js`
