# Бэкапы базы Supabase

## Локальная точка восстановления (без pg_dump)

Из корня проекта:

```bash
npm run db:backup
```

Создаётся файл `backups/db/backup_YYYYMMDD_HHMMSS.json` со всеми данными (User, Release, Report, Activity, Playlist, StreamAnalytics). Требуется только `DATABASE_URL` в `.env` или `.env.local`.

Полный SQL-дамп (нужен установленный `pg_dump`):

```bash
npm run db:backup:pg
```

## Бэкап в самом Supabase

1. Открой [Dashboard](https://supabase.com/dashboard) → свой проект → **Database** → **Backups**.
2. **Scheduled backups** — на планах Pro/Team/Enterprise ежедневные бэкапы (7–30 дней), из списка можно восстановить проект на выбранную дату.
3. **Point in time** — если включён PITR (платный аддон), можно восстановиться на момент с точностью до минут.

На Free-плане автоматических бэкапов в дашборде может не быть — используй `npm run db:backup` как точку восстановления.
