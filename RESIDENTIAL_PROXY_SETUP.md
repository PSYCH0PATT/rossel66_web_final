# 🚀 Настройка Residential Proxy Parser для Bandlink

## 📋 Обзор

Этот парсер использует **Bright Data Residential Proxy** для максимально стабильного парсинга BandLink с минимизацией капчи.

### ✨ Ключевые особенности:

- 🏠 **Residential IP** - реальные домашние адреса (как у обычных пользователей)
- 🤖 **Очеловечивание** - случайные задержки 3-8 сек, ротация User-Agent
- 🍪 **Управление cookies** - через админ-панель
- 🔄 **Автоматическая ротация IP** при обнаружении капчи
- 📊 **Детальное логирование** каждого шага
- ⏰ **Автоматическое расписание** через cron
- 💾 **SQLite база данных** для cookies и статуса

---

## 🛠️ Установка

### 1. Инициализация базы данных

Первым делом нужно создать таблицы для cookies и статуса парсера:

```bash
cd /Users/macbook/proga/rossel-music
python3 parsers/init_cookies_db.py
```

**Вывод:**
```
📦 Инициализация БД: .../bandlink_playlists.db
📝 Создание таблицы bandlink_cookies...
📝 Создание таблицы parser_status...
📝 Создание таблицы bandlink_playlists...
✅ База данных успешно инициализирована!
```

### 2. Настройка переменных окружения (опционально)

Создайте файл `.env.local` в корне проекта:

```bash
BRIGHT_DATA_RESIDENTIAL_USERNAME=brd-customer-hl_94d02fd9-zone-residential_proxy1
BRIGHT_DATA_RESIDENTIAL_PASSWORD=juze73q9d91q
```

Если не настроить, будут использованы значения по умолчанию из кода.

### 3. Обновление cookies

#### Через админ-панель (рекомендуется):

1. Откройте админ-панель: http://localhost:3000/dashboard/admin/playlists
2. Перейдите на вкладку "Парсинг"
3. В 4-й колонке "Cookies Bandlink" вставьте curl команду с cookies
4. Нажмите "Обновить Cookies"

#### Вручную через API:

```bash
curl -X POST http://localhost:3000/api/bandlink/cookies \
  -H "Content-Type: application/json" \
  -d '{
    "curlCommand": "curl \"https://band.link/scanner?search=sour+diesel\" -H \"Cookie: _yasc=...; _ym_isad=1; ...\""
  }'
```

---

## 🚀 Использование

### Ручной запуск парсера

#### Через админ-панель:

1. Откройте http://localhost:3000/dashboard/admin/playlists
2. Выберите артистов
3. Нажмите "Парсить Bandlink"

#### Через консоль:

```bash
cd /Users/macbook/proga/rossel-music

# Создать конфиг
cat > temp_config.json << EOF
{
  "target_artists": ["Sour Diesel", "Wide Pie"],
  "bright_data_proxy_username": "brd-customer-hl_94d02fd9-zone-residential_proxy1",
  "bright_data_proxy_password": "juze73q9d91q",
  "proxy_host": "brd.superproxy.io",
  "proxy_port": 33335
}
EOF

# Запустить парсер
python3 parsers/bandlink_parser_residential_linux.py temp_config.json
```

### Автоматический запуск по расписанию

#### Настройка cron:

```bash
cd /Users/macbook/proga/rossel-music
./scripts/setup_bandlink_cron.sh
```

**Расписание:**
- 🕐 Понедельник: 14:00 МСК
- 🕐 Пятница: 00:15 МСК, 18:00 МСК
- 🕐 Суббота: 00:15 МСК, 18:00 МСК
- 🕐 Воскресенье: 00:15 МСК, 18:00 МСК

#### Проверка cron:

```bash
# Показать установленные задачи
crontab -l

# Просмотр логов
tail -f logs/cron_bandlink.log
tail -f logs/scheduled_bandlink.log
```

---

## 🔧 Обработка капчи

### Автоматическая стратегия:

1. **Обнаружение капчи** - проверка наличия "captcha" в HTML
2. **Логирование** - сохранение timestamp и URL
3. **Смена IP** - добавление `-session-{uuid}` к proxy username
4. **Задержка** - ожидание 2-3 минуты (случайное)
5. **Повтор** - новая попытка с новым IP

### Лимиты:

- **Максимум 5 попыток** с разными IP
- **После 5 неудач:**
  - Статус `needs_new_cookies = 1` в БД
  - Уведомление в админ-панели: "⚠️ Требуются новые cookies!"
  - Парсинг останавливается

### При получении уведомления:

1. Зайдите на https://band.link в браузере
2. Скопируйте curl команду с актуальными cookies
3. Обновите cookies через админ-панель
4. Запустите парсинг заново

---

## 📊 Мониторинг

### Проверка статуса БД:

```bash
python3 parsers/init_cookies_db.py --status
```

**Вывод:**
```
📊 Статус базы данных:
  🍪 Cookies: 12
  🎵 Плейлисты: 156
  📈 Статус парсера: completed
  ⏰ Последний запуск: 2025-10-16 14:23:45
  ⚠️  Нужны новые cookies: Нет
  ❌ Неудачных попыток: 0
```

### API эндпоинты:

#### Получить cookies:
```bash
curl http://localhost:3000/api/bandlink/cookies
```

#### Проверить уведомления:
```bash
curl http://localhost:3000/api/notifications
```

---

## 🐛 Отладка

### Просмотр логов парсера:

```bash
# Последние строки
tail -50 logs/scheduled_bandlink.log

# В реальном времени
tail -f logs/scheduled_bandlink.log
```

### Тестовый запуск с одним артистом:

```bash
cd /Users/macbook/proga/rossel-music

cat > test_config.json << EOF
{
  "target_artists": ["Sour Diesel"],
  "bright_data_proxy_username": "brd-customer-hl_94d02fd9-zone-residential_proxy1-debug-full",
  "bright_data_proxy_password": "juze73q9d91q",
  "proxy_host": "brd.superproxy.io",
  "proxy_port": 33335
}
EOF

python3 parsers/bandlink_parser_residential_linux.py test_config.json
```

**Примечание:** Добавление `-debug-full` к username включает debug-логи от Bright Data в заголовке `x-brd-debug`.

### Проверка Bright Data credentials:

```bash
curl -i \
  --proxy brd.superproxy.io:33335 \
  --proxy-user brd-customer-hl_94d02fd9-zone-residential_proxy1:juze73q9d91q \
  -k "https://geo.brdtest.com/welcome.txt?product=resi&method=native"
```

---

## 💰 Стоимость

### Ваш случай (5 раз в неделю):

- **Потребление:** ~0.2 GB/месяц
- **Стоимость Bright Data:** $8/GB
- **Реальные расходы:** $1.6/месяц (0.2 × $8)

### Оптимизация расходов:

1. **Парсите только новые релизы** - используйте фильтр "Недавние"
2. **Batch парсинг** - группируйте артистов
3. **Кэширование** - результаты сохраняются в БД

---

## 📁 Структура файлов

```
parsers/
  ├── bandlink_parser_residential_linux.py  # Основной парсер
  ├── init_cookies_db.py                   # Инициализация БД
  └── scheduled_bandlink_parse.py          # Автоматический запуск

app/api/
  ├── bandlink/cookies/route.ts            # API управления cookies
  ├── notifications/route.ts               # API уведомлений
  └── parsers/bandlink/route.ts           # API запуска парсера

scripts/
  └── setup_bandlink_cron.sh               # Настройка расписания

logs/
  ├── cron_bandlink.log                    # Логи cron
  └── scheduled_bandlink.log               # Логи парсера
```

---

## ❓ FAQ

### Q: Как часто нужно обновлять cookies?
**A:** Обычно 1-2 раза в неделю. Система сама уведомит когда потребуется.

### Q: Что делать если капча появляется часто?
**A:** 
1. Обновите cookies
2. Увеличьте задержки между запросами (в коде `human_delay(5, 12)`)
3. Проверьте что используется именно Residential proxy

### Q: Можно ли использовать другие прокси?
**A:** Да, измените `proxy_host`, `proxy_port`, `proxy_username`, `proxy_password` в конфиге.

### Q: Как добавить новых артистов?
**A:** Добавьте их в `data/users.json` с `role: "artist"`.

---

## 🎉 Готово!

Теперь ваш парсер:
- ✅ Работает автоматически по расписанию
- ✅ Минимизирует появление капчи
- ✅ Уведомляет о проблемах
- ✅ Легко управляется через админ-панель

**Приятного использования! 🚀**

