# 1. Используем официальный Node.js образ
FROM node:20-alpine

# 2. Устанавливаем рабочую директорию
WORKDIR /app

# 3. Копируем package.json и package-lock.json
COPY package*.json ./

# 4. Устанавливаем зависимости
# Используем --omit=dev чтобы не устанавливать devDependencies для уменьшения размера образа
# Используем --legacy-peer-deps если есть конфликты версий peerDependencies,
# либо разрешите их в package.json
RUN npm ci --omit=dev

# 5. Копируем остальные файлы проекта
COPY . .

# Указываем Node.js, где искать модули (для поддержки baseUrl из tsconfig.json)
ENV NODE_PATH=./

# 6. Собираем Next.js приложение
RUN npm run build

# 7. Указываем порт, который будет слушать приложение (Next.js по умолчанию 3000)
EXPOSE 3000

# 8. Запускаем приложение
# Используем "next start" напрямую, так как "npm start" может быть переопределен
CMD ["node_modules/.bin/next", "start"] 