#!/bin/sh
# Запуск SFTP синхронизации плейлистов по крону.
# CRON_SECRET записывается в /tmp/.cron_secret при старте контейнера (entrypoint.sh).
secret=""
[ -f /tmp/.cron_secret ] && secret=$(cat /tmp/.cron_secret)
[ -z "$secret" ] && exit 0
curl -s -X GET "http://127.0.0.1:3000/api/cron/playlists-sftp?secret=$secret"
