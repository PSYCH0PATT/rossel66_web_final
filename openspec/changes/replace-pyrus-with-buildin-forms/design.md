# Design: Buildin forms cutover

## Context
Forms currently dual-write Pyrus + Buildin. Catalog is capped at 5 by Pyrus field slots. Monolithic multipart loads all bytes into Node memory.

## Goals / Non-Goals
- Goals: Buildin business SoT; site UI; temporary Postgres delivery ledger; unlimited release count within resource quotas; no binary buffering in Next.js
- Non-Goals: Native Buildin form UI; permanent Postgres payload archive; DSP catalog CRM auto-create on submit

## Decisions
1. **Buildin SoT** for submission content and files; Postgres stores only delivery session/items/files metadata + encrypted manifest until finalize.
2. **Normalized pages**: one submission page + N release pages + M track pages with relations.
3. **Direct upload**: server issues Buildin upload-url; browser PUTs; complete endpoint appends file block.
4. **Quotas**: 100 MB/file, 500 files/session, 30 GB/session, 5 MB encrypted manifest, 25 releases/materialize batch, 3 concurrent client PUTs.
5. **Idempotency**: client upload_id → session; Buildin keys `submission:…`, `submission:release:i`, `submission:track:i`.
6. **Pyrus**: write disabled after E2E; archive read-only.

## Risks / Trade-offs
- Presigned CORS → validate with E2E before cutover
- 100 MB Buildin hard cap → reject >100 MB client+server (no silent skip)
- Encrypted manifest key rotation → single env `FORM_DELIVERY_ENCRYPTION_KEY`

## Migration Plan
1. Ship session API + new DBs behind flag
2. Migrate frontends
3. Dual-run optional (Buildin primary)
4. `PYRUS_WRITE_DISABLED=true`
5. Delete Pyrus adapters after retention
