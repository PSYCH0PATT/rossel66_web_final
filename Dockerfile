# 1. Используем официальный Node.js образ
FROM node:20-alpine

# 2. Устанавливаем Python, Chromium и зависимости для парсеров и обработки отчетов
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    py3-pip \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dcron \
    curl

# 3. Настраиваем переменные окружения для Chromium
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    CHROMIUM_FLAGS="--disable-software-rasterizer --disable-dev-shm-usage --no-sandbox"

# 4. Устанавливаем рабочую директорию
WORKDIR /app

# 5. pnpm через corepack (версия из package.json → packageManager)
RUN corepack enable

# 6. Кэш слоя: только манифест и lock
COPY package.json pnpm-lock.yaml ./

# 7. Строгая установка (dev + prod — dev нужен для next build / TypeScript)
RUN pnpm install --frozen-lockfile

# 8. Копируем остальные файлы проекта
COPY . .
RUN chmod +x /app/scripts/cron-sftp.sh

# 9. Устанавливаем Python зависимости для парсеров
# ВАЖНО: blinker<1.8 нужен для совместимости с selenium-wire
RUN pip3 install --break-system-packages \
    selenium \
    beautifulsoup4 \
    requests \
    webdriver-manager \
    2captcha-python \
    'blinker<1.8' \
    selenium-wire

# Указываем Node.js, где искать модули (для поддержки baseUrl из tsconfig.json)
ENV NODE_PATH=./

# 10. Собираем Next.js приложение (prisma generate + next build)
RUN pnpm build

# 11. Убираем devDependencies из образа рантайма
RUN pnpm prune --prod

# 12. Директория логов и cron
RUN mkdir -p /app/logs
COPY crontab /etc/crontabs/root
COPY entrypoint.sh ./

# 13. Порт Next.js по умолчанию
EXPOSE 3000

# 14. Запуск через entrypoint
CMD ["./entrypoint.sh"]
