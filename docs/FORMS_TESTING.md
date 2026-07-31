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

1. Проект `rossel-music`, ветка `staging`, Node **20**.
2. Отдельный Postgres (не production).
3. `pnpm setup:buildin-e2e` → `docs/FORMS_E2E_DATABASE_IDS.env` (sandbox уже создан: parent `536088a1-…`, submissions `b7fa63ed-…`).
4. На Vercel Preview/Production staging env: см. `docs/FORMS_STAGING.env.example`.
   Map `E2E_BUILDIN_DB_*` → `BUILDIN_DB_*` (без префикса `E2E_`).
5. Deployment Protection + Automation Bypass → GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`.
6. Секреты для biweekly: `E2E_BASE_URL`, `E2E_CRON_SECRET`, `E2E_BUILDIN_*`, `E2E_DATABASE_URL`, `PROD_FORMS_HEALTH_URL`, `PROD_CRON_SECRET`.

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
