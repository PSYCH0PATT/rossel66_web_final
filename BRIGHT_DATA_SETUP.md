# Настройка Bright Data Web Unlocker для Bandlink Parser

## 📋 Требования

1. **Аккаунт Bright Data** с активной зоной `web_unlocker1`
2. **API ключ** из панели Bright Data
3. **Python 3.8+** на сервере Linux

## 🔧 Настройка переменных окружения

### Локально (для разработки):

Создайте или обновите файл `.env.local`:

```bash
BRIGHT_DATA_API_KEY=4d65b7184094d3f99a670ab198fe0e8ce2116d52c66b05887aafe6fecb075a70
```

### На сервере Timeweb (через GitHub):

1. Перейдите в **Settings** → **Secrets and variables** → **Actions**
2. Добавьте новый секрет:
   - Name: `BRIGHT_DATA_API_KEY`
   - Value: `4d65b7184094d3f99a670ab198fe0e8ce2116d52c66b05887aafe6fecb075a70`

3. Обновите `.github/workflows/deploy.yml` (добавьте в `env`):
```yaml
env:
  BRIGHT_DATA_API_KEY: ${{ secrets.BRIGHT_DATA_API_KEY }}
```

## 🚀 Как работает

### Bright Data Web Unlocker API:

- ✅ **Автоматически решает капчи** (включая Yandex SmartCaptcha)
- ✅ **Обходит блокировки** band.link
- ✅ **Возвращает готовый HTML** после решения капчи
- ✅ **Не требует браузера** - работает через HTTP API
- ✅ **Следует редиректам** автоматически

### Стоимость:

- **$1.50 за 1000 запросов** (CPM)
- **1 запрос = 1 страница** (включая автоматическое решение капчи)

## 📊 Архитектура

```
Frontend (Next.js)
    ↓
API Route (/api/parsers/bandlink)
    ↓
Python Parser (bandlink_parser_brightdata_linux.py)
    ↓
Bright Data Web Unlocker API
    ↓
band.link (с автоматическим решением капч)
    ↓
SQLite DB (bandlink_playlists_brightdata.db)
```

## 🧪 Тестирование

### Локально:

```bash
cd /Users/macbook/proga/rossel-music
python3 parsers/bandlink_parser_brightdata_linux.py test_config.json
```

### На сервере:

Парсер будет запускаться автоматически через API endpoint:
```
POST /api/parsers/bandlink
{
  "artists": ["artist1", "artist2"]
}
```

## 📝 Файлы

- `parsers/bandlink_parser_brightdata_linux.py` - Основной парсер
- `app/api/parsers/bandlink/route.ts` - API endpoint
- `bandlink_playlists_brightdata.db` - База данных результатов
- `bandlink_parser_brightdata.log` - Логи парсера

## ⚠️ Важно

1. **Bright Data автоматически решает капчи** - не нужно вручную кликать "Я не робот"
2. **API работает без браузера** - быстрее и дешевле
3. **Лимит 50 запросов за сессию** для защиты от перерасхода
4. **Логи сохраняются** в `bandlink_parser_brightdata.log`

## 🔍 Отладка

Если парсер не работает:

1. Проверьте логи: `tail -f bandlink_parser_brightdata.log`
2. Проверьте переменные окружения: `echo $BRIGHT_DATA_API_KEY`
3. Проверьте баланс Bright Data в панели управления
4. Проверьте, что зона `web_unlocker1` активна

## 📚 Документация

- [Bright Data Web Unlocker](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction)
- [API Reference](https://docs.brightdata.com/scraping-automation/web-unlocker/overview)

