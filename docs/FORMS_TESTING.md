# Надёжное тестирование форм ROSSEL → Buildin

## Слои

1. **PR CI** (`.github/workflows/forms-ci.yml`) — `pnpm test`, `tsc --noEmit`, `pnpm build`
2. **Integration** — Postgres (`docker-compose.test.yml`) + mock Buildin (`tests/support/mock-buildin.ts`)
3. **Playwright E2E** — против Vercel staging (`tests/e2e/forms.spec.ts`)
4. **Production health** — `GET /api/cron/forms-health` (Bearer `CRON_SECRET`), без создания заявок

## Локальный запуск

```bash
# Unit
pnpm test

# Integration DB
docker compose -f docker-compose.test.yml up -d
pnpm test:db:migrate   # local :54329 only (refuses Supabase/remote); schema via db push
pnpm test:integration

# E2E (нужен поднятый staging или local next с Buildin sandbox)
pnpm exec playwright install chromium
E2E_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e
```

## Staging (Vercel)

**Live E2E URL:** `https://rossel-music.vercel.app`

```bash
# Health (must be 200 / ok:true before Playwright)
curl -sS -H "Authorization: Bearer $E2E_CRON_SECRET" \
  https://rossel-music.vercel.app/api/cron/forms-health

# Playwright against staging
set -a; source .env.e2e.run.local; set +a
E2E_BASE_URL=https://rossel-music.vercel.app \
E2E_VERIFY_BUILDIN=1 \
pnpm test:e2e
```

1. Проект `rossel-music` (staging-only), Node **20** (или 24 после deprecation).
2. Отдельный Neon Postgres (не production Supabase). Claim/renew: see `.env.vercel.staging.local` → `PUBLIC_POSTGRES_CLAIM_URL` (ephemeral DBs expire).
3. `pnpm setup:buildin-e2e` → `docs/FORMS_E2E_DATABASE_IDS.env` (sandbox: parent `536088a1-…`, submissions `b7fa63ed-…`).
4. Vercel env: `docs/FORMS_STAGING.env.example`. Map `E2E_BUILDIN_DB_*` → `BUILDIN_DB_*`.
5. Git author for deploys on Hobby must be the Vercel owner (`nickrez2107@gmail.com` / `psych0patt`). Repo-local `user.email` is set; do **not** deploy commits authored by `mtxc.eu` or Hobby will BLOCK.
6. Deployment Protection: SSO off for this staging project; optional Automation Bypass in `.vercel-bypass.secret` / GitHub `VERCEL_AUTOMATION_BYPASS_SECRET`.

### GitHub secrets (forms-biweekly)

| Secret | Value |
|--------|--------|
| `E2E_BASE_URL` | `https://rossel-music.vercel.app` |
| `E2E_CRON_SECRET` | same as Vercel `CRON_SECRET` (see `.env.e2e.run.local`) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | optional if protection re-enabled |
| `E2E_BUILDIN_*` / `BUILDIN_API_TOKEN` | E2E sandbox token + DB IDs |
| `PROD_FORMS_HEALTH_URL` | Timeweb `…/api/cron/forms-health` |
| `PROD_CRON_SECRET` | Timeweb production cron secret |

### Production health

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<timeweb-host>/api/cron/forms-health"
```

## Расписание

- Вручную: Actions → **forms-biweekly** → Run workflow
- Авто: 1 и 15 число, 06:00 UTC

## Критерии доверия

- 3 подряд полных biweekly без ручных правок
- UI success + Buildin verify (`E2E_VERIFY_BUILDIN=1`) или integration assertions
- Cleanup не оставляет E2E pages старше 24ч (`pnpm cleanup:e2e`)

## Замечания по стабильности

- Один worker Playwright, один retry только в CI
- Polling вместо sleep
- Синтетические email `test+…@rossel.invalid`
- Не логировать accessToken / PII в CI
