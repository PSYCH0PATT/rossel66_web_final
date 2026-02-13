#!/bin/bash

# Настройка cron задач для аналитики rossel_flash.
#
# Задачи:
# 1. Ежедневно в 20:00 МСК — импорт данных из /rossel_flash по SFTP
# 2. 1 января в 00:00 МСК — годовая очистка (агрегация по месяцам)
#
# Примечание: Эти задачи уже интегрированы в lib/scheduler.ts (node-cron),
# так что этот скрипт нужен только если приложение не запущено постоянно
# и требуется внешний cron.
#
# Использование:
#   chmod +x scripts/setup-flash-analytics-cron.sh
#   ./scripts/setup-flash-analytics-cron.sh

set -euo pipefail

# Конфигурация
BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-x7Kp9mN2vQ8sL4wR}"

echo "═══════════════════════════════════════════════════"
echo "📊 Настройка cron задач для аналитики Flash"
echo "═══════════════════════════════════════════════════"
echo ""
echo "BASE_URL: $BASE_URL"
echo ""

# Генерируем строки для crontab
DAILY_JOB="0 17 * * * curl -s -H 'Authorization: Bearer $CRON_SECRET' '$BASE_URL/api/cron/analytics-flash' > /dev/null 2>&1"
YEARLY_JOB="0 21 1 1 * curl -s -H 'Authorization: Bearer $CRON_SECRET' '$BASE_URL/api/cron/analytics-cleanup' > /dev/null 2>&1"

# Примечание: 20:00 МСК = 17:00 UTC (UTC+3)
echo "Задачи для crontab:"
echo ""
echo "# Ежедневный импорт аналитики Flash (20:00 MSK = 17:00 UTC)"
echo "$DAILY_JOB"
echo ""
echo "# Годовая очистка аналитики (1 января 00:00 MSK = 21:00 UTC 31 дек)"
echo "$YEARLY_JOB"
echo ""

read -p "Добавить эти задачи в crontab? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Сохраняем текущий crontab
  CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
  
  # Проверяем, нет ли уже таких задач
  if echo "$CURRENT_CRONTAB" | grep -q "analytics-flash"; then
    echo "⚠️  Задача analytics-flash уже есть в crontab, пропускаю"
  else
    echo "$CURRENT_CRONTAB" | { cat; echo "$DAILY_JOB"; } | crontab -
    echo "✅ Добавлена ежедневная задача импорта"
  fi
  
  CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
  if echo "$CURRENT_CRONTAB" | grep -q "analytics-cleanup"; then
    echo "⚠️  Задача analytics-cleanup уже есть в crontab, пропускаю"
  else
    echo "$CURRENT_CRONTAB" | { cat; echo "$YEARLY_JOB"; } | crontab -
    echo "✅ Добавлена годовая задача очистки"
  fi
  
  echo ""
  echo "Текущий crontab:"
  crontab -l
else
  echo "Отменено. Вы можете добавить задачи вручную."
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Готово"
echo "═══════════════════════════════════════════════════"
