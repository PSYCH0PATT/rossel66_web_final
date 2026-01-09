# Project Context

## Purpose
ROSSEL 66 MUSIC — платформа для управления музыкальным лейблом. Включает личный кабинет для артистов, админ-панель для управления, систему обработки отчетов о прослушиваниях с ЦМС, систему выплат роялти, парсеры плейлистов (Bandlink, VK Music) и интеграцию с Pyrus для обработки форм.

### Ключевые функции
- **Личный кабинет артиста**: просмотр релизов, отчетов, выплат, плейлистов
- **Админ-панель**: управление артистами, релизами, отчетами, выплатами, парсерами
- **Обработка отчетов**: загрузка Excel-файлов с ЦМС, парсинг, распределение по артистам
- **Система выплат**: расчет баланса на основе отчетов
- **Парсеры плейлистов**: сбор данных с Bandlink и VK Music
- **Парсер релизов Koala Music**: автоматический импорт релизов с агрегатора (12:00 и 20:00 МСК)
- **Формы**: анкеты артистов (РФ/не РФ), загрузка каталога, загрузка релизов

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion, Lucide Icons
- **Backend**: Next.js API Routes
- **Storage**: File-based JSON (`data/*.json`), SQLite для парсеров
- **Parsers**: Python 3.x, Selenium, undetected-chromedriver
- **Scheduling**: node-cron (автоматический запуск парсеров по расписанию)
- **Excel**: ExcelJS для генерации и парсинга отчетов
- **Integrations**: Pyrus API, Bright Data, 2captcha, Koala Music API

## Project Conventions

### Code Style
- TypeScript строгий режим
- React функциональные компоненты с hooks
- Tailwind CSS для стилей (utility-first)
- shadcn/ui компоненты для UI
- Kebab-case для файлов, PascalCase для компонентов
- Camel case для переменных и функций

### Architecture Patterns
- **App Router**: `app/` директория для маршрутов
- **API Routes**: `app/api/` для backend endpoints
- **Components**: `components/` для переиспользуемых компонентов
- **Lib**: `lib/` для утилит и бизнес-логики
- **Data Layer**: JSON файлы в `data/` директории
- **Parsers**: Python скрипты в `parsers/` директории

### File Organization
```
app/
├── page.tsx                    # Главная страница (лендинг)
├── dashboard/                  # Личный кабинет
│   ├── admin/                  # Админ-панель
│   │   ├── dashboard/          # Дашборд админа
│   │   ├── artists/            # Управление артистами
│   │   ├── releases/           # Управление релизами
│   │   ├── reports/            # Управление отчетами
│   │   ├── payments/           # Выплаты
│   │   ├── playlists/          # Плейлисты и парсеры
│   │   └── settings/           # Настройки
│   └── artist/[username]/      # Кабинет артиста
│       ├── dashboard/          # Дашборд артиста
│       ├── releases/           # Релизы артиста
│       ├── reports/            # Отчеты артиста
│       ├── payments/           # Выплаты артиста
│       ├── playlists/          # Плейлисты артиста
│       └── settings/           # Настройки артиста
├── forms/                      # Публичные формы
│   ├── dataRF/                 # Анкета для артистов из РФ
│   ├── dataNotRF/              # Анкета для артистов не из РФ
│   ├── catalogUPLOAD/          # Загрузка каталога
│   └── releaseUPLOAD/          # Загрузка релиза
└── api/                        # API endpoints
```

### Testing Strategy
- Ручное тестирование через UI
- Проверка API через curl/Postman
- Логирование ошибок в консоль

### Git Workflow
- Feature branches
- Commit messages на русском или английском
- Прямые коммиты в main для hotfixes

## Domain Context

### Музыкальная индустрия
- **Артист** — музыкант или группа, подписанные на лейбл
- **Релиз** — музыкальный альбом, EP или сингл
- **Отчет** — данные о прослушиваниях с ЦМС (Центр Мониторинга Статистики)
- **Выплата** — перечисление роялти артисту на основе прослушиваний
- **Плейлист** — коллекция треков на стриминговых платформах

### ЦМС (Центр Мониторинга Статистики)
- Предоставляет Excel-отчеты с данными о прослушиваниях
- Отчеты содержат: трек, артист, платформа, количество прослушиваний, период

### Стриминговые платформы
- VK Music — российская платформа
- Bandlink — агрегатор ссылок с данными о плейлистах

### Pyrus
- CRM система для обработки форм
- Интеграция через API для отправки анкет артистов

## Important Constraints

### Безопасность
- Простая аутентификация через localStorage (не production-ready)
- Нет шифрования паролей в хранилище
- API endpoints без токенов авторизации

### Производительность
- File-based storage — не подходит для высокой нагрузки
- Парсеры работают синхронно, могут блокировать

### Ограничения парсеров
- Bandlink требует cookies и может блокировать
- VK Music требует авторизацию
- 2captcha и Bright Data — платные сервисы

## External Dependencies

### Pyrus API
- **Назначение**: Отправка форм артистов
- **Формы**: 
  - ID 1116 — Загрузка релиза
  - ID 1117 — Загрузка каталога
  - ID 1115 — Дистрибуция
  - ID 1100 — Данные артиста (РФ)
  - ID 1101 — Данные артиста (не РФ)
- **Переменные окружения**: `PYRUS_LOGIN`, `PYRUS_SECRET_KEY`

### Bright Data
- **Назначение**: Прокси для парсеров
- **Переменные окружения**: `BRIGHT_DATA_*`

### 2captcha
- **Назначение**: Решение капчи в парсерах
- **Переменные окружения**: `TWOCAPTCHA_API_KEY`

## Data Models

### User (Пользователь)
```typescript
interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'artist';
  createdAt: string;
}
```

### Artist (Артист)
```typescript
interface Artist {
  id: string;
  name: string;
  image?: string;
  bandlinkUrl?: string;
  vkMusicUrl?: string;
  socials?: {
    telegram?: string;
    vk?: string;
    instagram?: string;
  };
  createdAt: string;
}
```

### Release (Релиз)
```typescript
interface Release {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  releaseDate: string;
  type: 'album' | 'ep' | 'single';
  coverUrl?: string;
  tracks?: Track[];
  createdAt: string;
}
```

### Report (Отчет)
```typescript
interface Report {
  id: string;
  quarter: string;        // "Q1-2024"
  artistId?: string;
  artistName?: string;
  fileName: string;
  filePath: string;
  totalStreams: number;
  totalRevenue: number;
  status: 'pending' | 'assigned' | 'sent' | 'paid';
  createdAt: string;
}
```

### Balance (Баланс)
```typescript
interface Balance {
  artistId: string;
  totalEarned: number;
  totalPaid: number;
  pending: number;
  lastUpdated: string;
}
```

## API Endpoints

### Users
- `GET /api/users` — Список пользователей
- `POST /api/users` — Создать пользователя
- `PUT /api/users` — Обновить пользователя
- `DELETE /api/users?id=` — Удалить пользователя

### Artists
- `GET /api/artists` — Список артистов
- `POST /api/artists` — Создать артиста
- `PUT /api/artists` — Обновить артиста
- `DELETE /api/artists?id=` — Удалить артиста

### Releases
- `GET /api/releases` — Список релизов
- `POST /api/releases` — Создать релиз
- `PUT /api/releases` — Обновить релиз
- `DELETE /api/releases?id=` — Удалить релиз

### Reports
- `GET /api/reports/quarters` — Список кварталов
- `GET /api/reports/list/[quarter]` — Отчеты за квартал
- `POST /api/reports/process` — Обработать Excel-файл
- `POST /api/reports/assign` — Назначить отчет артисту
- `POST /api/reports/update-status` — Обновить статус
- `GET /api/reports/download/[id]` — Скачать отчет
- `DELETE /api/reports/delete/[id]` — Удалить отчет

### Payments
- `GET /api/balance/[artistId]` — Баланс артиста
- `GET /api/payments` — История выплат

### Parsers
- `POST /api/parsers/bandlink` — Запустить Bandlink парсер
- `POST /api/parsers/vk` — Запустить VK парсер
- `GET /api/bandlink/cookies` — Cookies для Bandlink
- `POST /api/koala-parser` — Запустить Koala Music парсер
- `GET /api/koala-parser` — Получить статус последнего парсинга
- `GET /api/cron/koala?secret=xxx` — Cron endpoint для автозапуска парсера

### Forms (Pyrus)
- `POST /api/submit-pyrus-data-rf` — Отправить анкету РФ
- `POST /api/submit-pyrus-data-not-rf` — Отправить анкету не РФ
- `POST /api/submit-pyrus-catalog-upload` — Загрузка каталога
- `POST /api/submit-pyrus-release-upload` — Загрузка релиза
- `POST /api/submit-pyrus-distribution` — Дистрибуция

### System
- `POST /api/backups` — Создать бекап
- `POST /api/backups/restore` — Восстановить из бекапа
- `GET /api/activities` — Лента активности
