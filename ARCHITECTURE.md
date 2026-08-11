# Архитектура ROSSEL 66 MUSIC

Восстановлено из кода в августе 2026. Каждое утверждение опирается на конкретный файл.
Где установить из кода не удалось — так и написано.

Next.js 14 App Router, Postgres через Prisma, Python-парсеры рядом. Публичный лендинг с формами
заявок плюс личные кабинеты артиста и админа.

| | |
|---|---|
| `app/` | 141 файл, 29 603 строки. 80 `route.ts`, 47 `page.tsx` |
| `lib/` | 123 файла, 18 792 строки |
| `components/` | 66 файлов, 9 756 строк |
| `scripts/` | 45 рабочих + 31 в `scripts/archive/` |
| `parsers/` | 60 файлов Python, 21 795 строк |
| Моделей Prisma | 19 |
| Prod-зависимостей | 46 |

## Как запрос проходит от страницы до данных

**Публичные страницы** (`app/page.tsx`, `/forms/*`, `/distribution`, `/faq`, `/guide`) —
серверные компоненты, читают Prisma напрямую или ничего не читают. Формы отправляются
клиентским `fetch` в `app/api/forms/*`.

**Кабинет** защищён на уровне layout, а не middleware — `middleware.ts` в проекте нет.
`app/dashboard/admin/layout.tsx:14-16` и одноимённый файл артиста вызывают `getSessionUser()`
из `lib/server-auth.ts`; без сессии — `redirect("/dashboard/login")`, при несовпадении роли —
`notFound()`. Страницы кабинета в основном серверные и ходят в Prisma напрямую, минуя API.

**API-маршруты** проверяют доступ сами: `requireAdmin()` из `lib/server-auth.ts` для админских,
`lib/cron-auth.ts` для крон-эндпоинтов (заголовок `Authorization: Bearer $CRON_SECRET`).

## Слой данных

**База одна — Postgres.** `lib/storage.ts` не второе хранилище, а **фасад над Prisma**:
`lib/storage.ts:2-3` импортирует `prisma`, обращений к файловой системе внутри нет ни одного.
Покрывает четыре модели: `user`, `release`, `report`, `activity`. Рассинхрона данных между
«двумя слоями» быть не может — слой один.

**Настоящая граница проходит по побочным эффектам.** У функций записи фасада есть два эффекта,
которых нет у прямого вызова Prisma:

1. **Ревалидация ISR** — `revalidateArtistDashboardsForArtistIds`, 7 вызовов в `lib/storage.ts`
2. **Постановка в очередь зеркала Buildin** — динамический импорт `lib/buildin/sync-hooks`,
   7 вызовов там же

Кто пишет мимо фасада — теряет и то, и другое. Это не теория: `app/api/reports/acknowledge/route.ts:56`
делает сырой `prisma.report.update`, и подтверждение отчёта до зеркала Buildin не доходит, хотя
готовая функция-двойник `updateReportAcknowledgedStatus` в фасаде есть. Соседние маршруты статусов
идут через фасад и зеркало получают.

**Отдельные механизмы хранения, которых три.** Помимо Postgres:

- **SQLite-файлы парсеров** — `bandlink_playlists.db`, `vk_playlists.db`, `bandlink_playlists_mac.db`.
  Пишет Python, читает TypeScript: `lib/parser-status-sqlite-bridge.ts`,
  `app/api/parsers/vk/route.ts:282`. Файл выбирается по платформе строкой в рантайме
  (`app/api/parsers/bandlink/route.ts:342-343`)
- **Живые JSON в `data/`** — `zvonko_parser_status.json`, `koala_parser_status.json`,
  `releases.json`, `backups.json`, `sftp_sync_index.json`. Все читаются через `existsSync` с
  фолбэком, поэтому пустой `data/` на свежем клоне не ломает приложение. `releases.json`
  производный: выгружается из БД перед чтением (`app/api/zvonko-parser/route.ts:213`)
- **Supabase Storage** — файлы (аватары, обложки, отчёты), `lib/supabase.ts`

Остальное в `data/` — легаси эпохи до Prisma, читается только архивным
`scripts/archive/`-скриптом миграции.

**Статус парсеров лежит во всех трёх местах одновременно**: JSON-файлы для koala и zvonko,
модель Prisma `ParserRunStatus` для bandlink и vk, SQLite с мостом
`lib/parser-status-sqlite-bridge.ts`. Так исторически сложилось; единого источника правды нет.

## Модели Prisma (19)

`User`, `Release`, `Report`, `Activity` — ядро кабинета, единственные, что покрыты фасадом.
`Playlist`, `PlaylistTrackPlacement`, `PlaylistHistory` — плейлисты и попадания треков.
`AnalyticsArtistAlias`, `StreamAnalytics` — аналитика стримов.
`ParserCookie`, `ParserRun`, `ParserRunStatus` — состояние парсеров.
`FormSubmission`, `FormDeliverySession`, `FormDeliveryItem`, `FormDeliveryFile`, `FormRateBucket` —
приём заявок с сайта.
`BuildinExternalId`, `BuildinOutbox` — зеркало в Buildin.

> **`StreamAnalytics` не имеет `CREATE TABLE` ни в одной миграции.** Таблицу создавали в Supabase
> руками, а три миграции её уже используют. Следствие: `prisma migrate deploy` на пустой базе падает,
> а `entrypoint.sh:30` выполняет `pnpm db:migrate` при каждом старте контейнера.

## API-маршруты (80)

Сгруппированы по доменам, по строке на группу:

| группа | шт | что делает |
|---|---|---|
| `reports/` | 14 | загрузка, обработка, выдача и подтверждение отчётов артистам |
| `cron/` | 9 | плановые задачи: outbox Buildin, SFTP-плейлисты, аналитика, обложки, health форм |
| `analytics/` | 8 | стримы и аналитика по артистам |
| `forms/` | 7 | приём заявок с сайта: сессии, файлы, финализация |
| `playlists/` | 6 | плейлисты и попадания |
| `parsers/` | 6 | запуск и статус bandlink / vk |
| `admin/` | 5 | ops-ручки Buildin: сверка, реквей, обратная синхронизация, снимок KPI |
| `submit-pyrus-*` | 5 | легаси-эндпоинты форм; **имена сохраняются намеренно** ради стабильности URL (`docs/PYRUS_ARCHIVE.md:5`). При `PYRUS_WRITE_DISABLED` пишут в Buildin |
| `releases/`, `backups/`, `uploads/`, `auth/` | 9 | релизы, бэкапы, загрузка файлов, вход |
| одиночные | 11 | `koala-parser`, `zvonko-parser`, `vk-parser`, `bandlink`, `artists`, `users`, `payments`, `notifications`, `activities`, `vk` |

## Python-парсеры

Живут в `parsers/`, запускаются из TypeScript через `spawn('python3', ...)`. **Путь к скрипту
собирается строкой в рантайме**, поэтому из TS про них ничего нельзя вывести статически:

| откуда | что запускает |
|---|---|
| `app/api/koala-parser/route.ts:94,111` | `parsers/koala_releases_parser.py`, конфиг и вывод — JSON-файлы |
| `app/api/parsers/bandlink/route.ts:90-97` | `bandlink_parser_production_linux.py` или `..._mac.py` — выбор по платформе |
| `app/api/parsers/vk/route.ts:80-83` | `parsers/vk_parser_linux.py` |
| `app/api/zvonko-parser/route.ts:370-378` | `zvonko_linux_parser.py`, `compare_releases.py`, `add_new_releases.py` |
| `app/api/reports/process-python/route.ts:173,201` | `lib/python-report-processor.py` — обработка XLSX-отчётов |

Пишут в SQLite и JSON, оттуда их читает TypeScript.

## Внешние интеграции

| система | что делает | ключевые переменные |
|---|---|---|
| **Buildin** | зеркало данных и очереди форм; запись через outbox с ретраями | `BUILDIN_API_TOKEN`, `BUILDIN_API_BASE_URL`, `BUILDIN_DUAL_WRITE`, `BUILDIN_DB_*` |
| **Pyrus** | легаси-приём заявок, выключается флагом | `PYRUS_LOGIN`, `PYRUS_API_KEY`, `PYRUS_SECRET_KEY`, `PYRUS_WRITE_DISABLED` |
| **Supabase** | Postgres и Storage | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **SFTP** | выгрузки аналитики и плейлистов от дистрибьютора | `SFTP_HOST`, `SFTP_USERNAME`, `SFTP_PASSWORD`, `SFTP_REMOTE_PATH`, `SFTP_REMOTE_FLASH_PATH` |
| **VK / Яндекс.Музыка** | обложки плейлистов | `VK_PLAYLIST_COVER_ACCESS_TOKEN`, `YANDEX_MUSIC_OAUTH_TOKEN` |
| **Bright Data, 2captcha** | прокси и капча для парсеров; читаются **Python**, не TS | `BRIGHT_DATA_*`, `TWOCAPTCHA_API_KEY`, `PROXY_HOST`, `PROXY_PORT` |
| **Sentry** | ошибки, подключается только при заданном DSN (`instrumentation.ts:15`) | `SENTRY_DSN` |

## Плановые задачи

Их **две независимые системы, и обе могут работать одновременно**:

- **Системный `crontab`** — 5 записей: koala дважды в день, zvonko раз в день,
  `scripts/cron-sftp.sh` дважды в день, outbox Buildin каждые 5 минут
- **Внутрипроцессный планировщик** `lib/scheduler.ts` — подключается из `instrumentation.ts:27`
  только при `ENABLE_IN_PROCESS_SCHEDULER === 'true'`

`.env.example:70` ставит этот флаг в `true`, а `entrypoint.sh` запускает `crond` безусловно.
Кто следует шаблону окружения — получает двойные запуски парсеров.

## Что здесь легаси

- **Pyrus** вытесняется Buildin. Маршруты `submit-pyrus-*` живы, но при `PYRUS_WRITE_DISABLED`
  пишут в Buildin, а не в Pyrus
- **JSON-«база» в `data/`** — остаток эпохи до Prisma. Живыми остались только пять файлов
  рантайм-состояния, перечисленных выше
- **Мёртвая поверхность `lib/storage.ts`** — 15 экспортов фасада не вызываются ниоткуда.
  Не удалены намеренно: среди них `updateReportAcknowledgedStatus`, готовая замена для обхода
  из `app/api/reports/acknowledge/route.ts:56`
- **`components/missing-contract-banner*.tsx`** не смонтирован нигде, хотя
  `openspec/specs/report-processing/spec.md:145` описывает его как живой. Скорее регресс, чем
  мёртвый код — не установлено, какой из двух источников прав

## Тесты

21 unit-файл (`npx tsx --test`), 2 интеграционных, 1 e2e Playwright. Покрывают **только формы,
Buildin и форматирование**. Дашборд, релизы, отчёты, плейлисты и парсеры не покрыты ничем.

**Конфига ESLint в репозитории нет**, хотя `eslint` стоит в devDependencies — `pnpm lint` уходит
в интерактивный мастер и падает.
