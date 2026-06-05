#!/bin/sh
set -e

# Записываем CRON_SECRET в файл для скрипта cron-sftp.sh (системный cron не видит env контейнера)
if [ -n "$CRON_SECRET" ]; then
  echo "$CRON_SECRET" > /tmp/.cron_secret
  chmod 600 /tmp/.cron_secret
fi

# Запуск cron (читает /etc/crontabs/root)
crond -l 8

# Применяем миграции Supabase перед стартом (нужен direct/session :5432, не pooler :6543)
if [ -z "$DIRECT_URL" ] && [ -n "$DATABASE_URL" ]; then
  DIRECT_URL=$(node -e "
    const u = process.env.DATABASE_URL || '';
    try {
      const p = new URL(u);
      if (p.port === '6543') p.port = '5432';
      p.searchParams.delete('pgbouncer');
      console.log(p.toString());
    } catch {
      console.log(u.replace(':6543', ':5432'));
    }
  ")
  export DIRECT_URL
fi
if [ -n "$DATABASE_URL" ] || [ -n "$DIRECT_URL" ]; then
  echo "Running prisma migrate deploy..."
  pnpm db:migrate || exit 1
fi

# Запуск Next.js
node_modules/.bin/next start -H 0.0.0.0 -p 3000
