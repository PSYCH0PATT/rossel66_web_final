# ROSSEL Music

Next.js 14 (App Router) + Prisma 7 (Postgres/Supabase) — личный кабинет лейбла (артисты, релизы, отчёты, выплаты, плейлисты, аналитика).

## Локальная разработка

```bash
pnpm install
pnpm dev
```

Открыть [http://localhost:3000](http://localhost:3000).

Переменные окружения — см. `.env.example` и `ENV_SETUP.md`. Локально используйте `.env.local`.

## Деплой

Приложение собирается и работает в **Docker-контейнере на Timeweb** (не Vercel):

- Сборка образа — `Dockerfile` (Node 20 alpine + Python/Chromium для парсеров).
- Запуск — `entrypoint.sh`: применяет миграции (`prisma migrate deploy`), стартует системный `crond` и `next start` на порту 3000.
- Плановые задачи — `crontab` (koala/zvonko парсеры, SFTP-синк плейлистов), вызывают внутренние эндпоинты с `Authorization: Bearer $CRON_SECRET`.

## Полезное

- Тесты: `pnpm test`
- Buildin migration: `docs/BUILDIN_MIGRATION.md` (`pnpm setup:buildin`, `pnpm reconcile:buildin`)
- Спецификации: `pnpm spec:list` (OpenSpec)
- Бэкап БД: `pnpm db:backup`
