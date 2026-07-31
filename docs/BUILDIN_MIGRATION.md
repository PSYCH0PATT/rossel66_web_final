# Buildin migration

## MCP vs REST (important)

| Channel | Works where | Token | Form dual-write / cron |
|---------|-------------|-------|------------------------|
| **Cursor MCP** (`mcp.buildin.ai`) | Only inside Cursor agent | Cursor OAuth/session — not in `.env` | **No** |
| **Buildin V2 REST** (`https://api.buildin.ai/v2`) | Next.js server, scripts, Docker | `BUILDIN_API_TOKEN` or `BUILDIN_TOKEN` | **Yes** |
| **Buildin CLI** (skill `buildin-cli`) | Local agent/dev machine | Same Bearer token or `buildin login` | Setup/debug only |

MCP is enough to create databases and inspect the workspace from this chat.
It is **not** enough for production form submissions: the Timeweb container cannot call Cursor MCP.

Agent skill installed at [`.agents/skills/buildin-cli/SKILL.md`](../.agents/skills/buildin-cli/SKILL.md). CLI installer from CDN is optional and requires explicit approval (do not auto-install).

### How to get `BUILDIN_API_TOKEN`

1. Open Buildin → **Settings → Integrations**
2. Create a dedicated bot **Rossel Music Production** (prefer separate from the Cursor MCP integration)
3. Copy the API Token
4. Put it only in secrets (never in chat / git):

```bash
# .env.local (local)
BUILDIN_API_TOKEN=...
# aliases also accepted:
# BUILDIN_TOKEN=...
# BUILDIN_BASE_URL=https://api.buildin.ai

# Timeweb / Docker: same BUILDIN_API_TOKEN + all BUILDIN_DB_* from docs/BUILDIN_DATABASE_IDS.env
```

5. Verify without printing the token:

```bash
npm run smoke:buildin
```

Exit code `2` = token still missing. Exit `0` = REST whoami + submissions DB OK.

Until the token is set, `isBuildinDualWriteEnabled()` is false and forms write **Pyrus only**.

## Architecture

- **Postgres / Supabase** — sole SoT for users, catalog, money, parsers, files, analytics.
- **Buildin** — sole SoT for manual ops fields (`Ops Status`, assignee, notes, deadline, tags).
- Forward sync sends **mirror-owned fields only** on update; create may set initial Ops Status once.
- Dual-write: forms write to Pyrus (until cutover) **and** Buildin. Canonical row lives in `FormSubmission`.
- `data_rf` / `data_not_rf`: shared **Заявки** stores metadata only; PII lives in closed DBs (no Payload JSON dump).
- Activity + PlaylistHistory mirrors are **archived** (no new enqueue). History remains in Postgres UI.
- Keep `PYRUS_WRITE_DISABLED=false` until security, retry, ACL and reconciliation are green.

See ownership + workspace IA: [`docs/BUILDIN_OPS_WORKSPACE.md`](BUILDIN_OPS_WORKSPACE.md), OpenSpec change `refactor-buildin-ops-workspace`.

## Phase 0 — Foundation (done in code)

- Server-only client: `lib/buildin/` (`BUILDIN_API_TOKEN` / `BUILDIN_TOKEN`)
- Tables: `FormSubmission`, `BuildinExternalId`, `BuildinOutbox`, `PlaylistHistory`
- Security hardening: VK/Bandlink cookie GET no longer returns values; reports quarters require auth
- Never sync: passwords, sessions, parser cookie values, API keys, `CRON_SECRET`
- Upload: presigned PUT via `/v2/files/upload-url`; MIME normalized to Buildin whitelist; parent `{ type: "page_id", page_id }`

### Setup databases

```bash
BUILDIN_API_TOKEN=... npx tsx scripts/setup-buildin-databases.ts
```

Or use pre-created workspace DBs from [`docs/BUILDIN_DATABASE_IDS.env`](BUILDIN_DATABASE_IDS.env) (all 11 ROSSEL — * databases already exist in workspace ROSSEL 66).

Copy `BUILDIN_DB_*` ids into `.env.local`. **Restrict ACL on PII DBs** (`BUILDIN_DB_PII_RF`, `BUILDIN_DB_PII_NOT_RF`) before production.

## Phase 1 — Forms dual-write

Legacy routes (dual-write period):

- `submit-pyrus-release-upload`
- `submit-pyrus-catalog-upload`
- `submit-pyrus-distribution`
- `submit-pyrus-data-rf`
- `submit-pyrus-data-not-rf`

**Form session API** (preferred after cutover; file-heavy flows):

| Step | Endpoint |
|------|----------|
| Create session | `POST /api/forms/sessions` |
| Materialize Buildin pages | `POST /api/forms/sessions/{id}/materialize` |
| Presign upload | `POST /api/forms/sessions/{id}/files/presign` |
| Complete upload | `POST /api/forms/sessions/{id}/files/complete` |
| Finalize | `POST /api/forms/sessions/{id}/finalize` |
| Status | `GET /api/forms/sessions/{id}` |

PII-only forms (`data_rf`, `data_not_rf`, `contact`) may use `POST /api/forms/simple` without a file session.

Flags:

| Env | Meaning |
|-----|---------|
| `BUILDIN_DUAL_WRITE` | default on when token present; set `false` to pause |
| `PYRUS_WRITE_DISABLED` | Buildin-only cutover — legacy multipart `submit-pyrus-*` (catalog/release/distribution) and `pyrus-file-upload` return **410 Gone**; data forms write Buildin via `recordAndDualWriteSubmission` only |
| `FORM_DELIVERY_ENCRYPTION_KEY` | encrypts session manifests at rest (fallback: `BUILDIN_API_TOKEN`) |

When `PYRUS_WRITE_DISABLED=true`, no calls to `api.pyrus.com`. Roll back by setting `PYRUS_WRITE_DISABLED=false` if E2E fails.

Files: presigned PUT per file via session API; per-file 100 MB limit; up to 30 GB per session. Expired sessions: `npm run cleanup:form-sessions`.

## Phase 2 — Artists / releases CRM

- Create/update artist & release enqueue `sync_artist` / `sync_release` via outbox
- `autoStatus` (Release.status from parsers) is mirrored separately from Buildin `opsStatus`
- Reverse sync allowlist: `POST /api/admin/buildin/reverse-sync` (`opsStatus`, assignee, deadline, tags, notes)

## Phase 3 — Ops mirrors

- Reports (read-only financial flags), playlist **track placements**, parser run alerts (no cookie values)
- Playlist history persists to Postgres only (Buildin mirror disabled)
- Playlist Buildin table: one row per track (`Артист`, `Трек`, `Плейлист`, `URL`, `Впервые обнаружен`)
- `Впервые обнаружен` = earliest system/parser observation (MSK): min(existing, CSV `parsed_date`, parent Playlist, history); not DSP add date; survives disappear/return; never moves forward
- Backfill: `npm run backfill:playlist-first-seen -- --sync-buildin`

## Phase 4 — Optional

- `POST /api/admin/buildin/kpi-snapshot` — aggregate KPIs only
- Site CMS / full analytics dump — **not** part of core migration

## Phase 5 — Forbidden

Artist login/cabinet, raw StreamAnalytics, Excel/Python report generation, cron/SFTP/parsers, sole copy of critical report files in Buildin.

## Cutover checklist

1. `npm run smoke:buildin` → exit 0
2. `npm run reconcile:buildin` or `GET /api/admin/buildin/reconciliation` → `cutoverReady`
3. E2E all five forms (multi-file, ~100MB, retry, duplicate)
4. PII permission test with non-privileged Buildin user
5. Team processes real tickets in Buildin
6. Test rollback: `PYRUS_WRITE_DISABLED=false`
7. Set `PYRUS_WRITE_DISABLED=true`
8. `npm run export:buildin-id-map` and archive export
9. Leave Pyrus read-only for agreed retention

## Ops commands

```bash
npm run setup:buildin
npm run smoke:buildin
npm run backfill:buildin -- --dry-run
npm run backfill:buildin
npm run process:buildin-outbox
npm run reconcile:buildin
npm run reconcile:buildin-mirrors
npm run migrate:buildin-relations -- --dry-run
npm run export:buildin-id-map
npm run test:buildin
```

Admin:
- `GET /api/admin/buildin/reconciliation` — submissions + mirrors + Buildin query probe
- `POST /api/admin/buildin/requeue` — revive dead outbox jobs

Workspace IA (manual): [`docs/BUILDIN_OPS_WORKSPACE.md`](BUILDIN_OPS_WORKSPACE.md)

## Remote workspace schema (2026-07-28)

Applied via MCP/`mutateDatabase` to the live `ROSSEL 66` databases:

- people: `Assignee` (artists/releases/reports), `Ответственный` (submissions)
- relations: `АртистRel` / `РелизRel` / `ЗаявкаRel` on the seven directions
- Russian select option names (same option IDs — values preserved)
- removed `Payload JSON` from PII РФ / PII не РФ
- renamed Activity / Playlist History titles to `(архив)`
- Ops Center page: `0951bf11-7507-463c-9b2d-5f5b484c2eef`

### Playlist placements (2026-07-31)

- Postgres model `PlaylistTrackPlacement` — stable `placementKey`, `firstSeenDate`, `isActive`
- Buildin entityType `playlist_placement` (legacy `playlist` mappings archived via migrate script)
- Slim remote properties; migrate:

```bash
npx prisma migrate deploy
npm run migrate:buildin-playlist-placements -- --dry-run
npm run migrate:buildin-playlist-placements
npm run migrate:buildin-playlist-placements -- --archive-legacy
npm run migrate:buildin-playlist-placements -- --cleanup-schema
npm run reconcile:buildin-mirrors
```

Relation backfill: `npm run migrate:buildin-relations` (exact `BuildinExternalId` only; playlist→artist skipped).

Checkpoint (local, not git): `.tmp/buildin-checkpoint/`.

### Rollback schema (manual / careful)

1. Restore select option **names** to English machine values by option `id` (do not delete options).
2. Relations: clear relation values, then delete relation properties if needed.
3. people → rich_text: Buildin does not convert types; delete people property and re-add rich_text (assignments lost).
4. Re-add `Payload JSON` on PII only if legal requires a dump field (prefer structured fields).
5. Do **not** set `PYRUS_WRITE_DISABLED=true` during rollback.

## Backfill (Postgres → Buildin)

One-time / resumable mirror of the ops pool into the shared hub databases:

```bash
npm run smoke:buildin
npm run backfill:buildin -- --dry-run          # counts only
npm run backfill:buildin                       # artists, releases, tracks, reports, playlist placements, …
npm run backfill:buildin -- --only=artists,releases,tracks
npm run backfill:buildin -- --force            # re-upsert even if BuildinExternalId exists
```

- Uses existing `sync*ToBuildin` adapters (+ `syncTrackToBuildin` for `Release.tracks` JSON).
- Skips rows already mapped in `BuildinExternalId` unless `--force`.
- Does **not** copy StreamAnalytics, passwords, cookies, or Pyrus-only history outside `FormSubmission`.
- Submissions / PII: only rows in `FormSubmission` (file binaries not replayed).
- Requires migration `20260720120000_buildin_sync_foundation` applied (`FormSubmission`, `BuildinExternalId`, `BuildinOutbox`, `PlaylistHistory`).

Cron: `GET /api/cron/buildin-outbox` with `Authorization: Bearer $CRON_SECRET`

See also: [`docs/PYRUS_ARCHIVE.md`](PYRUS_ARCHIVE.md), [`docs/BUILDIN_TOKEN_SETUP.md`](BUILDIN_TOKEN_SETUP.md).
