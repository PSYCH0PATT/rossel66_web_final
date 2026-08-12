<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Работа в этом репозитории

Next.js 14 App Router + Postgres через Prisma + Python-парсеры. Лендинг с формами заявок и личные
кабинеты артиста и админа. Подробности — в `ARCHITECTURE.md`, здесь только то, что нужно, чтобы
не сломать ничего с первого захода.

## Где что лежит

| путь | что там |
|---|---|
| `app/` | страницы и 80 API-маршрутов. Кабинет под `app/dashboard/`, формы под `app/forms/` |
| `lib/` | вся бизнес-логика. `lib/buildin/` — интеграция с Buildin, `lib/pyrus*` — легаси-приём заявок |
| `components/` | React-компоненты. `components/ui/` — shadcn, управляется CLI |
| `hooks/` | два живых хука: `use-mobile-detector.ts`, `useScaling.ts` |
| `prisma/` | схема на 19 моделей и миграции |
| `parsers/` | Python: koala и zvonko, 4 скрипта. Bandlink и VK удалены в августе 2026 |
| `scripts/` | 45 рабочих скриптов, все заявлены в `package.json` или CI |
| `scripts/archive/` | 31 одноразовый скрипт без ссылок. Не трогать, не «оживлять» — см. README внутри |
| `docs/` | runbook-документы. `CLEANUP_AUDIT.md` — инвентаризация от 31.07.2026 |

## Слой данных: что канон

**Для новых фич пишите через Prisma напрямую.** `lib/storage.ts` — не второй слой хранения,
а фасад над той же базой, покрывающий четыре модели: `user`, `release`, `report`, `activity`.

**Но если трогаете эти четыре модели на запись — идите через `lib/storage.ts`.** У его функций
записи есть два побочных эффекта, которых нет у прямого `prisma.*`:
ревалидация ISR-кэша дашбордов и постановка в очередь зеркала Buildin. Прямая запись их теряет
молча, без ошибки.

Не трогайте вообще: живые JSON в `data/` — это рантайм-состояние, пишется Python и планировщиком.

## Как запускать

```
pnpm dev                 # дев-сервер на :3000
pnpm build               # prisma generate && next build
pnpm test                # 21 unit-файл через tsx --test
pnpm exec tsc --noEmit   # типы; см. про две известные ошибки ниже
npx playwright test      # e2e, нужен поднятый сервер и заполненный .env.e2e.local
```

`pnpm lint` и `pnpm exec tsc --noEmit` оба зелёные — держите их такими, теперь это осмысленный
гейт. У линтера остаются 30 предупреждений (в основном `<img>` вместо `next/image` и
зависимости хуков); ошибок нет. Правило `react/no-unescaped-entities` выключено намеренно:
интерфейс русскоязычный, и экранирование кавычек в тексте сделало бы исходники нечитаемыми.

Парсеры запускаются не напрямую, а через API: `POST /api/koala-parser` и
`POST /api/zvonko-parser`. Плейлисты приходят по SFTP (`/api/cron/playlists-sftp`), обложки к ним
подтягивает `/api/cron/playlist-covers`.

## Конвенции, которые видны в коде

- Комментарии и пользовательские строки — по-русски, имена символов — по-английски
- Псевдоним `@/` указывает в корень проекта (`next.config.mjs:59`)
- API-маршруты проверяют доступ сами: `requireAdmin()` из `lib/server-auth.ts`,
  для крон-эндпоинтов — `lib/cron-auth.ts`. `middleware.ts` в проекте нет
- Кабинет защищён на уровне layout: `getSessionUser()` + `redirect`, а не на уровне страниц
- Запись в Buildin идёт через outbox с ретраями (`lib/buildin/outbox.ts`), а не синхронно
- Тесты лежат рядом с кодом как `*.test.ts` и запускаются нодовским тест-раннером

## Ловушки

Каждая проверена на актуальность в августе 2026.

**Запись мимо `lib/storage.ts` теряет зеркало и ревалидацию.** Уже есть доказанный случай:
`app/api/reports/acknowledge/route.ts:56` пишет сырым `prisma.report.update`, и подтверждение
отчёта до Buildin не доходит. Готовая замена — `updateReportAcknowledgedStatus` в фасаде.
Не повторяйте этот паттерн в новом коде.

**Переименование экспорта `StreamingChart` молча ломает график.** `components/streaming-chart-lazy.tsx:17`
извлекает его строкой внутри динамического импорта: `.then((mod) => mod.StreamingChart)`.
Ошибки типов не будет — сломается в рантайме.

**Расписание живёт только в `crontab`.** `ENABLE_IN_PROCESS_SCHEDULER` в `.env.example`
теперь `false`: `entrypoint.sh` запускает `crond` безусловно, и при `true` каждая задача шла
дважды. Новые периодические задачи добавляйте в `crontab`, а не в `lib/scheduler.ts` — иначе
на проде они просто не запустятся.

**`prisma migrate deploy` падает на пустой базе.** Ни в одной миграции нет
`CREATE TABLE "StreamAnalytics"`, хотя три миграции эту таблицу используют — её создавали в
Supabase руками. `entrypoint.sh:30` выполняет `pnpm db:migrate` при каждом старте контейнера.

**`types/ssh2-sftp-client.d.ts` не мёртвый**, хотя входящих импортов у него ноль. Это ambient-типы,
подключаются через `tsconfig.json` `include`. Без него `tsc` падает в трёх живых модулях.
То же правило для любого `*.d.ts`.

**Про `parsers/` ничего нельзя вывести из TypeScript.** Пути к Python-скриптам и именам `.db`
собираются строкой в рантайме по платформе. Прежде чем объявлять что-то в `parsers/` мёртвым,
проверьте grep'ом по строкам, а не графом импортов.

**`components/ui/` управляется CLI shadcn.** Файлы добавляются и удаляются по имени через
`npx shadcn add <name>`. Полная экспортная поверхность компонента — это контракт, не сужайте её.

**Маршруты `submit-pyrus-*` выглядят мёртвыми, но их нельзя удалять.**
`docs/PYRUS_ARCHIVE.md:5` требует сохранить имена ради стабильности URL; при отключённом Pyrus
они пишут в Buildin. То же с `app/api/cron/forms-health/route.ts` — его дёргает CI по URL из
секрета, литерального пути в репозитории нет.

## Чего в репозитории нет

`middleware.ts` и seed для Prisma. Тесты покрывают только формы, Buildin и форматирование —
дашборд, релизы, отчёты, плейлисты и парсеры не покрыты, зелёный билд там означает лишь
«типы сошлись».
