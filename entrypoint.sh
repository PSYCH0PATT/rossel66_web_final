#!/bin/sh
set -e

# Запуск cron (читает /etc/crontabs/root)
crond -l 8

# Запуск Next.js
node_modules/.bin/next start -H 0.0.0.0 -p 3000
