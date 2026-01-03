# Архитектура системы ROSSEL 66 MUSIC

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Public     │  │   Dashboard  │  │    Forms     │      │
│  │   Pages      │  │   (Admin/    │  │              │      │
│  │              │  │   Artist)    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Routes (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Users   │  │ Reports  │  │ Releases │  │ Payments │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Parsers  │  │  Pyrus   │  │ Backups  │  │  Excel   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ File Storage │   │  SQLite DB   │   │  External    │
│  (JSON)      │   │  (Parsers)   │   │  APIs        │
│              │   │              │   │              │
│ - users.json │   │ - bandlink_  │   │ - Pyrus API  │
│ - reports    │   │   playlists  │   │ - 2captcha   │
│ - releases   │   │ - vk_        │   │ - Bright Data│
│ - balances   │   │   playlists  │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Python     │
                    │   Parsers    │
                    │              │
                    │ - Bandlink   │
                    │ - VK Music   │
                    └──────────────┘
```

## Поток обработки отчетов

```
1. Загрузка Excel файла
   │
   ▼
2. Настройка маппинга столбцов
   │
   ▼
3. Парсинг Excel (xlsx)
   │
   ▼
4. Распределение по артистам
   │
   ├─► Зарегистрированные артисты
   │   │
   │   ▼
   │   Автоматическое назначение
   │   │
   │   ▼
   │   Генерация Excel для артиста
   │   │
   │   ▼
   │   Сохранение в /reports/{quarter}/
   │
   └─► Незарегистрированные артисты
       │
       ▼
       Сохранение в список незарегистрированных
       │
       ▼
       Ручное назначение артисту
```

## Поток выплат

```
Отчеты артиста
   │
   ▼
Расчет totalBalance (сумма всех отчетов)
   │
   ▼
Расчет paidAmount (сумма выплаченных отчетов)
   │
   ▼
Расчет availableForPayout = totalBalance - paidAmount
   │
   ├─► availableForPayout >= 3000₽
   │   │
   │   ▼
   │   Доступно к выплате
   │
   └─► availableForPayout < 3000₽
       │
       ▼
       Недостаточно средств
```

## Поток парсинга плейлистов

### Bandlink Parser

```
Конфигурация (артисты, прокси, cookies)
   │
   ▼
Инициализация Selenium
   │
   ├─► Linux: Headless + Bright Data прокси
   └─► Mac: Видимый браузер без прокси
   │
   ▼
Для каждого артиста:
   │
   ├─► Переход на band.link/scanner?search={artist}
   │
   ├─► Проверка капчи
   │   │
   │   ├─► Капча обнаружена
   │   │   │
   │   │   ├─► Linux: Смена прокси (новый IP)
   │   │   └─► Mac: Логирование
   │   │
   │   └─► Капчи нет
   │
   ├─► Парсинг плейлистов из DOM
   │
   ├─► Извлечение данных:
   │   - Название плейлиста
   │   - Платформа
   │   - Ссылка
   │   - Обложка
   │
   └─► Сохранение в SQLite БД
```

### VK Parser

```
Конфигурация (артисты, 2captcha API key)
   │
   ▼
Инициализация Selenium (headless)
   │
   ▼
Для каждого артиста:
   │
   ├─► Переход на URL артиста
   │
   ├─► Обнаружение капчи
   │   │
   │   ├─► Капча обнаружена
   │   │   │
   │   │   ├─► Отправка в 2captcha
   │   │   │
   │   │   ├─► Получение решения
   │   │   │
   │   │   └─► Ввод решения
   │   │
   │   └─► Капчи нет
   │
   ├─► Ожидание загрузки контента
   │
   ├─► Парсинг плейлистов
   │
   └─► Сохранение в SQLite БД
```

## Поток отправки форм в Pyrus

```
Заполнение формы на сайте
   │
   ▼
Валидация полей
   │
   ▼
Подготовка данных:
   - JSON с данными формы
   - Файлы (обложки, треки, тексты)
   │
   ▼
Аутентификация в Pyrus API
   │
   ▼
Загрузка файлов в Pyrus
   │
   ├─► Для каждого файла:
   │   │
   │   ├─► Загрузка через /v4/files/upload
   │   │
   │   └─► Получение GUID
   │
   ▼
Формирование задачи Pyrus
   │
   ├─► Маппинг полей формы → Pyrus Field IDs
   │
   ├─► Замена файлов на GUID
   │
   └─► Формирование таблиц (треки)
   │
   ▼
Создание задачи через /v4/tasks
   │
   ▼
Получение task ID
   │
   ▼
Успешная отправка
```

## Структура данных

### User (Пользователь)
```typescript
{
  id: string
  username: string
  password: string  // ⚠️ В открытом виде
  name: string
  email?: string
  role: "admin" | "artist"
  avatarUrl?: string
  vkMusicUrl?: string
  yandexMusicUrl?: string
  spotifyUrl?: string
}
```

### Report (Отчет)
```typescript
{
  id: string
  artistId: string
  artistName: string
  quarter: string  // "Q1", "Q2", "Q3", "Q4"
  year: number
  totalPlays: number
  totalAmount: number
  isSigned: boolean
  isPaid: boolean
  uploadDate: string
  generatedDate: string
  fileName: string
  fileUrl: string
  filePath?: string
  isRegistered: boolean
}
```

### Release (Релиз)
```typescript
{
  id: string
  artistId: string
  artistName: string
  title: string
  coverUrl: string
  upc: string
  releaseDate: string
  status: "released" | "moderation" | "delivery" | "scheduled"
  tracks: Track[]
}

Track {
  id: string
  title: string
  isrc?: string
  duration: string  // "MM:SS"
}
```

### Balance (Баланс)
```typescript
{
  artistId: string
  totalBalance: number
  availableForPayout: number
  lastUpdated: string
}
```

### Playlist (Плейлист)
```typescript
{
  id: string
  artistId: string
  name: string
  platform: string
  imageUrl: string
  externalUrl: string
  addedDate: string
  description?: string
}
```

## Компонентная архитектура

```
Layout
├── AuthCheck (проверка авторизации)
├── Sidebar (навигация)
├── TopNav (верхняя панель)
└── Content
    ├── Dashboard Components
    │   ├── ReportsList
    │   ├── ArtistReports
    │   ├── UnregisteredReportsList
    │   └── ReportProcessor
    ├── Forms Components
    │   └── VKParserForm
    └── UI Components (shadcn/ui)
        ├── Button
        ├── Input
        ├── Select
        ├── Card
        └── ...
```

## Безопасность и ограничения

### Текущие проблемы безопасности:
1. ❌ Пароли в открытом виде
2. ❌ API ключи в коде
3. ❌ Нет серверных сессий
4. ❌ localStorage для аутентификации

### Рекомендации:
1. ✅ Хеширование паролей (bcrypt)
2. ✅ JWT токены
3. ✅ Переменные окружения
4. ✅ HTTPS обязателен
5. ✅ Валидация на сервере
6. ✅ Rate limiting

## Масштабируемость

### Текущие ограничения:
- File-based storage не масштабируется
- Нет очередей для обработки
- Синхронная обработка отчетов

### Рекомендации:
- Миграция на PostgreSQL
- Очереди (Bull, RabbitMQ)
- Фоновые задачи (BullMQ)
- Кэширование (Redis)
- CDN для статики

