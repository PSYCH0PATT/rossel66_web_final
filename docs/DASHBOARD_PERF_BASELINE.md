# Dashboard API baseline (dev)

Enable logging: `NODE_ENV=development` (default) or `API_PERF_LOG=1` in production.

Tracked routes log as: `[api-perf] 200 /api/... {ms}ms ~{bytes}B`

## How to capture

1. `pnpm dev`
2. Open DevTools → Network (disable cache)
3. Run 3–5 navigations per scenario; note p50/p95 from console `[api-perf]` lines

## Scenarios

| Scenario | Routes |
|----------|--------|
| Artist tabs (6) | `/api/releases`, `/api/analytics/streams` on analytics |
| Admin releases | `/api/releases?page=1` |
| Admin playlists | `/api/playlists/sftp?take=100` |

## Targets (post phase 2, hypothesis)

- `GET /api/releases` p95 &lt; 300ms at 500+ releases (paginated)
- Admin playlists initial &lt; 500KB (`take=100`)
- Artist dashboard RSC: counts only, no full release catalog

Record your "before" numbers in PR comments when comparing branches.

## No local persistence for mutable data

- Session: **httpOnly cookie** only (`rossel_session`), not `localStorage`.
- Dashboard profile: **React context** from server layout (per navigation / full reload).
- SWR: **in-memory** only, short `dedupingInterval`, `revalidateOnMount` — no `localStorage` / `sessionStorage` for releases or analytics.
