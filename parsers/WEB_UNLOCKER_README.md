# Bandlink Parser с Bright Data Web Unlocker API

## 🎯 Описание

Финальная версия парсера Bandlink для Linux, использующая **Bright Data Web Unlocker API** для автоматического решения Yandex SmartCaptcha.

## ✅ Преимущества Web Unlocker API

- ✅ **Автоматическое решение Yandex SmartCaptcha** (официально поддерживается)
- ✅ **Без браузерной автоматизации** - работает через HTTP API
- ✅ **Обход геоблокировок** .ru доменов (через USA IP)
- ✅ **Простая интеграция** - один HTTP запрос = готовый HTML
- ✅ **Безопасность** - встроенные лимиты и защита от перерасхода

## 📋 Что делает парсер

1. **Получает список артистов** из конфига
2. **Формирует URL поиска** на band.link
3. **Отправляет запрос** к Web Unlocker API
4. **Web Unlocker API автоматически:**
   - Решает Yandex SmartCaptcha (если появляется)
   - Обходит блокировки
   - Возвращает чистый HTML
5. **Парсит плейлисты** из HTML (BeautifulSoup)
6. **Сохраняет результаты** в SQLite БД

## 🔑 Настройка переменных окружения

### На локальной машине

Создайте/обновите `.env.local`:

```bash
BRIGHT_DATA_API_KEY=your_bright_data_api_key_here
```

### На сервере (Timeweb/GitHub Actions)

Добавьте переменную окружения в настройках:

1. **Timeweb:** Панель управления → Переменные окружения
2. **GitHub:** Settings → Secrets and variables → Actions → New repository secret

```
Name: BRIGHT_DATA_API_KEY
Value: <secret from Bright Data dashboard>
```

## 📦 Зависимости

```bash
pip install requests beautifulsoup4
```

Или используйте `requirements.txt`:

```bash
pip install -r parsers/requirements_unlocker.txt
```

## 🚀 Запуск

### Локально (тест)

```bash
python3 parsers/bandlink_parser_unlocker_linux.py config.json
```

### Через API endpoint

Парсер запускается автоматически при отправке POST запроса на:

```
POST /api/parsers/bandlink
{
  "artists": ["Sour Diesel", "Artist Name"]
}
```

## 📊 База данных

Результаты сохраняются в `bandlink_playlists_unlocker.db`:

```sql
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_name TEXT NOT NULL,
    playlist_url TEXT NOT NULL,
    playlist_name TEXT,
    track_count INTEGER,
    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist_name, playlist_url)
)
```

## 🛡️ Безопасность

### Встроенная защита

- ✅ **Лимит запросов:** максимум 50 запросов за цикл
- ✅ **Таймауты:** 120 секунд на запрос
- ✅ **Паузы:** 3 секунды между артистами
- ✅ **Логирование:** полное логирование всех операций

### Мониторинг расходов

Проверяйте статистику в панели Bright Data:
https://brightdata.com/cp/zones

## 🧪 Тестирование

### Тест Web Unlocker API

```bash
python3 parsers/test_unlocker_api.py
```

Этот скрипт протестирует:
1. ✅ Решение Yandex SmartCaptcha на demo странице
2. ✅ Поиск артистов на band.link

## 📝 Пример конфига

```json
{
  "target_artists": [
    "Sour Diesel",
    "Artist Name 2"
  ],
  "bright_data_api_key": "YOUR_API_KEY_HERE"
}
```

## 🔧 Отладка

### Логи на Linux сервере

Проверьте логи Next.js приложения:

```bash
pm2 logs
# или
docker logs <container_id>
```

### Проверка API ключа

```bash
echo $BRIGHT_DATA_API_KEY
```

### Проверка работы Web Unlocker API

```bash
curl -X POST https://api.brightdata.com/request \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://captcha-api.yandex.ru/demo",
    "zone": "web_unlocker1",
    "format": "raw",
    "country": "us"
  }'
```

## ❓ FAQ

### Q: Почему Web Unlocker API, а не Browser API?

**A:** Browser API **не поддерживает** автоматическое решение Yandex SmartCaptcha. Web Unlocker API официально поддерживает Yandex капчу.

### Q: Работает ли с .ru доменами?

**A:** Да! Используем `"country": "us"` для обхода блокировки российских IP.

### Q: Сколько стоит?

**A:** ~$1.50 за 1000 запросов (CPM). Капчи решаются автоматически в рамках этой стоимости.

### Q: Что если капча не решится?

**A:** Web Unlocker API автоматически повторяет попытки. Встроенный таймаут 120 секунд.

## 📚 Документация Bright Data

- [Web Unlocker API](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction)
- [Yandex Captcha Solver](https://brightdata.com/products/web-unlocker/captcha-solver/yandex-captcha)
- [API Reference](https://docs.brightdata.com/api-reference/web-unlocker/post-request)

## 🎉 Готово!

Теперь парсер автоматически решает Yandex SmartCaptcha на band.link без дополнительной настройки!

