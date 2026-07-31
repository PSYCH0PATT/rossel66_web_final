## 1. Contract and docs
- [x] 1.1 OpenSpec proposal/design/deltas validated (`openspec validate refactor-buildin-ops-workspace --strict`)
- [x] 1.2 Update `docs/BUILDIN_MIGRATION.md` with ownership, PII policy, active DBs, rollback

## 2. Protect ops fields and PII
- [x] 2.1 Split mirror-owned vs ops-owned properties in artist/release/report adapters
- [x] 2.2 Remove hardcoded `opsStatus: "intake"` from release sync hooks
- [x] 2.3 Redact PII from shared submissions pages; strip Payload JSON from PII DBs

## 3. Harden outbox / dual-write
- [x] 3.1 Stable submission idempotency key `submission:<id>`
- [x] 3.2 Stage form files in Supabase Storage for retry
- [x] 3.3 Reclaim stale `processing`, coalesce pending events, 429 retry in client
- [x] 3.4 Admin requeue for dead outbox jobs

## 4. Complete live sync
- [x] 4.1 Sync on release update + track upsert/archive
- [x] 4.2 Sync on report paid/signed/ack changes
- [x] 4.3 Sync on playlist update/delete archive
- [x] 4.4 Disable new activity / playlist_history mirrors

## 5. Schema / workspace / reconcile
- [x] 5.1 Russian label mapping + people/relation schemas in defs + remote mutate
- [x] 5.2 Ops Center page created under hub (views/pin/ACL remain owner-browser; see runbook)
- [x] 5.3 Expand reconciliation + relation migrate script + tests
- [x] 5.4 Relation backfill executed (exact IDs); checkpoint in `.tmp/buildin-checkpoint/`

## 6. Playlist track placements
- [x] 6.1 Spec: one Buildin row per track; first-seen = system observation
- [x] 6.2 Prisma `PlaylistTrackPlacement` + ingestion lifecycle (active/inactive, stable firstSeen)
- [x] 6.3 Slim Buildin playlists schema + sync fan-out with composite IDs
- [x] 6.4 Migrate/backfill script (dry-run + live) + archive legacy playlist pages
- [x] 6.5 Reconciliation, tests, docs
