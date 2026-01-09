# Koala Music Parser

Автоматический парсер релизов с агрегатора [Koala Music](https://portal.koala-music.com/).

## 🎯 Что делает

1. **Авторизуется** на портале Koala Music
2. **Собирает релизы** всех артистов (пропускает черновики)
3. **Извлекает детали**:
   - UPC код (только для доставленных релизов)
   - BandLink ссылку
   - Обложку
   - ISRC коды треков
   - Статус релиза
4. **Синхронизирует** с базой данных:
   - Создаёт новые релизы (если артист найден в системе)
   - Обновляет статусы существующих релизов
   - Добавляет UPC коды при доставке

## ⏰ Расписание

Парсер запускается **автоматически** дважды в день:
- 🕐 **12:00** по Москве
- 🕗 **20:00** по Москве

Используется встроенный планировщик `node-cron`, который запускается при старте сервера.

## 📁 Файлы

```
parsers/
├── koala_releases_parser.py    # Основной Python парсер (Selenium)
└── koala_config.json           # Конфигурация (логин/пароль)

lib/
└── scheduler.ts                # Планировщик node-cron

app/api/
├── koala-parser/route.ts       # API endpoint для запуска и статуса
└── cron/koala/route.ts         # Cron endpoint (защищён секретом)

app/dashboard/admin/releases/
└── koala-parser/page.tsx       # UI мониторинга

instrumentation.ts              # Автозапуск планировщика при старте
```

## 🔧 Настройка

### 1. Конфигурация парсера

Файл `parsers/koala_config.json`:
```json
{
  "login": "Maks.lat@bk.ru",
  "password": "IXLth1gU5v",
  "base_url": "https://portal.koala-music.com",
  "headless": true
}
```

### 2. Переменные окружения

В настройках хостинга (Timeweb) добавьте:

| Переменная | Значение | Назначение |
|------------|----------|------------|
| `CRON_SECRET` | `rossel66-koala-parser-2024` | Защита cron endpoint |
| `NEXT_PUBLIC_BASE_URL` | `https://rossel66.com` | Базовый URL приложения |

### 3. Python зависимости

```bash
pip install selenium webdriver-manager
```

Или используйте venv:
```bash
source venv_selenium/bin/activate
pip install selenium webdriver-manager
```

## 🚀 Использование

### Автоматический запуск

Парсер запускается автоматически при старте приложения:
1. Next.js сервер запускается
2. `instrumentation.ts` вызывает `initScheduler()`
3. `node-cron` устанавливает задачи на 12:00 и 20:00 МСК
4. В назначенное время запускается Python парсер

### Ручной запуск через UI

1. Откройте админку: `https://rossel66.com/dashboard/admin/releases`
2. Нажмите кнопку **"Koala Parser"**
3. На открывшейся странице нажмите **"Запустить парсинг"**
4. Дождитесь завершения и проверьте результаты

### Ручной запуск через API

```bash
curl -X POST https://rossel66.com/api/koala-parser
```

### Ручной запуск Python парсера

```bash
cd /path/to/project
source venv_selenium/bin/activate
python parsers/koala_releases_parser.py
```

## 📊 Мониторинг

### UI Дашборд

Откройте `https://rossel66.com/dashboard/admin/releases/koala-parser`

Показывает:
- ⏰ Время последнего запуска
- ✅/❌ Статус (успешно/ошибка)
- 📊 Статистику (добавлено/обновлено/пропущено)
- 📋 Таблицу последних спарсенных релизов

### Логи

При запуске сервера в консоли отображаются:
```
═══════════════════════════════════════════════════
⏰ KOALA PARSER SCHEDULER
═══════════════════════════════════════════════════
📅 Schedule: 12:00 and 20:00 Moscow time
═══════════════════════════════════════════════════
✅ Scheduler started successfully
```

При срабатывании:
```
🚀 [12:00 MSK] Starting scheduled Koala Parser...
📋 Running Koala Music releases parser...
✅ Parser completed in 45123ms
📊 Found 7 releases
📊 Results: added 2, updated 3
```

## 📝 Статусы релизов

| Статус Koala Music | Действие | UPC код |
|--------------------|----------|---------|
| Черновик | ❌ Пропустить | — |
| На модерации | ✅ Добавить | Нет |
| Одобрен | ✅ Добавить | Нет |
| Отклонён | ✅ Добавить | Нет |
| В доставке | ✅ Добавить | Нет |
| **Доставлен** | ✅ Добавить | **Да** |
| Снят | ✅ Добавить | Нет |

## 🔍 Логика сопоставления

### Артисты
Парсер ищет артистов по полю `name` (регистронезависимо):
- Koala: `"СКАЯ"` → Система: `{name: "СКАЯ"}`
- Koala: `"d3li"` → Система: `{name: "d3li"}`

Если артист не найден — релиз **пропускается**.

### Релизы с несколькими артистами
Koala: `"W.1ce3, Sobaby"` → Добавляется только для тех артистов, кто есть в системе.

### Обновление существующих релизов
Поиск по `koalaId`:
- Если найден — обновляется **статус**, **UPC** (если доставлен), **BandLink**
- Если не найден — создаётся новый

## 🛠️ Технические детали

### Selenium селекторы

| Элемент | Селектор |
|---------|----------|
| Карточки релизов | `role="link"` в `role="section"` |
| Страница релиза | `/releases/{koala_id}` |
| UPC код | Текст после "UPC" |
| BandLink | `a[href*="band.link"]` |
| ISRC | Regex: `ISRC\s*[\n:]*\s*([A-Z]{2}[A-Z0-9]{3}\d{7})` |

### Структура данных

**Выход Python парсера** (`parsers/koala_output.json`):
```json
[
  {
    "koala_id": "44549",
    "title": "SH4KE/Going Crazy",
    "artist": "d3li",
    "status": "Доставлен",
    "release_date": "26.12.2025",
    "upc": "4660285045903",
    "bandlink_url": "https://band.link/kQqyj",
    "cover_url": "https://...",
    "isrc_codes": ["RUAGW2511910"],
    "parsed_at": "2026-01-09T02:12:50"
  }
]
```

**Релиз в системе** (`data/releases.json`):
```json
{
  "id": "release_1736384000_abc123",
  "title": "SH4KE/Going Crazy",
  "artistId": "artist_xyz",
  "releaseDate": "2025-12-26",
  "status": "Доставлен",
  "upc": "4660285045903",
  "bandlinkUrl": "https://band.link/kQqyj",
  "koalaId": "44549",
  "tracks": [...]
}
```

## 🐛 Troubleshooting

### Парсер не запускается автоматически

1. Проверьте, что сервер запущен
2. Проверьте логи: `docker logs [container]` или консоль
3. Убедитесь, что `instrumentation.ts` существует
4. Проверьте `next.config.js`: должен быть `instrumentationHook: true`

### Релизы не добавляются

1. Проверьте, что артисты существуют в системе
2. Проверьте `name` артиста (должно совпадать с Koala Music)
3. Проверьте логи парсера в консоли

### Ошибка аутентификации

1. Проверьте credentials в `parsers/koala_config.json`
2. Попробуйте запустить парсер вручную:
   ```bash
   python parsers/koala_releases_parser.py
   ```
3. Проверьте, что не изменились селекторы на сайте

### UPC коды не добавляются

UPC коды добавляются **только для релизов со статусом "Доставлен"**.

Для других статусов это нормальное поведение.

## 📖 Спецификация

Полная спецификация доступна в OpenSpec:
- `openspec/specs/koala-parser/spec.md`

## 🤝 Связанные компоненты

- **Release Management** (`openspec/specs/release-management/`)
- **Artist Management** (`openspec/specs/artist-management/`)
- **Playlist Parsers** (`openspec/specs/playlist-parsers/`)

