#!/bin/sh
set -e

# Записываем CRON_SECRET в файл для скрипта cron-sftp.sh (системный cron не видит env контейнера)
if [ -n "$CRON_SECRET" ]; then
  echo "$CRON_SECRET" > /tmp/.cron_secret
  chmod 600 /tmp/.cron_secret
fi

# Запуск cron (читает /etc/crontabs/root)
crond -l 8

# Запуск Next.js
node_modules/.bin/next start -H 0.0.0.0 -p 3000
