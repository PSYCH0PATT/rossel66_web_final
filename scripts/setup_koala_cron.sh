#!/bin/bash

# Koala Parser Cron Setup Script
# Устанавливает cron задачу для автоматического парсинга релизов
# Расписание: 12:00 и 20:00 каждый день

# Конфигурация
CRON_SECRET="${CRON_SECRET:-koala-parser-secret-2024}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🔧 Настройка Koala Parser Cron..."
echo "   URL: $BASE_URL"
echo "   Расписание: 12:00 и 20:00 ежедневно"

# Получаем текущий путь к проекту
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Создаем временный файл для новых cron записей
TEMP_CRON=$(mktemp)

# Сохраняем существующие cron записи (без старых записей для Koala Parser)
crontab -l 2>/dev/null | grep -v "koala-parser" > "$TEMP_CRON" || true

# Добавляем новые записи для Koala Parser
echo "# Koala Music Releases Parser - 12:00" >> "$TEMP_CRON"
echo "0 12 * * * curl -s '${BASE_URL}/api/cron/koala?secret=${CRON_SECRET}' >> ${PROJECT_DIR}/logs/koala_cron.log 2>&1 # koala-parser" >> "$TEMP_CRON"

echo "# Koala Music Releases Parser - 20:00" >> "$TEMP_CRON"
echo "0 20 * * * curl -s '${BASE_URL}/api/cron/koala?secret=${CRON_SECRET}' >> ${PROJECT_DIR}/logs/koala_cron.log 2>&1 # koala-parser" >> "$TEMP_CRON"

# Устанавливаем новый crontab
crontab "$TEMP_CRON"

# Удаляем временный файл
rm "$TEMP_CRON"

# Создаем директорию для логов если не существует
mkdir -p "${PROJECT_DIR}/logs"

echo "✅ Cron задачи установлены успешно!"
echo ""
echo "Текущие задачи Koala Parser:"
crontab -l | grep "koala-parser"
echo ""
echo "Для проверки логов используйте:"
echo "  tail -f ${PROJECT_DIR}/logs/koala_cron.log"


