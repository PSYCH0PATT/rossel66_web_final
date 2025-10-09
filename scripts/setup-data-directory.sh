#!/bin/bash

# Скрипт настройки папки данных на сервере для production
# Запускать на сервере после первого деплоя

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Настройка папки данных для production ===${NC}"
echo ""

# Получаем директорию проекта
if [ -z "$1" ]; then
    PROJECT_DIR="/var/www/financial-dashboard"
else
    PROJECT_DIR="$1"
fi

echo "Директория проекта: $PROJECT_DIR"

# Создаем папку данных вне проекта
DATA_DIR="/var/www/data"
echo -e "${YELLOW}Создаем папку данных: $DATA_DIR${NC}"
sudo mkdir -p "$DATA_DIR"

# Устанавливаем права доступа
echo -e "${YELLOW}Устанавливаем права доступа...${NC}"
sudo chown -R $USER:$USER "$DATA_DIR"
sudo chmod -R 755 "$DATA_DIR"

# Копируем существующие данные если они есть в проекте
if [ -d "$PROJECT_DIR/data" ]; then
    echo -e "${YELLOW}Копируем существующие данные...${NC}"
    cp -r "$PROJECT_DIR/data/"* "$DATA_DIR/" 2>/dev/null || true
fi

# Создаем базовую структуру если данных нет
echo -e "${YELLOW}Создаем структуру папок...${NC}"
mkdir -p "$DATA_DIR/artists"
mkdir -p "$DATA_DIR/reports"
mkdir -p "$DATA_DIR/unregistered-reports"

# Создаем пустые JSON файлы если их нет
if [ ! -f "$DATA_DIR/users.json" ]; then
    echo '[{"id":"2","username":"admin","password":"admin123","role":"admin","name":"Администратор","email":"admin@rossel66.com","createdAt":"2025-09-26T23:03:45.281Z","updatedAt":"2025-09-26T23:03:45.281Z"}]' > "$DATA_DIR/users.json"
    echo -e "${GREEN}✓ Создан users.json с дефолтным админом (admin/admin123)${NC}"
fi

if [ ! -f "$DATA_DIR/releases.json" ]; then
    echo '[]' > "$DATA_DIR/releases.json"
    echo -e "${GREEN}✓ Создан releases.json${NC}"
fi

if [ ! -f "$DATA_DIR/reports.json" ]; then
    echo '[]' > "$DATA_DIR/reports.json"
    echo -e "${GREEN}✓ Создан reports.json${NC}"
fi

if [ ! -f "$DATA_DIR/activities.json" ]; then
    echo '[]' > "$DATA_DIR/activities.json"
    echo -e "${GREEN}✓ Создан activities.json${NC}"
fi

if [ ! -f "$DATA_DIR/backups.json" ]; then
    echo '[]' > "$DATA_DIR/backups.json"
    echo -e "${GREEN}✓ Создан backups.json${NC}"
fi

if [ ! -f "$DATA_DIR/balances.json" ]; then
    echo '[]' > "$DATA_DIR/balances.json"
    echo -e "${GREEN}✓ Создан balances.json${NC}"
fi

# Удаляем старую папку data из проекта если она есть
if [ -d "$PROJECT_DIR/data" ]; then
    echo -e "${YELLOW}Удаляем старую папку data из проекта...${NC}"
    rm -rf "$PROJECT_DIR/data"
fi

# Создаем символическую ссылку
echo -e "${YELLOW}Создаем символическую ссылку...${NC}"
ln -sf "$DATA_DIR" "$PROJECT_DIR/data"

echo ""
echo -e "${GREEN}=== Готово! ===${NC}"
echo ""
echo -e "Данные хранятся в: ${GREEN}$DATA_DIR${NC}"
echo -e "Символическая ссылка: ${GREEN}$PROJECT_DIR/data -> $DATA_DIR${NC}"
echo ""
echo -e "${YELLOW}Теперь:${NC}"
echo "1. Данные НЕ будут затираться при деплое"
echo "2. Можно делать git pull без потери данных"
echo "3. Бэкапы сохраняются в /var/www/backups/"
echo ""
echo -e "${YELLOW}Дефолтный доступ:${NC}"
echo "  Логин: admin"
echo "  Пароль: admin123"
echo ""
echo -e "${RED}⚠️  ВАЖНО: Смените пароль админа после первого входа!${NC}"

