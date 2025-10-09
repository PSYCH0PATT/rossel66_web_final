#!/bin/bash

# Setup automatic backup cron job
# This script sets up a cron job that runs every 3 days at 3:00 AM

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Настройка автоматического резервного копирования ===${NC}"
echo ""

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Project directory: $PROJECT_DIR"
echo ""

# Ask for domain or use localhost
read -p "Введите домен вашего сайта (например: example.com) или нажмите Enter для localhost: " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost:3000"
fi

# Ask for CRON_SECRET or generate one
read -p "Введите CRON_SECRET (или нажмите Enter для автогенерации): " CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
    CRON_SECRET=$(openssl rand -hex 32)
    echo -e "${YELLOW}Сгенерирован CRON_SECRET: ${CRON_SECRET}${NC}"
fi

# Add CRON_SECRET to .env.local if it doesn't exist
if [ -f "$PROJECT_DIR/.env.local" ]; then
    if grep -q "CRON_SECRET=" "$PROJECT_DIR/.env.local"; then
        echo "CRON_SECRET уже существует в .env.local"
    else
        echo "" >> "$PROJECT_DIR/.env.local"
        echo "CRON_SECRET=$CRON_SECRET" >> "$PROJECT_DIR/.env.local"
        echo -e "${GREEN}CRON_SECRET добавлен в .env.local${NC}"
    fi
else
    echo "CRON_SECRET=$CRON_SECRET" > "$PROJECT_DIR/.env.local"
    echo -e "${GREEN}Создан .env.local с CRON_SECRET${NC}"
fi

# Create cron job command
CRON_COMMAND="0 3 */3 * * curl -H 'Authorization: Bearer $CRON_SECRET' https://$DOMAIN/api/cron/backup >> $PROJECT_DIR/logs/backup-cron.log 2>&1"

echo ""
echo -e "${GREEN}=== Команда для cron ===${NC}"
echo "$CRON_COMMAND"
echo ""
echo -e "${YELLOW}Для добавления в crontab выполните:${NC}"
echo "1. Откройте crontab: crontab -e"
echo "2. Добавьте эту строку:"
echo "   $CRON_COMMAND"
echo ""
echo -e "${YELLOW}Или выполните автоматическую установку (требуется sudo):${NC}"
read -p "Добавить cron job автоматически? (y/n): " AUTO_INSTALL

if [ "$AUTO_INSTALL" = "y" ] || [ "$AUTO_INSTALL" = "Y" ]; then
    # Create logs directory
    mkdir -p "$PROJECT_DIR/logs"
    
    # Add cron job
    (crontab -l 2>/dev/null | grep -v "api/cron/backup"; echo "$CRON_COMMAND") | crontab -
    echo -e "${GREEN}✓ Cron job добавлен!${NC}"
    echo ""
    echo "Проверить: crontab -l"
    echo "Логи: $PROJECT_DIR/logs/backup-cron.log"
else
    echo -e "${YELLOW}Добавьте cron job вручную используя команду выше${NC}"
fi

echo ""
echo -e "${GREEN}=== Готово! ===${NC}"
echo "Автоматическое резервное копирование будет выполняться каждые 3 дня в 3:00"

