# Change: Contracts Supabase-only

## Why
Report generator must read fio/contract/percentage from Supabase only. Local JSON/Excel and hardcoded defaults caused Timeweb failures.

## What Changes
- Production path: `POST /api/reports/process-python` + Prisma export
- Deprecated: `POST /api/reports/process`, `POST /api/reports/process-new`
- One-time seed: `pnpm db:seed-artist-contracts`
- Admin UI: missing contract warnings

## Impact
- Specs: report-processing, user-auth
- Docs: TIMEWEB_PERSISTENCE.md
