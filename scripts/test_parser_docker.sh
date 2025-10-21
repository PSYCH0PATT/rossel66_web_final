#!/bin/bash
# Скрипт для быстрого тестирования Linux парсера в Docker

set -e

echo "🐳 Тестирование Bandlink Parser в Docker Linux"
echo "=============================================="

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен!${NC}"
    echo "Установите Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✅ Docker найден${NC}"

# Переход в корень проекта
cd "$(dirname "$0")/.."

# Проверка конфига
if [ ! -f "temp_bandlink_config.json" ]; then
    echo -e "${RED}❌ Файл temp_bandlink_config.json не найден!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Конфиг найден${NC}"

# Выбор действия
echo ""
echo "Выберите действие:"
echo "1) Собрать образ"
echo "2) Запустить парсер"
echo "3) Пересобрать и запустить"
echo "4) Открыть shell в контейнере"
echo "5) Посмотреть логи"
echo "6) Остановить контейнеры"
read -p "Введите номер (1-6): " choice

case $choice in
    1)
        echo -e "${YELLOW}🔨 Сборка образа...${NC}"
        docker build -f Dockerfile.parser -t bandlink-parser .
        echo -e "${GREEN}✅ Образ собран!${NC}"
        ;;
    2)
        echo -e "${YELLOW}🚀 Запуск парсера...${NC}"
        docker-compose -f docker-compose.parser.yml up
        ;;
    3)
        echo -e "${YELLOW}🔨 Пересборка и запуск...${NC}"
        docker-compose -f docker-compose.parser.yml up --build
        ;;
    4)
        echo -e "${YELLOW}🐚 Открытие shell...${NC}"
        docker-compose -f docker-compose.parser.yml run --rm bandlink-parser /bin/bash
        ;;
    5)
        echo -e "${YELLOW}📋 Просмотр логов...${NC}"
        docker-compose -f docker-compose.parser.yml logs -f
        ;;
    6)
        echo -e "${YELLOW}🛑 Остановка контейнеров...${NC}"
        docker-compose -f docker-compose.parser.yml down
        echo -e "${GREEN}✅ Остановлено${NC}"
        ;;
    *)
        echo -e "${RED}❌ Неверный выбор${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Готово!${NC}"

