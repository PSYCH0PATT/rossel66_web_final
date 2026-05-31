# Change: Contracts Supabase-only

## Why
Report generator must read fio/contract/percentage from Supabase only. Local JSON/Excel and hardcoded defaults caused Timeweb failures.

## What Changes
- Production path: `POST /api/reports/process-python` + Prisma export
- Required report fields: fio, contract, percentage (0 is valid; NULL/empty/`-` is not)
- Deprecated: `POST /api/reports/process`, `POST /api/reports/process-new`
- One-time seed: `pnpm db:seed-artist-contracts`
- Admin UI: banner, post-generation notifications, artist list badge
- API: `GET /api/artists?incompleteReportData=1`
- Python: `REPORT_INCOMPLETE_JSON` with per-artist `missingFields`

## Impact
- Specs: report-processing, user-auth, artist-management
- Docs: TIMEWEB_PERSISTENCE.md
