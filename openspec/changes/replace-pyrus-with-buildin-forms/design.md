# Design: Buildin forms cutover

## Context
Forms currently dual-write Pyrus + Buildin. Catalog is capped at 5 by Pyrus field slots. Monolithic multipart loads all bytes into Node memory. Normalized child DBs (`submission_releases` / `submission_tracks`) leaked Session ID / indexes into ops UI.

## Goals / Non-Goals
- Goals: Buildin business SoT; three readable queues; one application page with full release/track content; temporary Postgres delivery ledger; unlimited release count within quotas; no binary buffering in Next.js
- Non-Goals: Native Buildin form UI; permanent Postgres payload archive; writing form intake into CRM releases/tracks (Supabase mirrors); DSP catalog auto-create on submit

## Decisions
1. **Buildin SoT** for submission content and files; Postgres stores only delivery session/items/files metadata + encrypted manifest until finalize.
2. **Three top-level DBs** by form type: back catalog, release upload, distribution. Contact + PII stay on the shared inbox DB.
3. **Single application page**: materialize builds headings/tables/toggles on that page; files append as blocks with captions. No child Buildin pages for releases/tracks.
4. **Direct upload**: server issues Buildin upload-url against the application page; browser PUTs; complete appends file block.
5. **Quotas**: 100 MB/file, 500 files/session, 30 GB/session, 5 MB encrypted manifest, 3 concurrent client PUTs.
6. **Idempotency**: client upload_id → session; Buildin key `form-session:{hash}`.
7. **Human labels**: form type, release type (incl. album «4»), genre, language resolved to Russian on write.
8. **Payload parity**: promo/social/streaming/`otherGenre`/email rendered into page blocks on finalize (not discarded with encrypted manifest).
9. **Pyrus**: write disabled after E2E; archive read-only.
10. **Archive** old `submission_releases` / `submission_tracks` after migration; stop writing them.

## Risks / Trade-offs
- Large catalogs → long page documents; mitigate with toggles per release and batched block appends
- Presigned CORS → validate with E2E before cutover
- 100 MB Buildin hard cap → reject >100 MB client+server (no silent skip)
- Encrypted manifest key rotation → single env `FORM_DELIVERY_ENCRYPTION_KEY`

## Migration Plan
1. Create three form DBs in E2E sandbox + update session materialize
2. Migrate frontends / verify Playwright
3. Create production DBs; archive old child tables
4. `PYRUS_WRITE_DISABLED=true`
5. Delete Pyrus adapters after retention
