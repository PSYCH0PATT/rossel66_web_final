# Dashboard navigation — acceptance checklist

## Artist (6 tabs)

- [ ] No fullscreen `AuthCheck` spinner when switching tabs
- [ ] Sidebar/header stay mounted (no flash remount)
- [ ] Home KPI loads without multi‑MB RSC (counts only in Network → document)
- [ ] Releases list: `trackCount` correct; sort newest first
- [ ] Analytics: loads without localStorage auth delay; numbers refresh after admin import (within cache TTL or manual refresh)

## Admin

- [ ] Shell same as artist
- [ ] Releases paginated; p95 target &lt; 300ms at scale (see baseline doc)
- [ ] Playlists: initial `take=100`; search finds rows beyond first page; UI shows «N из M»
- [ ] Home: no full `releases[]` in RSC payload

## Regression

- [ ] No double sidebar
- [ ] Artist cannot open another artist’s `username` URL
- [ ] After delete/create release, list updates (SWR mutate)
- [ ] Mobile: no large bottom gap (`100dvh` shell)

## Dev metrics

Console `[api-perf]` on `/api/releases`, `/api/analytics/streams`, `/api/playlists/sftp`.
