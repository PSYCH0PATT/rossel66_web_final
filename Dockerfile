# 1. Используем официальный Node.js образ
FROM node:20-alpine

# 2. Устанавливаем Python, Chromium и зависимости для парсеров
RUN apk add --no-cache \
    python3 \
    py3-pip \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 3. Настраиваем переменные окружения для Chromium
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    CHROMIUM_FLAGS="--disable-software-rasterizer --disable-dev-shm-usage --no-sandbox"

# 4. Устанавливаем рабочую директорию
WORKDIR /app

# 5. Копируем package.json и package-lock.json
COPY package*.json ./

# 6. Устанавливаем зависимости Node.js
# Используем --omit=dev чтобы не устанавливать devDependencies для уменьшения размера образа
# Используем --legacy-peer-deps если есть конфликты версий peerDependencies,
# либо разрешите их в package.json
RUN npm ci --omit=dev

# 7. Копируем остальные файлы проекта
COPY . .

# 8. Устанавливаем Python зависимости для парсеров
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

# 9. Собираем Next.js приложение
RUN npm run build

# 7. Указываем порт, который будет слушать приложение (Next.js по умолчанию 3000)
EXPOSE 3000

# 8. Запускаем приложение
# Используем "next start" напрямую, так как "npm start" может быть переопределен
CMD ["node_modules/.bin/next", "start"] 