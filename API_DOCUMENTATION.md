# ROSSEL 66 MUSIC - Полная документация проекта

## Оглавление
1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [API Endpoints](#api-endpoints)
4. [Страницы и маршруты](#страницы-и-маршруты)
5. [Компоненты](#компоненты)
6. [Потоки данных](#потоки-данных)
7. [Интеграции](#интеграции)
8. [Парсеры](#парсеры)
9. [Хранение данных](#хранение-данных)

---

## Обзор системы

**ROSSEL 66 MUSIC** - это платформа для управления музыкальным лейблом, включающая:
- Личный кабинет для артистов
- Админ-панель для управления
- Систему обработки отчетов о прослушиваниях
- Систему выплат роялти
- Парсеры плейлистов (Bandlink, VK Music)
- Интеграцию с Pyrus для обработки форм
- Систему резервного копирования

### Технологический стек
- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes
- **Хранение**: JSON файлы (file-based storage), SQLite (для парсеров)
- **Парсеры**: Python 3, Selenium, Bright Data прокси, 2captcha
- **Интеграции**: Pyrus API

---

## Архитектура

### Структура проекта
```
rossel-music/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   ├── dashboard/         # Личные кабинеты
│   │   ├── admin/        # Админ-панель
│   │   └── artist/       # Кабинет артиста
│   ├── forms/            # Формы заявок
│   ├── distribution/     # Страница дистрибуции
│   └── faq/              # FAQ страница
├── components/            # React компоненты
├── lib/                   # Утилиты и библиотеки
├── parsers/              # Python парсеры
├── data/                 # JSON файлы данных
└── reports/              # Сохраненные отчеты
```

### Роли пользователей
1. **Admin** - полный доступ к системе
2. **Artist** - доступ к своему личному кабинету

### Аутентификация
- Простая система на основе localStorage
- Проверка роли через `components/auth-check.tsx`
- Нет серверных сессий

---

## API Endpoints

### Управление пользователями

#### `GET /api/users`
Получить список всех пользователей

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "string",
      "username": "string",
      "name": "string",
      "role": "admin" | "artist",
      "email": "string",
      "avatarUrl": "string",
      "vkMusicUrl": "string",
      "yandexMusicUrl": "string",
      "spotifyUrl": "string"
    }
  ]
}
```

#### `POST /api/users`
Создать нового пользователя

**Body:**
```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "email": "string",
  "role": "admin" | "artist",
  "avatarUrl": "string",
  "vkMusicUrl": "string",
  "yandexMusicUrl": "string",
  "spotifyUrl": "string"
}
```

#### `PUT /api/users`
Обновить пользователя

**Body:**
```json
{
  "id": "string",
  "username": "string",
  "password": "string",
  "name": "string",
  "email": "string",
  "avatarUrl": "string",
  "vkMusicUrl": "string",
  "yandexMusicUrl": "string",
  "spotifyUrl": "string"
}
```

#### `DELETE /api/users`
Удалить пользователя

**Body:**
```json
{
  "id": "string"
}
```

### Управление артистами

#### `GET /api/artists`
Получить список артистов

**Response:**
```json
{
  "success": true,
  "artists": [
    {
      "id": "string",
      "username": "string",
      "name": "string",
      "email": "string",
      "avatarUrl": "string",
      "vkMusicUrl": "string",
      "yandexMusicUrl": "string",
      "spotifyUrl": "string"
    }
  ]
}
```

#### `POST /api/artists`
Создать нового артиста

**Body:**
```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "email": "string",
  "avatarUrl": "string",
  "vkMusicUrl": "string",
  "yandexMusicUrl": "string",
  "spotifyUrl": "string"
}
```

#### `PUT /api/artists`
Обновить артиста

#### `DELETE /api/artists`
Удалить артиста

### Управление отчетами

#### `POST /api/reports/process`
Обработать Excel файл отчета

**FormData:**
- `file`: File - Excel файл с данными
- `template_file`: File - Шаблон Excel
- `artists_file`: File - Файл с артистами
- `quarter`: string - Квартал (Q1, Q2, Q3, Q4)
- `isrc_column`: string - Столбец ISRC
- `track_name_column`: string - Столбец названия трека
- `album_name_column`: string - Столбец альбома
- `artist_column`: string - Столбец артиста
- `plays_column`: string - Столбец прослушиваний
- `amount_column`: string - Столбец суммы

**Response:**
```json
{
  "success": true,
  "message": "string",
  "processedArtists": number,
  "reports": ReportData[]
}
```

#### `POST /api/reports/process-new`
Новая обработка отчета (упрощенная)

#### `POST /api/reports/process-python`
Обработка через Python скрипт

#### `POST /api/reports/bulk-upload`
Массовая загрузка отчетов

**FormData:**
- `quarter`: string
- `files`: File[] - Массив Excel файлов

**Response:**
```json
{
  "success": true,
  "message": "string",
  "processedFiles": number,
  "fileNames": string[],
  "errors": Array<{fileName: string, error: string}>
}
```

#### `GET /api/reports/list/[quarter]`
Получить список отчетов за квартал

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": "string",
      "artistId": "string",
      "artistName": "string",
      "quarter": "string",
      "year": number,
      "totalPlays": number,
      "totalAmount": number,
      "isSigned": boolean,
      "isPaid": boolean,
      "uploadDate": "string",
      "fileName": "string",
      "fileUrl": "string"
    }
  ]
}
```

#### `GET /api/reports/quarters`
Получить список всех кварталов с отчетами

**Response:**
```json
{
  "success": true,
  "quarters": ["Q1-2024", "Q2-2024", ...]
}
```

#### `POST /api/reports/assign`
Назначить отчет артисту

**Body:**
```json
{
  "reportId": "string",
  "artistId": "string"
}
```

#### `PUT /api/reports/update-status`
Обновить статус отчета

**Body:**
```json
{
  "reportId": "string",
  "isSigned": boolean,
  "isPaid": boolean
}
```

#### `GET /api/reports/unregistered`
Получить незарегистрированные отчеты

#### `GET /api/reports/preview/[id]`
Предпросмотр отчета (первые 50 строк)

#### `GET /api/reports/download/[id]`
Скачать файл отчета

#### `GET /api/reports/download-all/[quarter]`
Скачать все отчеты за квартал (ZIP архив)

#### `POST /api/reports/save`
Сохранить отчеты в файловую систему

#### `DELETE /api/reports/delete/[id]`
Удалить отчет

#### `GET /api/reports/clear-fake`
Удалить все фейковые (незарегистрированные) отчеты

### Управление релизами

#### `GET /api/releases`
Получить список всех релизов

#### `POST /api/releases`
Создать новый релиз

**Body:**
```json
{
  "artistId": "string",
  "artistName": "string",
  "title": "string",
  "coverUrl": "string",
  "upc": "string",
  "releaseDate": "string",
  "status": "released" | "moderation" | "delivery" | "scheduled",
  "tracks": [
    {
      "id": "string",
      "title": "string",
      "isrc": "string",
      "duration": "string"
    }
  ]
}
```

#### `GET /api/releases/[id]`
Получить конкретный релиз

#### `PUT /api/releases/[id]`
Обновить релиз

#### `DELETE /api/releases/[id]`
Удалить релиз

#### `GET /api/releases/artist/[artistId]`
Получить релизы артиста

### Выплаты и баланс

#### `GET /api/payments`
Получить список всех выплат

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "string",
      "reportId": "string",
      "artistId": "string",
      "artistName": "string",
      "quarter": "string",
      "year": number,
      "amount": number,
      "date": "string",
      "isPaid": boolean,
      "isSigned": boolean
    }
  ]
}
```

#### `GET /api/balance/[artistId]`
Получить баланс артиста

**Response:**
```json
{
  "success": true,
  "balance": {
    "artistId": "string",
    "totalBalance": number,
    "availableForPayout": number,
    "lastUpdated": "string"
  }
}
```

**Логика расчета:**
- `totalBalance` = сумма всех отчетов артиста
- `availableForPayout` = невыплаченный баланс (минимум 3000₽ для выплаты)

### Парсеры плейлистов

#### `POST /api/parsers/bandlink`
Запустить парсер Bandlink

**Body:**
```json
{
  "target_artists": ["Artist1", "Artist2"],
  "bright_data_proxy_username": "string",
  "bright_data_proxy_password": "string",
  "proxy_host": "string",
  "proxy_port": number,
  "cookies": {
    "cookie_name": "cookie_value"
  }
}
```

**Логика:**
- Linux: использует Bright Data прокси, headless режим
- Mac: без прокси, видимый браузер
- Сохраняет результаты в SQLite БД (`bandlink_playlists.db`)

#### `POST /api/parsers/vk`
Запустить парсер VK Music

**Body:**
```json
{
  "target_artists": [
    {"url": "https://vk.com/music/artist/..."}
  ],
  "captcha_api_key": "string"
}
```

**Логика:**
- Использует Selenium с headless режимом
- Решает капчу через 2captcha API
- Сохраняет в SQLite БД (`artist_playlists.db`)

#### `GET /api/parsers/recent-artists`
Получить недавно обработанных артистов

#### `POST /api/parsers/clear`
Очистить результаты парсинга

#### `GET /api/bandlink/cookies`
Получить текущие cookies для Bandlink

#### `POST /api/bandlink/cookies`
Обновить cookies из curl команды

**Body:**
```json
{
  "curlCommand": "curl -H 'Cookie: name=value; name2=value2' ..."
}
```

#### `DELETE /api/bandlink/cookies`
Удалить все cookies

#### `POST /api/vk-parser`
Парсинг VK Music через HTML (клиентская отправка)

**Body:**
```json
{
  "html": "string",
  "artistId": "string"
}
```

### Pyrus интеграция

#### `POST /api/submit-pyrus-data-rf`
Отправить форму данных артиста (РФ) в Pyrus

**FormData:**
- Все поля формы анкеты артиста

#### `POST /api/submit-pyrus-data-not-rf`
Отправить форму данных артиста (не РФ) в Pyrus

#### `POST /api/submit-pyrus-release-upload`
Отправить форму загрузки релиза в Pyrus

**FormData:**
- `form_data_json`: string - JSON с данными релиза
- `release_0_coverArt`: File
- `release_0_track_0_audioFile`: File
- `release_0_track_0_lyricsFile`: File
- ... (для каждого релиза и трека)

#### `POST /api/submit-pyrus-catalog-upload`
Отправить форму переноса каталога в Pyrus

**FormData:**
- `form_data_json`: string - JSON с данными релизов (до 5 релизов)
- Файлы обложек и треков

#### `POST /api/submit-pyrus-distribution`
Отправить форму дистрибуции в Pyrus

**FormData:**
- `form_data_json`: string - JSON с данными релиза
- `coverArtFile`: File
- `track_0_audioFile`: File
- `track_0_lyricsFile`: File
- ... (для каждого трека)

**Логика:**
- Аутентификация через Pyrus API
- Загрузка файлов в Pyrus
- Создание задачи в Pyrus с заполненными полями
- Отслеживание прогресса через EventSource

### Резервное копирование

#### `GET /api/backups`
Получить список бэкапов

#### `POST /api/backups`
Создать новый бэкап

**Response:**
```json
{
  "success": true,
  "backup": {
    "id": "string",
    "filename": "string",
    "createdAt": "string",
    "size": number
  }
}
```

#### `POST /api/backups/restore`
Восстановить из бэкапа

**Body:**
```json
{
  "backupId": "string"
}
```

#### `GET /api/backups/download`
Скачать бэкап

#### `GET /api/cron/backup`
Автоматическое создание бэкапа (cron endpoint)

**Логика:**
- Создает ZIP архив всех JSON файлов из `/data`
- Включает SQLite БД парсеров
- Сохраняет в `/backups/`
- Запускается каждые 3 дня

### Другие endpoints

#### `GET /api/excel/[artistId]`
Сгенерировать Excel файл с релизами артиста

#### `POST /api/playlists/crawl`
Запустить краулинг плейлистов для всех артистов

#### `GET /api/notifications`
Получить уведомления (о необходимости новых cookies)

#### `POST /api/uploads/covers`
Загрузить обложку релиза

**FormData:**
- `file`: File

**Response:**
```json
{
  "success": true,
  "url": "/uploads/covers/filename.jpg"
}
```

#### `GET /api/upload-progress/[id]`
Получить прогресс загрузки (EventSource)

#### `GET /api/activities`
Получить ленту активности

---

## Страницы и маршруты

### Публичные страницы

#### `/` (Главная страница)
- Hero секция
- Факты о лейбле
- Услуги
- Партнеры
- Артисты
- Контактная форма
- FAQ

#### `/distribution`
Форма отправки релиза на дистрибуцию
- Основная информация о релизе
- Трек-лист
- Промо материалы
- Ссылки на стриминги
- Отправка в Pyrus

#### `/faq`
Страница с часто задаваемыми вопросами
- Фильтрация по категориям
- Аккордеон с вопросами

#### `/forms`
Главная страница форм
- Ссылки на все формы

#### `/forms/dataRF`
Анкета артиста (РФ)
- Личные данные
- Банковские реквизиты
- Отправка в Pyrus

#### `/forms/dataNotRF`
Анкета артиста (не РФ)
- Аналогично dataRF, но для нерезидентов

#### `/forms/releaseUPLOAD`
Форма загрузки релиза
- Информация о релизе
- Треки
- Файлы
- Отправка в Pyrus

#### `/forms/catalogUPLOAD`
Форма переноса каталога
- До 5 релизов
- Массовая загрузка
- Отправка в Pyrus

### Dashboard - Admin

#### `/dashboard/login`
Страница входа
- Проверка логина/пароля
- Сохранение в localStorage
- Редирект по роли

#### `/dashboard/admin/dashboard`
Главная админ-панель
- Статистика
- Последние активности
- Быстрые действия

#### `/dashboard/admin/artists`
Список артистов
- Таблица всех артистов
- Фильтрация и поиск
- Действия: просмотр, редактирование, удаление

#### `/dashboard/admin/artists/add`
Добавить артиста
- Форма создания
- Загрузка аватара
- Ссылки на музыкальные сервисы

#### `/dashboard/admin/artists/bulk-add`
Массовое добавление артистов
- Список имен
- Автоматическая генерация паролей
- Пакетное создание

#### `/dashboard/admin/artists/[id]`
Профиль артиста
- Вкладки: Профиль, Релизы, Отчеты, Выплаты
- Редактирование данных
- Просмотр связанных данных

#### `/dashboard/admin/artists/[id]/reports`
Отчеты артиста
- Список всех отчетов
- Статусы (подписан/выплачен)
- Суммы

#### `/dashboard/admin/artists/[id]/releases`
Релизы артиста
- Список релизов
- Добавление/редактирование

#### `/dashboard/admin/artists/[id]/playlists`
Плейлисты артиста
- Список плейлистов
- Форма парсинга VK

#### `/dashboard/admin/reports`
Управление отчетами
- Список всех отчетов
- Фильтрация по кварталам
- Загрузка новых отчетов
- Обработка файлов

#### `/dashboard/admin/reports-generator`
Генератор отчетов
- Загрузка Excel файла
- Настройка маппинга столбцов
- Обработка и распределение

#### `/dashboard/admin/unregistered-reports`
Незарегистрированные отчеты
- Список отчетов без артиста
- Назначение артистам

#### `/dashboard/admin/releases`
Управление релизами
- Список всех релизов
- Фильтрация
- Добавление/редактирование

#### `/dashboard/admin/releases/add`
Добавить релиз
- Форма создания
- Выбор артиста
- Треки
- Обложка

#### `/dashboard/admin/releases/[id]`
Редактирование релиза
- Редактирование всех полей
- Управление треками
- Загрузка обложки

#### `/dashboard/admin/payments`
Управление выплатами
- Список всех выплат
- Статусы
- Фильтрация

#### `/dashboard/admin/playlists/parsers`
Парсеры плейлистов
- Выбор артистов
- Запуск Bandlink парсера
- Запуск VK парсера
- Управление cookies

#### `/dashboard/admin/settings`
Настройки админа
- Общие настройки
- Управление бэкапами

### Dashboard - Artist

#### `/dashboard/artist/[username]/dashboard`
Главная страница артиста
- Статистика
- Последние релизы
- Баланс
- Активности

#### `/dashboard/artist/[username]/reports`
Отчеты артиста
- Список отчетов по кварталам
- Детали отчетов
- Статусы

#### `/dashboard/artist/[username]/releases`
Релизы артиста
- Список релизов
- Просмотр деталей

#### `/dashboard/artist/[username]/releases/[id]`
Детали релиза
- Информация о релизе
- Список треков
- Статистика

#### `/dashboard/artist/[username]/playlists`
Плейлисты артиста
- Список плейлистов
- Платформы
- Ссылки

#### `/dashboard/artist/[username]/payments`
Выплаты и баланс
- Текущий баланс
- Доступно к выплате
- История выплат
- Минимальная сумма (3000₽)

#### `/dashboard/artist/[username]/settings`
Настройки артиста
- Редактирование профиля
- Изменение пароля

---

## Компоненты

### Layout компоненты

#### `components/layout.tsx`
Основной layout для dashboard
- Проверка авторизации
- Sidebar
- Top navigation
- Контент

#### `components/sidebar.tsx`
Боковая панель навигации
- Меню по ролям
- Активные ссылки

#### `components/top-nav.tsx`
Верхняя навигация
- Информация о пользователе
- Выход

#### `components/auth-check.tsx`
Проверка авторизации
- Проверка localStorage
- Редирект на login
- Проверка роли

### Компоненты отчетов

#### `components/report-processor.tsx`
Обработчик отчетов
- Загрузка файла
- Настройка маппинга
- Обработка

#### `components/simple-report-uploader.tsx`
Простая загрузка отчетов
- Drag & drop
- Массовая загрузка

#### `components/reports-list.tsx`
Список отчетов
- Таблица
- Фильтрация
- Действия

#### `components/unregistered-reports-list.tsx`
Список незарегистрированных отчетов
- Назначение артистам

#### `components/artist-reports.tsx`
Отчеты артиста
- Группировка по кварталам
- Детали

### Компоненты парсеров

#### `components/vk-parser-form.tsx`
Форма парсинга VK
- Вставка HTML
- Парсинг
- Добавление плейлистов

### UI компоненты (shadcn/ui)
Все стандартные компоненты в `components/ui/`:
- Button, Input, Select, Card, Badge, Alert, Tabs, Dialog, и т.д.

---

## Потоки данных

### Обработка отчетов

1. **Загрузка Excel файла**
   - Админ загружает файл через форму
   - Файл сохраняется во временное хранилище

2. **Настройка маппинга**
   - Выбор столбцов: ISRC, трек, альбом, артист, прослушивания, сумма
   - Сохранение маппинга

3. **Обработка файла**
   - Чтение Excel через `xlsx`
   - Парсинг строк
   - Распределение по артистам с учетом долей роялти

4. **Генерация отчетов**
   - Создание индивидуальных Excel файлов для каждого артиста
   - Сохранение в `/reports/{quarter}/`
   - Создание записей в `data/reports.json`

5. **Автоматическое назначение**
   - Зарегистрированные артисты получают отчеты автоматически
   - Незарегистрированные попадают в список для ручного назначения

6. **Обновление статусов**
   - `isSigned` - отчет подписан артистом
   - `isPaid` - выплата произведена

### Система выплат

1. **Расчет баланса**
   - Суммирование всех отчетов артиста
   - Вычитание уже выплаченных сумм
   - Проверка минимальной суммы (3000₽)

2. **Статусы выплат**
   - `isPaid: false` - не выплачено
   - `isPaid: true` - выплачено
   - Обновление через `/api/reports/update-status`

3. **Доступно к выплате**
   - `availableForPayout = totalBalance - paidAmount`
   - Только если >= 3000₽

### Парсинг плейлистов

#### Bandlink парсер

1. **Инициализация**
   - Загрузка конфигурации (артисты, прокси, cookies)
   - Настройка Selenium драйвера

2. **Linux (с прокси)**
   - Использует Bright Data прокси
   - Headless режим Chrome
   - Ротация IP через session ID
   - Обработка капчи сменой прокси

3. **Mac (без прокси)**
   - Локальный Chrome
   - Видимый браузер
   - Использование cookies

4. **Парсинг**
   - Переход на `band.link/scanner?search={artist}`
   - Поиск плейлистов в DOM
   - Извлечение данных (название, платформа, ссылка, обложка)

5. **Сохранение**
   - SQLite БД `bandlink_playlists.db`
   - Таблица `playlists`
   - Обновление существующих, добавление новых

#### VK парсер

1. **Инициализация**
   - Настройка Selenium (headless)
   - Инициализация 2captcha solver

2. **Парсинг страницы артиста**
   - Переход на URL артиста
   - Обнаружение капчи
   - Решение через 2captcha API
   - Извлечение плейлистов из DOM

3. **Сохранение**
   - SQLite БД `artist_playlists.db`
   - Таблица `artist_playlists`

4. **Клиентский парсинг**
   - Альтернативный метод через HTML
   - Парсинг через cheerio
   - Отправка через `/api/vk-parser`

### Формы → Pyrus

1. **Заполнение формы**
   - Пользователь заполняет форму на сайте
   - Валидация полей

2. **Подготовка данных**
   - Формирование JSON с данными
   - Загрузка файлов (обложки, треки, тексты)

3. **Отправка в Pyrus**
   - Аутентификация через Pyrus API
   - Загрузка файлов в Pyrus
   - Получение GUID файлов
   - Создание задачи с заполненными полями

4. **Отслеживание прогресса**
   - EventSource для прогресса загрузки
   - Обновление UI в реальном времени

### Резервное копирование

1. **Автоматическое (cron)**
   - Запуск каждые 3 дня
   - Создание ZIP архива
   - Включение всех JSON файлов из `/data`
   - Включение SQLite БД
   - Сохранение в `/backups/`

2. **Ручное**
   - Админ создает бэкап через панель
   - Аналогичный процесс

3. **Восстановление**
   - Выбор бэкапа
   - Распаковка архива
   - Восстановление файлов

---

## Интеграции

### Pyrus API

**Настройки:**
- Email: `rossel66.music@gmail.com`
- API Key: хранится в коде (небезопасно, нужно вынести в env)

**Формы:**
- Форма данных РФ: ID 2312632
- Форма данных не РФ: ID 2312631
- Форма загрузки релиза: ID 2312630
- Форма переноса каталога: ID 2312633
- Форма дистрибуции: ID 2320361

**Процесс:**
1. Аутентификация через `/v4/auth`
2. Загрузка файлов через `/v4/files/upload`
3. Создание задачи через `/v4/tasks`

### Bright Data (прокси)

**Использование:**
- Только для Linux парсера
- Ротация IP через session ID
- Формат: `{username}-session-{uuid}@{host}:{port}`

### 2captcha

**Использование:**
- Только для VK парсера
- Решение VK капчи
- API ключ в конфигурации

---

## Парсеры

### Bandlink Parser (Linux)

**Файл:** `parsers/bandlink_parser_production_linux.py`

**Особенности:**
- Headless Chrome
- Bright Data прокси
- Ротация IP
- Обработка капчи сменой прокси
- Использование cookies

**Запуск:**
```bash
python3 bandlink_parser_production_linux.py config.json
```

**Конфигурация:**
```json
{
  "target_artists": ["Artist1", "Artist2"],
  "bright_data_proxy_username": "string",
  "bright_data_proxy_password": "string",
  "proxy_host": "brd.superproxy.io",
  "proxy_port": 33335,
  "cookies": {
    "cookie_name": "cookie_value"
  }
}
```

### Bandlink Parser (Mac)

**Файл:** `parsers/bandlink_parser_production_mac.py`

**Особенности:**
- Видимый Chrome
- Без прокси
- Использование cookies

### VK Parser

**Файл:** `parsers/vk_parser_linux.py`

**Особенности:**
- Headless Chrome
- 2captcha для капчи
- Парсинг плейлистов со страницы артиста

**Запуск:**
```bash
python3 vk_parser_linux.py config.json
```

**Конфигурация:**
```json
{
  "target_artists": [
    {"url": "https://vk.com/music/artist/..."}
  ],
  "captcha_api_key": "string"
}
```

---

## Хранение данных

### JSON файлы (file-based storage)

**Расположение:** `/data/`

**Файлы:**
- `users.json` - пользователи
- `artists.json` - артисты (алиас users.json)
- `releases.json` - релизы
- `reports.json` - отчеты
- `balances.json` - балансы
- `activities.json` - активности
- `backups.json` - информация о бэкапах

**Управление:**
- Чтение/запись через `lib/storage.ts`
- Функции: `loadUsers()`, `saveUsers()`, и т.д.

### SQLite базы данных

**Расположение:** корень проекта

**Базы:**
- `bandlink_playlists.db` - плейлисты Bandlink
- `bandlink_playlists_mac.db` - плейлисты Bandlink (Mac)
- `artist_playlists.db` - плейлисты VK
- `vk_playlists.db` - альтернативная БД VK

**Таблицы:**

**playlists (Bandlink):**
```sql
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_name TEXT NOT NULL,
  playlist_name TEXT NOT NULL,
  playlist_artist TEXT,
  track_names TEXT,
  likes_count TEXT,
  platform TEXT,
  playlist_cover_url TEXT,
  playlist_url TEXT,
  added_at TIMESTAMP,
  parsed_at TIMESTAMP,
  UNIQUE(artist_name, playlist_name, playlist_url)
)
```

**artist_playlists (VK):**
```sql
CREATE TABLE artist_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_url TEXT,
  artist_name TEXT,
  playlist_name TEXT,
  playlist_url TEXT,
  playlist_cover_url TEXT,
  playlist_id TEXT,
  owner_id TEXT,
  parsed_at TIMESTAMP
)
```

### Файлы отчетов

**Расположение:** `/reports/{quarter}/`

**Формат:** Excel файлы (.xlsx)
**Именование:** `{artistName}.xlsx`

---

## Дополнительная информация

### Безопасность

⚠️ **Важные замечания:**
- Пароли хранятся в открытом виде (небезопасно)
- Pyrus API ключ захардкожен в коде
- Нет серверных сессий
- localStorage для аутентификации

### Рекомендации по улучшению

1. **Безопасность:**
   - Хеширование паролей
   - JWT токены для аутентификации
   - Переменные окружения для API ключей

2. **База данных:**
   - Миграция на PostgreSQL/MySQL
   - ORM (Prisma, TypeORM)

3. **Производительность:**
   - Кэширование данных
   - Оптимизация запросов
   - Индексы в БД

4. **Масштабируемость:**
   - Очереди для обработки отчетов
   - Фоновые задачи
   - Микросервисная архитектура

---

## Заключение

Эта документация описывает полную структуру и функциональность системы ROSSEL 66 MUSIC. Все API endpoints, страницы, компоненты и потоки данных задокументированы для удобства разработки и поддержки системы.

