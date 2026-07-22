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

- **Next.js / Postgres / Supabase** remain the source of truth for auth, artist cabinet, financial calculations, distribution auto-status, analytics, cron/parsers.
- **Buildin** is the ops back-office for form submissions, CRM notes, assignees, deadlines, checklist, and operational mirrors.
- Dual-write: forms write to Pyrus (until cutover) **and** Buildin. Canonical row lives in `FormSubmission`.

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

Routes (all five):

- `submit-pyrus-release-upload`
- `submit-pyrus-catalog-upload`
- `submit-pyrus-distribution`
- `submit-pyrus-data-rf`
- `submit-pyrus-data-not-rf`

Flags:

| Env | Meaning |
|-----|---------|
| `BUILDIN_DUAL_WRITE` | default on when token present; set `false` to pause |
| `PYRUS_WRITE_DISABLED` | Buildin-only cutover |

Files: each file uploaded separately to Buildin; per-file 100 MB limit.

## Phase 2 — Artists / releases CRM

- Create/update artist & release enqueue `sync_artist` / `sync_release` via outbox
- `autoStatus` (Release.status from parsers) is mirrored separately from Buildin `opsStatus`
- Reverse sync allowlist: `POST /api/admin/buildin/reverse-sync` (`opsStatus`, assignee, deadline, tags, notes)

## Phase 3 — Ops mirrors

- Reports (read-only financial flags), playlists, activity, parser run alerts (no cookie values)
- Playlist history now persists to Postgres + Buildin mirror

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
npm run export:buildin-id-map
npm run test:buildin
```

## Backfill (Postgres → Buildin)

One-time / resumable mirror of the ops pool into the shared hub databases:

```bash
npm run smoke:buildin
npm run backfill:buildin -- --dry-run          # counts only
npm run backfill:buildin                       # artists, releases, tracks, reports, playlists, history, activity, parser runs, submissions
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
