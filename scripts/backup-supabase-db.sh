#!/usr/bin/env bash
# Локальный бэкап базы Supabase (PostgreSQL) через pg_dump.
# Требуется: pg_dump в PATH (macOS: brew install libpq && echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc)

set -e
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
elif [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Ошибка: DATABASE_URL не задан. Добавьте в .env или .env.local"
  exit 1
fi

mkdir -p backups/db
FILE="backups/db/supabase_backup_$(date +%Y%m%d_%H%M%S).sql"

if ! command -v pg_dump &>/dev/null; then
  echo "Ошибка: pg_dump не найден. Установите клиент PostgreSQL:"
  echo "  macOS: brew install libpq   и добавьте в PATH: export PATH=\"\$(brew --prefix libpq)/bin:\$PATH\""
  exit 1
fi

echo "Бэкап в $FILE ..."
pg_dump "$DATABASE_URL" --no-owner --no-acl -F p -f "$FILE"
echo "Готово: $(wc -l < "$FILE") строк, $(du -h "$FILE" | cut -f1)"
