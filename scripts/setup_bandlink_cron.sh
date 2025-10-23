#!/bin/bash
# Настройка автоматического расписания для Bandlink парсера
# Расписание:
# - Понедельник: 14:00 МСК
# - Пятница: 00:15 МСК, 18:00 МСК
# - Суббота: 00:15 МСК, 18:00 МСК
# - Воскресенье: 00:15 МСК, 18:00 МСК

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Настройка Bandlink Parser Cron${NC}"
echo -e "${GREEN}========================================${NC}"

# Получаем абсолютный путь к проекту
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PARSER_SCRIPT="$PROJECT_ROOT/parsers/scheduled_bandlink_parse.py"

echo -e "${YELLOW}📂 Проект:${NC} $PROJECT_ROOT"
echo -e "${YELLOW}🐍 Скрипт парсера:${NC} $PARSER_SCRIPT"

# Проверяем существование скрипта парсера
if [ ! -f "$PARSER_SCRIPT" ]; then
    echo -e "${RED}❌ Ошибка: Скрипт парсера не найден!${NC}"
    echo -e "${RED}   Путь: $PARSER_SCRIPT${NC}"
    exit 1
fi

# Делаем скрипт исполняемым
chmod +x "$PARSER_SCRIPT"
echo -e "${GREEN}✅ Скрипт сделан исполняемым${NC}"

# Создаем директорию для логов
LOGS_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOGS_DIR"
echo -e "${GREEN}✅ Директория логов создана:${NC} $LOGS_DIR"

# Формируем записи crontab
# МСК = UTC+3, поэтому вычитаем 3 часа для UTC

CRON_ENTRIES=$(cat <<EOF
# Bandlink Parser - Автоматический парсинг
# МСК -> UTC конвертация (МСК = UTC+3)

# Понедельник 14:00 МСК = 11:00 UTC
0 11 * * 1 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Пятница 00:15 МСК = Четверг 21:15 UTC
15 21 * * 4 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Пятница 18:00 МСК = 15:00 UTC
0 15 * * 5 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Суббота 00:15 МСК = Пятница 21:15 UTC
15 21 * * 5 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Суббота 18:00 МСК = 15:00 UTC
0 15 * * 6 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Воскресенье 00:15 МСК = Суббота 21:15 UTC
15 21 * * 6 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

# Воскресенье 18:00 МСК = 15:00 UTC
0 15 * * 0 cd $PROJECT_ROOT && /usr/bin/python3 $PARSER_SCRIPT >> $LOGS_DIR/cron_bandlink.log 2>&1

EOF
)

echo ""
echo -e "${YELLOW}📋 Записи crontab для добавления:${NC}"
echo "----------------------------------------"
echo "$CRON_ENTRIES"
echo "----------------------------------------"
echo ""

# Спрашиваем подтверждение
read -p "Добавить эти записи в crontab? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Установка отменена${NC}"
    exit 0
fi

# Получаем текущий crontab
TEMP_CRON=$(mktemp)
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Проверяем, есть ли уже записи Bandlink Parser
if grep -q "Bandlink Parser" "$TEMP_CRON"; then
    echo -e "${YELLOW}⚠️  Обнаружены существующие записи Bandlink Parser${NC}"
    read -p "Заменить их? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Удаляем старые записи Bandlink Parser
        sed -i.bak '/Bandlink Parser/,/^$/d' "$TEMP_CRON"
        echo -e "${GREEN}✅ Старые записи удалены${NC}"
    else
        echo -e "${YELLOW}⚠️  Установка отменена${NC}"
        rm "$TEMP_CRON"
        exit 0
    fi
fi

# Добавляем новые записи
echo "" >> "$TEMP_CRON"
echo "$CRON_ENTRIES" >> "$TEMP_CRON"

# Устанавливаем новый crontab
crontab "$TEMP_CRON"
rm "$TEMP_CRON"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Cron успешно настроен!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📅 Расписание парсинга:${NC}"
echo "  🕐 Понедельник: 14:00 МСК"
echo "  🕐 Пятница:     00:15 МСК, 18:00 МСК"
echo "  🕐 Суббота:     00:15 МСК, 18:00 МСК"
echo "  🕐 Воскресенье: 00:15 МСК, 18:00 МСК"
echo ""
echo -e "${YELLOW}📝 Логи:${NC}"
echo "  Cron логи:      $LOGS_DIR/cron_bandlink.log"
echo "  Парсер логи:    $LOGS_DIR/scheduled_bandlink.log"
echo ""
echo -e "${YELLOW}🔍 Проверка:${NC}"
echo "  Показать crontab: crontab -l"
echo "  Удалить crontab:  crontab -r"
echo "  Тестовый запуск:  python3 $PARSER_SCRIPT"
echo ""
echo -e "${YELLOW}💡 Важно:${NC}"
echo "  1. Убедитесь, что cookies актуальны"
echo "  2. Проверьте переменные окружения BRIGHT_DATA_RESIDENTIAL_USERNAME и BRIGHT_DATA_RESIDENTIAL_PASSWORD"
echo "  3. Запустите инициализацию БД: python3 $PROJECT_ROOT/parsers/init_cookies_db.py"
echo ""
echo -e "${GREEN}🎉 Готово!${NC}"



