# Persistence boundary (Timeweb)

Production runs on **Timeweb** with an **ephemeral filesystem**: each rebuild/redeploy wipes files written under `process.cwd()` during runtime. There is no persistent volume for app disk.

## What must survive rebuild

| Data | Storage |
|------|---------|
| Releases, playlists (SFTP), reports, stream analytics | **Supabase Postgres** (Prisma) |
| Report/cover files | **Supabase Storage** |
| Session | **httpOnly** cookie `rossel_session` |
| Bandlink / VK parser cookies | **`ParserCookie`** + **`ParserRunStatus`** (Postgres) |
| Parser playlist results (source of truth) | **`Playlist`** via `savePlaylists` |
| Artist contracts (fio, fioShort, contract, percentage) | **Supabase `User`** table — admin edits via `/api/artists` |

## OK on ephemeral disk (temporary)

| Path | Notes |
|------|--------|
| `sftp_downloads/*.csv` | Re-download from SFTP after rebuild; import writes to Postgres |
| `temp_*_config.json` | Parser run config (cookies copied from Postgres) |
| `/tmp/users_export_*.json` | Prisma → Python IPC during report generation; **not** source of truth |
| `/tmp/releases_export_*.json` | Same for track royaltyShares |
| `bandlink_playlists.db` / `vk_playlists.db` | Python may still write SQLite **during a run**; Node syncs results to Postgres after success. **Not** source of truth for cookies or admin UI |
| `lib/templates/report-mendxza.xlsx` | Static report form template (in git); not artist data |

## Browser

- Do **not** store domain data in `localStorage` / `sessionStorage` (`user`, `playlists`, etc.).
- In-memory SWR dedupe is fine (tab lifetime only).

## Server cache

- `unstable_cache` TTL: `DASHBOARD_REVALIDATE_SEC` (60s) in `lib/cached-dashboard.ts`.
- Mutations call `revalidateArtistDashboardsForArtistIds` / `revalidateTag(stream-analytics)` where applicable.
- Dashboard pages are **not** required to use `force-dynamic` globally (perf plan).
- **Build-time rule:** dashboard Server Components must **not** call Prisma during `next build` / Docker build (DB is unavailable). UI warnings and lists that need DB data should load via dynamic API routes (e.g. `GET /api/artists?incompleteReportData=1`) from client components or at request time only.

## Database migrations (Supabase Postgres)

Schema lives in **Supabase only** — not on Timeweb disk. After deploy that includes new files under `prisma/migrations/`:

```bash
pnpm db:migrate:status   # pending migrations?
pnpm db:migrate            # apply to Supabase
```

If `migrate deploy` hangs on pooler port **6543**, use session port **5432** (same URL, swap port) or set `DIRECT_URL` in Timeweb env / `.env.local` per `SUPABASE_SETUP.md`. `prisma.config.ts` prefers `DIRECT_URL` for CLI migrations; the app keeps using `DATABASE_URL` (pooler).

Optional after `release_date_sort` migration:

```bash
pnpm db:backfill-release-date-sort
```

Verify:

```sql
SELECT COUNT(*) AS total, COUNT("releaseDateSort") AS with_sort FROM "Release";
```

On container start, [`entrypoint.sh`](../entrypoint.sh) runs `pnpm db:migrate` before `next start` when `DATABASE_URL` or `DIRECT_URL` is set. **Set `DIRECT_URL` (port 5432)** in Timeweb env so migrate does not hang on the pooler. If the container fails to start after deploy, check migrate logs and run `pnpm db:migrate` manually once against Supabase.

## Acceptance after Timeweb rebuild

1. **Cookies**: save Bandlink/VK cookies in admin → rebuild → parser run still loads cookies (Postgres).
2. **Playlists / releases**: counts in dashboard match SQL; admin playlists search uses `/api/playlists/sftp`.
3. **SFTP CSV**: optional re-run SFTP import if temp CSV folder was empty (documented).
4. **Browser**: Local Storage has no `user` / `playlists` keys after full dashboard flow.
5. **VK HTML parser**: `POST /api/vk-parser` creates/updates rows in `Playlist`.
6. **Reports generator**: `POST /api/reports/process-python` reads contracts from Supabase User; template at `lib/templates/report-mendxza.xlsx`.

## Report generator deploy (Timeweb)

After deploy or rebuild:

```bash
pip install -r requirements-report-processor.txt
# optional venv:
# python3 -m venv .venv && .venv/bin/pip install -r requirements-report-processor.txt
```

One-time contract seed (if needed on a fresh DB):

```bash
pnpm db:seed-artist-contracts --dry-run
pnpm db:seed-artist-contracts
```

Ensure Supabase project is **active** (not paused). Verify:

```sql
SELECT COUNT(*) FILTER (WHERE percentage IS NULL) AS no_pct
FROM "User" WHERE role = 'artist';
```

## Related

- Dashboard performance baseline: `docs/DASHBOARD_PERF_BASELINE.md`
- Cookie APIs: `/api/bandlink/cookies`, `/api/vk/cookies`
- Notifications (cookie alert): `/api/notifications` → `ParserRunStatus` for `bandlink`
