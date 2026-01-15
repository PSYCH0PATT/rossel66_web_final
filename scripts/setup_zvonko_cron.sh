#!/bin/bash

# Zvonko Parser Cron Setup Script
# Устанавливает cron задачу для автоматического парсинга релизов
# Расписание: 14:00 каждый день

# Конфигурация
CRON_SECRET="${CRON_SECRET:-zvonko-parser-secret-2024}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🔧 Настройка Zvonko Parser Cron..."
echo "   URL: $BASE_URL"
echo "   Расписание: 14:00 ежедневно"

# Получаем текущий путь к проекту
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Создаем временный файл для новых cron записей
TEMP_CRON=$(mktemp)

# Сохраняем существующие cron записи (без старых записей для Zvonko Parser)
crontab -l 2>/dev/null | grep -v "zvonko-parser" > "$TEMP_CRON" || true

# Добавляем новые записи для Zvonko Parser
echo "# Zvonko Music Releases Parser - 14:00" >> "$TEMP_CRON"
echo "0 14 * * * curl -s '${BASE_URL}/api/cron/zvonko?secret=${CRON_SECRET}' >> ${PROJECT_DIR}/logs/zvonko_cron.log 2>&1 # zvonko-parser" >> "$TEMP_CRON"

# Устанавливаем новый crontab
crontab "$TEMP_CRON"

# Удаляем временный файл
rm "$TEMP_CRON"

# Создаем директорию для логов если не существует
mkdir -p "${PROJECT_DIR}/logs"

echo "✅ Cron задачи установлены успешно!"
echo ""
echo "Текущие задачи Zvonko Parser:"
crontab -l | grep "zvonko-parser"
echo ""
echo "Для проверки логов используйте:"
echo "  tail -f ${PROJECT_DIR}/logs/zvonko_cron.log"
