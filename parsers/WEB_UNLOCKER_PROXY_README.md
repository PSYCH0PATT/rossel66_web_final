# Bandlink Parser с Bright Data Web Unlocker (PROXY режим)

## 🎯 Описание

Парсер BandLink, использующий **Bright Data Web Unlocker через PROXY** для автоматического обхода капчи и блокировок.

**ВАЖНО:** Web Unlocker работает как **прокси-сервер**, а не как REST API!

## 🔧 Установка

```bash
pip install requests beautifulsoup4 urllib3
```

## ⚙️ Настройка конфигурации

Создайте файл `bandlink_config_unlocker.json`:

```json
{
  "target_artists": [
    "Sour Diesel",
    "Wide Pie",
    "PLVT"
  ],
  "bright_data_proxy_username": "brd-customer-hl_94d02fd9-zone-web_unlocker1",
  "bright_data_proxy_password": "bp8k2m4ji1za"
}
```

### 📋 Параметры конфига:

- **target_artists** - список артистов для парсинга
- **bright_data_proxy_username** - username для proxy (формат: `brd-customer-{customer_id}-zone-{zone_name}`)
- **bright_data_proxy_password** - password для proxy

### 🔑 Получение учетных данных Bright Data

1. Зайдите на [ru-brightdata.com](https://ru-brightdata.com)
2. Перейдите в раздел **Web Unlocker**
3. Найдите раздел **"Прямой доступ к API"**
4. Скопируйте:
   - **Имя пользователя** (Username) - например: `brd-customer-hl_94d02fd9-zone-web_unlocker1`
   - **Пароль** (Password) - например: `bp8k2m4ji1za`

## 🚀 Запуск

```bash
cd /Users/macbook/proga/rossel-music
python3 parsers/bandlink_parser_unlocker_linux.py parsers/bandlink_config_unlocker.json
```

## 📊 Как это работает

### 1. **Proxy подключение**
```
Хост: brd.superproxy.io
Порт: 33335
```

### 2. **Формат proxy URL**
```
http://{username}-country-{country}:{password}@brd.superproxy.io:33335
```

Пример:
```
http://brd-customer-hl_94d02fd9-zone-web_unlocker1-country-us:bp8k2m4ji1za@brd.superproxy.io:33335
```

### 3. **Параметры геотаргетинга**
- `country=us` - запросы идут через США (обход блокировки .ru)
- Можно использовать другие страны: `ru`, `de`, `uk`, и т.д.

### 4. **Автоматический обход капчи**
Bright Data Web Unlocker автоматически:
- ✅ Решает Yandex SmartCaptcha
- ✅ Обходит блокировки по IP
- ✅ Эмулирует реальное поведение пользователя
- ✅ Управляет fingerprinting и headers

## 📁 База данных

Результаты сохраняются в SQLite базу: `bandlink_playlists_unlocker.db`

### Структура таблицы:
```sql
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY,
    artist_name TEXT,
    playlist_url TEXT,
    playlist_name TEXT,
    track_count INTEGER,
    parsed_at TIMESTAMP
)
```

## 🔍 Логирование

Парсер выводит подробные логи:
- 📤 Запросы к proxy
- 📊 Статусы ответов
- ✅ Успешно полученные страницы
- ❌ Ошибки и их причины
- 🔍 Информация о Bright Data Zone

## ⚠️ Важные отличия от REST API версии

### ❌ **Неправильно (старая версия):**
```python
# REST API подход (НЕ РАБОТАЕТ!)
response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {api_key}"},
    json={"url": url}
)
```

### ✅ **Правильно (новая версия):**
```python
# PROXY подход (РАБОТАЕТ!)
proxies = {
    'http': f'http://{username}:{password}@brd.superproxy.io:33335',
    'https': f'http://{username}:{password}@brd.superproxy.io:33335'
}
response = requests.get(url, proxies=proxies, verify=False)
```

## 💰 Стоимость

- **$1.50/CPM** (Cost Per Mille - за 1000 успешных запросов)
- Оплата **только за успешные запросы**
- Неуспешные запросы не тарифицируются

## 🐛 Отладка

### Проверка подключения к proxy:

```bash
curl -i --proxy brd.superproxy.io:33335 \
  --proxy-user brd-customer-hl_94d02fd9-zone-web_unlocker1:bp8k2m4ji1za \
  -k "https://geo.brdtest.com/welcome.txt?product=unlocker&method=native"
```

### Проверка запросов на панели Bright Data:

1. Зайдите на [ru-brightdata.com](https://ru-brightdata.com)
2. Перейдите в **Web Unlocker** → **Обзор использования**
3. Вы должны увидеть запросы в реальном времени

## 📝 Примечания

- SSL сертификаты проверяются с `verify=False` (как `-k` в curl)
- Используется User-Agent современного браузера
- Таймаут запроса: 120 секунд (для решения капчи)
- Максимум 50 запросов за сессию (защита от бесконечных циклов)

## 🔗 Полезные ссылки

- [Документация Web Unlocker](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction)
- [Панель управления Bright Data](https://ru-brightdata.com)
- [Примеры использования](https://docs.brightdata.com/scraping-automation/web-unlocker/quick-start)

## 🆘 Поддержка

При возникновении проблем проверьте:
1. ✅ Правильность username и password
2. ✅ Наличие средств на балансе Bright Data
3. ✅ Активность зоны web_unlocker1
4. ✅ Логи парсера на наличие ошибок proxy

