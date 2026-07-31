# Change: Refactor Buildin Ops Workspace

## Why
Buildin dual-write and CRM mirrors exist, but forward sync can overwrite manual ops fields, PII leaks into the shared submissions inbox, outbox retries are not fully idempotent, and several live update/delete paths never sync. The workspace is not yet a reliable daily ops tool.

## What Changes
- Field ownership: Postgres remains SoT for domain data; Buildin is SoT for manual ops fields; forward sync never patches ops-owned fields
- PII policy: shared Заявки no longer stores passport/bank payloads for `data_rf` / `data_not_rf`; closed PII DBs keep structured fields only
- Reliable outbox: stable idempotency keys, file staging for retries, lease reclaim, event coalescing, 429-aware client retries
- Live sync coverage: release updates/tracks, report status changes, playlist updates/archives; stop mirroring Activity and PlaylistHistory
- Buildin schema/UX: relations, people assignee, Russian labels, ops inbox workflow; archive Activity/PlaylistHistory from primary IA
- Playlist placements: one Buildin row per track with stable first-observed date (not DSP add date); slim properties only
- Reconciliation covers all active entities; reverse-sync stub replaced by export/reconcile semantics (no fake Postgres write-back for ops)

## Impact
- Affected specs: `forms-integration` (MODIFIED), new capability `buildin-ops`
- Affected code: `lib/buildin/**`, `lib/sftp-playlist-storage.ts`, `lib/playlist-placements.ts`, Prisma `PlaylistTrackPlacement`, report/playlist hooks, admin reconciliation, docs
- Non-goals: no Cloudflare worker; no DSP-true add dates (unavailable); `PYRUS_WRITE_DISABLED` stays false until green checks
