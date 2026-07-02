# Shift Scheduler

This is a browser-based scheduling system with Supabase storage and GitHub Pages output.

## Main Features

- Department, member, shift, leave, overtime, and holiday settings.
- Schedule table editing.
- Bulk schedule cell save through Supabase RPC.
- Auto-schedule preview/apply flow.
- Rest compliance checks.
- Import/export helpers.

## Project Layout

- `src/renderer/`: frontend source.
- `docs/`: generated static site for GitHub Pages.
- `supabase/`: SQL migrations and Edge Functions.
- `scripts/`: local checks and publish helpers.

## Commands

```bash
npm run web
npm run web:check
npm run web:publish
```

- `npm run web`: run the local static preview server.
- `npm run web:check`: verify public Supabase config.
- `npm run web:publish`: copy `src/renderer/` into `docs/` with cache-busting asset URLs.

Run `npm run web:publish` after frontend changes.

## Current Storage Model

The active Supabase model is normalized. The old JSON document storage is no longer the live source.

Current schedule storage:

- `schedule_entries` is the single source of truth for schedule cells.
- A cell is unique by `member_id + work_date`.
- Shift, leave, and overtime are stored on the same row.
- Bulk writes use `public.save_schedule_entries_bulk(entries jsonb)`.

Old request workflow artifacts are removed and should not be used:

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `get_public_schedule_requests()`

## Auto-Schedule

Auto-schedule currently works as a preview/apply flow. It uses:

- member active dates
- member department priority
- shift required staff count
- fixed rest weekday
- monthly rest-day target
- rest compliance assumptions

Important functions:

- `buildAutoSchedulePreview()`
- `findMinimumCostFlowAssignments()`
- `placeDailySurplusRestDays()`
- `applyAutoSchedulePreview()`

## Verification

Useful checks:

```bash
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node scripts/check-normalized-storage.js
node scripts/check-request-overlay-imports.js
node scripts/check-settings-lists.js
npm run web:publish
```
