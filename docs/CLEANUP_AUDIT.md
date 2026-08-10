# CLEANUP_AUDIT — инвентаризация репозитория

Аудит read-only. Ветка `cabinet-functional-fixes`, рабочее дерево с незакоммиченными правками.
Даты/пути на момент прогона. Ничего не удалено, не перемещено, не отредактировано.

Фактические размеры (`git ls-files` + `wc -l`): app 30 734 / 153 файла, lib 19 062 / 125,
components 16 670 / 126, scripts 6 887 / 57, hooks 338 / 4, tests 2 073 / 7, types 20 / 1.
Всего в git 1 470 файлов. 91 route.ts, 46 page.tsx, 19 моделей Prisma, 71 prod-зависимость.

**Легенда уверенности**
- **SAFE** — доказано статически, обратных ссылок нет вообще.
- **LIKELY** — ссылок не видно, но есть динамика / строковые пути / рефлексия.
- **RISKY** — подозрительно, но нужен человек.

---

## 0. Две поправки к вводным

Обе «известные проблемы» из постановки задачи проверены и одна из них сформулирована неверно.

| Утверждение из задачи | Что на самом деле | Доказательство |
|---|---|---|
| «Сосуществуют два слоя хранения — Prisma и lib/storage.ts, недоделанная миграция» | **Неверно.** `lib/storage.ts` — это фасад **поверх Prisma**, а не отдельное хранилище. Разсинхрона данных между двумя БД быть не может: база одна. | `lib/storage.ts:2-3` — `import { Prisma } from '@prisma/client'`, `import { prisma } from './prisma'`. Grep по `fs.`/`readFile`/`writeFile`/`path.join`/`.json` внутри `lib/storage.ts` → **0 совпадений**. 49 вызовов `prisma.*`, 4 модели: `user`, `release`, `report`, `activity`. |
| «ARCHITECTURE.md не упоминает Prisma» | Проверяется в разделе 6 (агент документации). | см. раздел 6 |

**Реальная проблема на границе слоёв — не рассинхрон данных, а обход побочных эффектов.**
Подробно в разделе 3. Отдельно: **третий слой хранения существует и он живой** — SQLite-файлы
`bandlink_playlists.db` / `vk_playlists.db`, которые пишет Python и читает TS.

---

## 1. Артефакты и мусор в git

Методическая заметка: `git check-ignore` по умолчанию **не показывает отслеживаемые файлы**.
Полный список «залито до появления правила» получен через
`git ls-files -z | git check-ignore --no-index --stdin -v -z` — это §1.9.

Заметка о «битых именах»: записи вида `"antigravity-landing` и `"БЕЗОПАСНЫЙ_ПАРСЕР.md` в выводе
`git ls-files` — **не сломанные файлы**, а C-квотирование не-ASCII байт. Проверено через
`git ls-files -z | tr '\0' '\n'`: каталог `antigravity-landing/` ровно один, 9 файлов.
Настоящие битые имена — только 2 штуки, см. §1.6.

### 1.1 Дампы parsers/ — HTML

290 отслеживаемых `.html`, ни одно правило .gitignore их не покрывает. Суммарно ~9.0 МБ вместе с JSON.

| путь / шаблон | кол-во | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|---|
| `parsers/zvonko_release_{1..280}.html` | 280 | подампы страниц релизов | да | 4.4 МБ | пишутся, никогда не читаются: `parsers/zvonko_full_parser.py:294`, `zvonko_improved_parser.py:331`, `zvonko_analyzer.py:418` | SAFE |
| `parsers/sour_diesel_response_20251016_{162216,162241,162702,162718}.html` | 4 | дампы HTTP-ответов bandlink, 4 идентичные копии | да | 671 КБ × 4 | write-only `parsers/test_bandlink_mac.py:257` | SAFE |
| `parsers/zvonko_releases_page.html` | 1 | дамп списка релизов | да | 284 КБ | write-only `zvonko_analyzer.py:300` | SAFE |
| `parsers/zvonko_releases_analysis.html` | 1 | побайтно идентичен предыдущему (291293 б) | да | 284 КБ | write-only `simple_dom_analyzer.py:135` | SAFE |
| `parsers/zvonko_pagination_analysis.html` | 1 | третья копия той же страницы (291293 б) | да | 284 КБ | write-only `pagination_analyzer.py:149`, `pagination_analyzer_fixed.py:130` | SAFE |
| `parsers/zvonko_login_page.html` | 1 | дамп страницы логина | да | 5.8 КБ | write-only `zvonko_analyzer.py:96` | SAFE |
| `parsers/zvonko_login_analysis.html` | 1 | идентичен предыдущему (5902 б) | да | 5.8 КБ | write-only `simple_dom_analyzer.py:41` | SAFE |
| `parsers/zvonko_first_release.html` | 1 | обрезанный фрагмент | да | 572 Б | ссылок нет | SAFE |

### 1.2 Дампы parsers/ — JSON

| путь / шаблон | кол-во | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|---|
| `parsers/zvonko_release_{1..280}_data.json` | 280 | JSON по каждому релизу | да | 1.1 МБ | write-only: `zvonko_full_parser.py:305`, `zvonko_improved_parser.py:268`, `zvonko_analyzer.py:564` | SAFE |
| `parsers/zvonko_release_data.json` | 1 | заглушка, литерально `{}` | да | **2 Б** | ссылок нет | SAFE |
| `parsers/zvonko_all_releases_full.json` | 1 | агрегированный вывод | да | 70 КБ | **читается** `parsers/compare_releases.py:31` | **LIKELY** |
| `parsers/zvonko_all_releases_data.json` | 1 | старый агрегат | да | 5.5 КБ | write-only `zvonko_improved_parser.py:343` | SAFE |
| `parsers/zvonko_dom_analysis.json` | 1 | дамп структуры DOM | да | 188 КБ | write-only `simple_dom_analyzer.py:163` | SAFE |
| `parsers/zvonko_parser_status.json` | 1 | статус-файл (не путать с живым `data/zvonko_parser_status.json`) | да | 260 Б | ссылок на этот путь нет | LIKELY |
| `parsers/comparison_results.json` | 1 | вывод `compare_releases.py` | да | 132 КБ | ссылок нет | SAFE |
| `parsers/koala_output.json` | 1 | вывод koala-скрапера | да | 755 КБ | ссылок нет | SAFE |
| `parsers/koala_add_report.json` | 1 | отчёт импорта | да | 171 Б | ссылок нет | SAFE |
| `parsers/add_releases_report.json` | 1 | отчёт импорта | да | 1.3 КБ | ссылок нет | SAFE |
| `parsers/{bandlink_config_mac,bandlink_config_unlocker,test_config_mac,test_config_mac_residential,test_config_mac_simple,brightdata_test_config}.json` | 6 | конфиги парсеров, поля учёток **пустые**; у каждого есть отслеживаемый `.json.example`-двойник | да | 32–172 Б | дублируются `parsers/*.json.example` | LIKELY |
| `parsers/{koala_config.example,bandlink_config_example}.json` | 2 | шаблоны | да | мелкие | нужны как образцы | RISKY (оставить) |
| `parsers/koala_config.json` | 1 | **живые учётные данные портала** | да | 147 Б | грузится koala-парсером; 1 поле `password` | **RISKY (секрет)** |
| `parsers/{koala_cover_test,small_test_cover,koala_cover_short,test_cover_data_url}.txt` | 4 | base64-дампы обложек | да | 51/12/2/3 КБ | ссылок нет | SAFE |
| `parsers/mac_test_env/` | — | питоновский venv внутри parsers/ | нет | **34 МБ** | правила .gitignore нет | SAFE (+ добавить правило) |
| `parsers/__pycache__/` | — | байткод | нет | 120 КБ | `.gitignore:48` | SAFE |

### 1.3 `*.db` — 6 из 7 отслеживаются вопреки `*.db` в .gitignore

`.gitignore` содержит `*.db` дважды (строки 51 и 76), но для этих файлов правило не действует:
они закоммичены раньше. **Для отслеживаемых файлов .gitignore не работает вообще.**

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `bandlink_playlists.db` | SQLite, плейлисты Bandlink | **да** | 40 КБ | **живой**: `lib/parser-status-sqlite-bridge.ts:8` читает его; `lib/backup.ts:85,122` архивирует; `docker-compose.parser.yml:11` bind-mount; `parsers/bandlink_parser*.py` (6 файлов), `parsers/init_cookies_db.py:15,83` | **RISKY** |
| `vk_playlists.db` | SQLite, плейлисты VK | **да** | 40 КБ | **живой**: `app/api/parsers/vk/route.ts:282` читает/пишет; `lib/backup.ts:86,122`; `docker-compose.vk-parser.yml:9`; `parsers/vk_parser.py:34` | **RISKY** |
| `bandlink_playlists_mac.db` | прогон на mac | **да** | 28 КБ | `parsers/bandlink_parser_mac.py:42`, `bandlink_parser_production_mac.py:42`, `run_mac_test.py:121` | LIKELY |
| `bandlink_playlists_brightdata_mac.db` | прогон | **да** | 16 КБ | `parsers/bandlink_parser_brightdata_mac.py:124` | LIKELY |
| `bandlink_playlists_browser_api_mac.db` | прогон | **да** | 16 КБ | `parsers/bandlink_parser_browser_api_mac.py:97` | LIKELY |
| `parsers/bandlink_playlists_mac.db` | дубль корневого mac-файла | **да** | 28 КБ | ссылок с префиксом `parsers/` нет | LIKELY |
| `sftp_playlists.db` | SQLite, SFTP | нет | 24 КБ | ссылок нет, корректно игнорируется | SAFE |

### 1.4 Тяжёлые каталоги

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `backups/README.md` | док | **да** (вопреки `/backups/`) | 1.3 КБ | ссылок нет | LIKELY |
| `backups/backup_2025-10-10_01-21-45.zip` | zip всей JSON-БД; по `lib/backup.ts:78-84` внутри `users.json` **с паролями** | **да** | 724 КБ | ссылок на имя нет | **RISKY (секрет)** |
| `backups/db/backup_20260215_011948.json` | дамп | нет | — | — | SAFE |
| `data/` (26 файлов в git из 30 на диске) | легаси-JSON-«БД» | частично | 14 МБ | **частично живой**, разбор ниже | **RISKY** |
| `data/releases_backup_*.json` (12 шт: 1768468575, 1768482849, 1768482992, 1768483138, 1768483156, 1769003765, 1769003805, 1769041053, 1769042741, 1769081481, 1769081826, 1769811982) | снимки | **да, все 12** | ≈5.4 МБ | только генераторы, читателей нет: `parsers/fix_koala_dates.py:44`, `add_only_koala_releases.py:88`, `add_new_releases.py:311` | SAFE |
| `data/releases_backup_1776287102.json` | 13-й снимок | нет | 1.1 МБ | те же генераторы | SAFE |
| `data/users_backup_*.json` (5 шт: 1768483789, 1768484130, 1768484137, 1768484578, 1768484764) | снимки пользователей **с паролями открытым текстом** | **да, все 5** | ≈4.8 МБ | генераторы: `parsers/add_simple_fields.py:17`, `update_artists_info.py:309`, `fix_artists_final.py:22`, `fix_artists_profiles.py:22` | **RISKY (секрет)** |
| `data_backup_20260210/` | снимок всего `data/`, 26 файлов, внутри пароли | нет | **13 МБ** | ссылок нет, игнорируется | SAFE (стереть локально) |
| `chrome_profiles/` | 2168 файлов, профили Selenium | нет | **64 МБ** | `.gitignore:47` | SAFE |
| `venv_selenium/` | 1816 файлов, venv | нет | **41 МБ** | **правила нет** | SAFE (+ правило) |
| `test_env/` | 2368 файлов, venv | нет | **56 МБ** | **правила нет** | SAFE (+ правило) |
| `.venv/` | 5600 файлов | нет | **118 МБ** | `.gitignore:50` | SAFE |
| `sftp_downloads/` | 162 файла, `rossel_flash_2026_*.csv` | только `.gitkeep` | 3.2 МБ | рантайм-каталог синка | LIKELY (оставить `.gitkeep`) |
| `.tmp/` | 10 файлов, логи миграции buildin | нет | 40 КБ | `.gitignore:80` | SAFE |
| `tmp/` | **140 неотслеживаемых и НЕигнорируемых** файлов: `crm-ru-labels-prod-*`, `form-queue-schema-*`, `form-submissions-migrate-*`, `forms-crm-audit-*`, `e2e-prove-run-2026-07-31.md` | нет | 868 КБ | **правила нет** — это 93 % от 151 «попадёт в коммит» файла | SAFE (+ правило) |
| `logs/`, `reports/`, `uploads/` | пустые каталоги без `.gitkeep` | нет | 0 Б | правила нет | SAFE |
| `.pnpm-store/`, `playwright-report/`, `test-results/`, `.vercel/` | кэши/отчёты | нет | — | игнорируются корректно | SAFE |
| `.git/` | — | — | **99 МБ** — раздут перечисленными дампами и БД | — | — |

### 1.5 Логи

`.gitignore` покрывает только `npm-debug.log*`, `yarn-*.log*`, `.pnpm-debug.log*`. **Правила `*.log` нет** — поэтому 6 логов в git.

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `parser_output.log` | stdout парсера | **да** | 1168 Б | ссылок нет | SAFE |
| `test_output.log` | stdout тестов | **да** | **37 Б** | ссылок нет | SAFE |
| `zvonko_parser_test.log` | **пустой файл** | **да** | **0 Б** | ссылок нет | SAFE |
| `parsers/zvonko_full_parser.log` | лог скрапера | **да** | **368 КБ** | ссылок нет | SAFE |
| `parsers/zvonko_improved_parser.log` | лог | **да** | 29 КБ | ссылок нет | SAFE |
| `parsers/zvonko_analyzer.log` | лог | **да** | 6.4 КБ | ссылок нет | SAFE |
| `.tmp/buildin-checkpoint/{run,relations-live,relations-dry-run}.log` | логи миграции | нет | мелкие | игнорируются | SAFE |

### 1.6 Файлы с битыми именами — ровно 2

Оба — результат неудачного шелл-редиректа: JSON-ответ об ошибке попал в имя файла.

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `{"success":false,"error":"Python процесс.ini` | обрезанный JSON-ответ API как имя файла; внутри — текст ошибки парсера | **да**, индекс: `"{\"success\":false,\"error\":\"Python \320\277\321\200\320\276\321\206\320\265\321\201\321\201.ini"` | **898 КБ** | ссылок нет | SAFE |
| `{"success":false,"error":"Python процесс_extracted.html` | то же происхождение; внутри настоящий `<!DOCTYPE html>` | **да** | **671 КБ** | ссылок нет | SAFE |

### 1.7 Офисный мусор и текстовые дампы в корне

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `123.doc` | **не Word** — MHTML-экспорт из Confluence, `Date: Tue, 23 Sep 2025 15:39:08` | **да** | **2.4 МБ** — крупнейший отслеживаемый мусорный файл | ссылок нет | SAFE |
| `321.doc` | то же, экспорт Confluence | **да** | 313 КБ | ссылок нет | SAFE |
| `ROSSEL66_SITE_CONTENT.txt` | текстовый дамп копирайта сайта | **да** | 34 КБ | ссылок нет | SAFE (можно перенести в `docs/`) |
| `Q42025 - ROSSEL 66 (подробный).xlsx`, `shablon.xlsx`, `Отчёт MENDXZA.xlsx`, `Отчёт шаблон (1).xlsx` | отчёты/шаблоны | нет | 255/305/73/10 КБ | `.gitignore:62:*.xlsx` | SAFE |
| `4c1c78d1-5618-4016-bb8c-52f1bf4670a1.txt` | лог CI-сборки | нет | 146 КБ | `.gitignore:64` | SAFE |
| `lib/templates/report-mendxza.xlsx` | **настоящий шаблон отчёта** | **да** | — | явно разигнорирован `.gitignore:63:!lib/templates/*.xlsx` | **RISKY (оставить)** |

### 1.8 Корневые одноразовые скрипты и конфиги

Все 17 TS/JS-«тестов» отслеживаются, ни один не импортируется, ни один не упомянут в
`package.json`, `tsconfig.json`, `playwright.config.ts`.

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `test.ts`, `test2.ts`, `test3.ts`, `test4.ts`, `test5.ts`, `test6.ts`, `test7.ts`, `test8.ts`, `test9.ts` | черновики | **да** | 194–372 Б | ссылок нет | SAFE |
| `test-api.ts`, `test-base64.ts`, `test-fetch.ts`, `test-fetch-list.ts`, `test-fetch-list2.ts`, `test-fetch-list3.ts`, `test-prisma-dates.ts`, `test-sort.js` | черновики | **да** | 341–1240 Б | ссылок нет | SAFE |
| `test_proxy.py`, `test_proxy_docker.py` | смоук прокси | **да** | 5108/2312 Б | ссылок нет | SAFE |
| `App.tsx` | корневой компонент в стиле CRA/Vite, импортирует `./examples/ExamplePage` и `./App.css`. В App Router мёртв | **да** | 186 Б | никто не импортирует `App` | SAFE |
| `App.css` | его стили | **да** | 859 Б | только `App.tsx:2` | SAFE (удалять вместе) |
| `sftp_analysis_report.json` | вывод разового анализа | **да** | 8405 Б | **пишется** `scripts/analyze-sftp-files.ts:154`, не читается | SAFE |
| `zvonko_all_releases_full.json` (корневая копия) | дубль `parsers/`-версии | **да** | 8761 Б | ссылки резолвятся в `parsers/` или script-relative | LIKELY |
| `test_selenium_mac.json` | **живые учётки Bright Data** | **да** | 232 Б | ссылок нет | **RISKY (секрет)** |
| `temp_bandlink_config.json` | **живые прокси-учётки + сессионные куки** | **да**, вопреки `.gitignore:52:temp_*_config.json` | 864 Б | **используется при сборке**: `Dockerfile.parser:31,37` `COPY`; `parsers/run_mac_test.py:28,83`; `parsers/bandlink_parser_mac.py:966,979`; `scripts/test_parser_docker.sh:28`. Приложение генерирует свой в `os.tmpdir()` — `app/api/parsers/bandlink/route.ts:74` | **RISKY (секрет + зависимость Docker-сборки)** |
| `debug_editing_page.html` | сохранённая страница для отладки; единственный `debug_*.html` в репо | **да** | 50 КБ | ссылок нет | SAFE |
| `deploy-logs-173375-2026-04-15T23_04_52.747Z.txt` | экспорт логов Vercel; единственный такой | нет | 101 КБ | `.gitignore:57` | SAFE |

### 1.9 Каталоги, похожие на чужие проекты

Ключевая проверка: из `app/`, `components/`, `lib/` **нет ни одного импорта** в `examples/`,
`landing-export/`, `antigravity-landing/`, `design/`, `screens new/`. Исключение — `hooks/`.

| путь | что это | в git | размер | доказательство | увер. |
|---|---|---|---|---|---|
| `examples/` (`ExamplePage.tsx`, `ExamplePage.module.css`) | демо-страница | **да** (2) | 8 КБ | входящие — только `App.tsx:1` | SAFE (удалять вместе с `App.tsx`/`App.css`) |
| `landing-export/` (19 файлов) | **полная параллельная копия лендинга** (`page.tsx`, `layout.tsx`, `globals.css`, `hero.tsx`, `navbar.tsx`, `footer.tsx`, `tailwind.config.js`…), дублирует `app/` + `components/` | **да** | 240 КБ | 0 совпадений `landing-export` во всём репо | SAFE |
| `antigravity-landing/` (9 .md) | планы **другого продукта** (`00_READ_ME_FIRST.md`, `01_ПОНИМАНИЕ_ANTIGRAVITY.md` … `08_ИТЕРАЦИИ_И_ФИКСЫ.md`) | **да** | 104 КБ | 0 совпадений `antigravity` (без учёта регистра) | SAFE |
| `design/` (19 файлов: 9 макетов `code.html` + `screen.png`, плюс затесавшийся `design/artist_streaming_analytics_2/rossel-music.code-workspace`) | референс-макеты | **да** | **7.5 МБ** | ссылок нет | SAFE |
| `screens new/` (2 HTML-макета; **пробел в имени каталога**) | макеты | **да** | 56 КБ | единственная ссылка — **в комментарии** `app/globals.css:1634`: размеры стат-карт «1:1 с screens new/dashboard-screen.html» | LIKELY |
| `hooks/` (`use-mobile-detector.ts`, `use-mobile.tsx`, `use-toast.ts`, `useScaling.ts`) | живые хуки | **да** (4) | 16 КБ | **15+ импортов**: `app/page.tsx:20`, `components/hero.tsx:9`, `facts-section.tsx:8`, `faq-section.tsx:9`, `artists-section.tsx:7`, `partners-section.tsx:8`, `navbar.tsx:14`, `mobile-scroll.tsx:5`, `smooth-scroll.tsx:4`, `contact-form-section.tsx:11`, `services-section.tsx:8`, `ScalableContainer.tsx:5-6`, `ui/toaster.tsx:3`, `ui/sidebar.tsx:8`, `styled/StyledScalableSection.tsx:6` | **RISKY — НЕ УДАЛЯТЬ** |

### 1.10 `.DS_Store`

**23 на диске, 0 в git.** Все покрыты `.gitignore:29`. В git делать нечего.
Пути: корень (22532 Б) и по 6148 Б в `data/`, `data/artists/`, `openspec/`, `design/`, `parsers/`,
`app/`, `app/forms/`, `app/dashboard/`, `app/api/`, `prisma/`, `prisma/migrations/`, `.agents/`,
`.agents/skills/`, `docs/`, `components/`, `components/styled/`, `public/`, `public/images/`,
`public/images/partners/`, `public/images/artists/`, `screens new/`, `lib/`.

### 1.11 Env-файлы

Отслеживание чистое: `.env`, `.env.local`, `.env.test.local`, `.env.e2e.local`, `.env.e2e.run.local`,
`.env.vercel.staging.local`, `.env.vercel.staging.secrets` — **все не в git**, все игнорируются.

| путь | в git | замечание | увер. |
|---|---|---|---|
| `.env.example` | **да** (вопреки `.env*`) | все значения пустые — намеренно | оставить |
| `docs/BUILDIN_DATABASE_IDS.env` | **да** | не покрыт `.env*` (правило по basename-префиксу). Внутри — только UUID продовых баз, токен вынесен | LIKELY |
| `docs/FORMS_E2E_DATABASE_IDS.env` | **да** | ID песочницы E2E | оставить |
| `docs/FORMS_STAGING.env.example` | **да** | плейсхолдеры | оставить |

### 1.12 Отслеживается вопреки .gitignore — полный список (39)

`.env.example` · `backups/README.md` · `backups/backup_2025-10-10_01-21-45.zip` ·
`bandlink_playlists.db` · `bandlink_playlists_brightdata_mac.db` · `bandlink_playlists_browser_api_mac.db` ·
`bandlink_playlists_mac.db` · `parsers/bandlink_playlists_mac.db` · `vk_playlists.db` ·
`temp_bandlink_config.json` · и все 26 файлов `data/*.json` (`activities.json`, `backups.json`,
`balances.json`, `koala_parser_status.json`, `releases.json`, `releases_backup_*.json` ×12,
`reports.json`, `sftp_sync_index.json`, `users.json`, `users_backup_*.json` ×5, `zvonko_parser_status.json`).

Ещё два попадают в тот же вывод, но это **отрицания** (то есть корректно НЕ игнорируются):
`lib/templates/report-mendxza.xlsx` и `sftp_downloads/.gitkeep`.

### 1.13 Секреты в отслеживаемых файлах — проверено лично

| путь | что утекло | в git | подтверждение | увер. |
|---|---|---|---|---|
| `data/users.json` | **пароли всех пользователей открытым текстом** + ПДн. `lib/backup.ts:78` сам это называет: «users.json (все данные пользователей + пароли)» | **да** | `git cat-file -e HEAD:data/users.json` → есть в HEAD; `grep -c '"password"'` → **45 записей** | **RISKY — нужна ротация + перезапись истории** |
| `data/users_backup_*.json` × 5 | ещё 5 полных копий тех же паролей | **да** | см. §1.4 | **RISKY** |
| `backups/backup_2025-10-10_01-21-45.zip` | zip с `users.json` внутри | **да** | подтверждено `git ls-files` | **RISKY** |
| `parsers/koala_config.json` | логин/пароль стороннего портала | **да** | подтверждено, 1 поле `password` | **RISKY** |
| `temp_bandlink_config.json` | прокси-учётки + сессионные куки | **да** | подтверждено | **RISKY** |
| `test_selenium_mac.json` | учётка Bright Data | **да** | ссылок нет | **RISKY** |

Чистые для сравнения: `parsers/bandlink_config_mac.json`, `bandlink_config_unlocker.json`,
`test_config_mac*.json`, `brightdata_test_config.json` — поля учёток **пустые**.

### 1.14 Дыры в .gitignore

Нет правил вообще: `venv_selenium/` (41 МБ), `test_env/` (56 МБ), `parsers/mac_test_env/` (34 МБ),
`tmp/` (868 КБ / 140 файлов), `logs/`, `reports/`, `uploads/`. Нет общего правила `*.log` — именно
поэтому в git лежат 6 логов из §1.5.

Неотслеживаемых и неигнорируемых файлов на момент прогона: **151**. Из них 140 — мусор в `tmp/`, а **11 —
реальная незавершённая работа, которую удалять нельзя**: `lib/buildin/form-*.ts`, `scripts/migrate-buildin-*.ts`,
`scripts/audit-buildin-forms-crm-separation.ts`, `scripts/setup-buildin-form-queues.ts`,
`docs/CLEANUP_PROMPTS.md`, `docs/BUILDIN_CRM_VIEW_CHECKLIST.md`.

> **Обновление после прогона.** Девять из этих одиннадцати закоммичены вместе с работой по очередям форм
> Buildin; `docs/CLEANUP_PROMPTS.md` и сам этот отчёт — следующим коммитом. Незакоммиченной реальной работы
> не осталось, неотслеживаемым остаётся только `tmp/`. Вывод раздела не меняется: правило на `tmp/` в
> `.gitignore` по-прежнему нужно, а остальные дыры (`venv_selenium/`, `test_env/`, `logs/`, `*.log`) открыты.

### 1.15 Сколько освободится

Отслеживаемый мусор без RISKY-строк и без `hooks/`: дампы parsers ~9.0 МБ + пара битых имён 1.5 МБ +
`123.doc`/`321.doc` 2.7 МБ + `design/` 7.5 МБ + `landing-export/` 240 КБ + `antigravity-landing/` 104 КБ +
логи ~405 КБ + `data/releases_backup_*` 5.4 МБ ≈ **27 МБ рабочего дерева** при **99 МБ `.git`**.

Удаление из HEAD уменьшает чекаут, но **не историю**. И размер `.git`, и утёкшие пароли требуют
перезаписи истории (`git filter-repo` / BFG) — иначе всё остаётся доступным.

---

## 2. Мёртвый код

### 2.0 Метод и четыре поправки к сводке агента

Граф импортов построен по 503 файлам `.ts/.tsx/.js/.mjs` в `app/ lib/ components/ scripts/ hooks/ types/ tests/`
плюс корневые конфиги. 206 корней-точек входа: все `app/**/{page,route,layout,loading,error,not-found,template}`,
`instrumentation.ts`, конфиги сборки, каждый `scripts/*.ts`, на который ссылается `package.json` /
`.github/workflows/*.yml` / `crontab` / `entrypoint.sh` / `scripts/*.sh`, все `*.test.ts` и `tests/**`.
`export *`-бочки и `await import()` — это рёбра графа, они пройдены.

`middleware.ts` в репозитории **нет**. `prisma.config.ts` не объявляет seed — точки входа Prisma seed тоже нет.

Три вещи, на которых наивный скан ошибается и которые здесь учтены: комментарии вырезаются до сопоставления
импортов (`app/page.tsx:19` — закомментированный импорт `simple-debug-indicator`, из-за него файл выглядит живым);
исключения каталогов применяются только на верхнем уровне (иначе `app/api/backups/` и `app/api/parsers/` выпадают
и ложно убивают `lib/backup.ts` и `lib/parser-run-history.ts`); переименовывающие реэкспорты разводятся вручную.

**Поправки.** Поиск сирот-экспортов исключал файл-определение — это верно для вопроса «кто импортирует извне»,
но даёт ложную картину «мёртвого модуля», когда символ работает внутри своего файла. Перепроверено скриптом по
всем 201 символу; четыре вывода пришлось развернуть, и один из них — **SAFE-вердикт, который сломал бы сборку**:

| Что было заявлено | Что на самом деле | Доказательство |
|---|---|---|
| `lib/api-perf-log.ts` — «модуль целиком недостижим в проде», **SAFE к удалению** | **Живой.** `jsonWithPerfLog` импортируют три роута. Удаление модуля ломает сборку | `app/api/releases/route.ts:7`, `app/api/playlists/sftp/route.ts:4`, `app/api/analytics/streams/route.ts:5`. Сироты — только внутренние `shouldLogApiPerf` / `logApiPerf` |
| `lib/report-acknowledgment.ts` — «вся публичная поверхность не используется, бизнес-правило не применяется» | **Правило применяется.** Публичный вход — `canAcknowledgeReports`, остальные четыре экспорта его внутренности | `app/api/reports/acknowledge/route.ts:5`, `components/artist-reports.tsx:6` |
| `lib/artist-report-requirements.ts` — «модуль целиком не используется, похоже на невыпущенную фичу» | **Импортируют 5 файлов.** Сироты — только `isArtistReadyForReport` и `formatMissingFieldsList` | `app/dashboard/admin/artists/admin-artists-client.tsx:12`, `app/api/artists/route.ts:13`, `app/api/reports/process-python/route.ts:30`, `components/report-processor.tsx:15`, `components/missing-contract-banner-client.tsx:10` |
| `components/ui/admin-select.tsx` — «Trigger без Content/Item → пустой выпадающий список, живой баг UI» | **Бага нет.** Страница рендерит `SelectContent`/`SelectItem` из обычного `components/ui/select.tsx` | `app/dashboard/admin/releases/admin-releases-client.tsx:340-345`. Реальная находка мельче: `AdminSelectContent`/`AdminSelectItem` импортированы (строка 8) и не использованы — плюс расхождение стилей внутри одного дропдауна |

То же касается тревожных пометок по `lib/buildin/`: `FORM_QUEUE_FORBIDDEN_COLUMNS` («защита от утечки PII, которую
никто не вызывает») используется в своём же файле трижды — `lib/buildin/form-contracts.ts:72,84,96`;
`assertClientFileQuotas` вызывается на `lib/buildin/form-session-client.ts:108`; карты `GENRE_LABELS`,
`YES_NO_LABELS`, `SOURCE_LABELS` и соседние подставляются через `labelFor` внутри `lib/buildin/labels.ts`.
Ни одной утечки и ни одного невызванного стража здесь нет.

### 2.1 Файлы без входящих ссылок — 128 файлов, ~13 800 строк

| область | файлов | комментарий |
|---|---|---|
| `components/` | 66 | из них 31 в `components/ui/` (всего в каталоге 52 файла) |
| `scripts/` | 49 | одноразовые ops/миграции, ни один не в `package.json`/CI/cron |
| `lib/` | 9 | |
| `hooks/` | 2 | |
| `app/` | 1 | |
| `types/` | 1 | **удалять нельзя**, см. 2.6 |

### 2.2 `components/` — лендинг и отладочные оверлеи (27)

| путь | строк | доказательство | уверенность | что сломается |
|---|---|---|---|---|
| `components/artists-section-debug.tsx` | 168 | нет входящих | SAFE | ничего |
| `components/compact-debug-panel.tsx` | 213 | нет входящих | SAFE | ничего |
| `components/debug-indicators.tsx` | 240 | нет входящих | SAFE | ничего |
| `components/simple-debug-indicator.tsx` | 206 | единственные ссылки — закомментированные импорты `app/page.tsx:19` и `landing-export/page.tsx:19` | SAFE | ничего |
| `components/mobile-artists-slider-debug.tsx` | 109 | нет входящих | SAFE | ничего |
| `components/height-comparison-indicator.tsx` | 81 | нет входящих | SAFE | ничего |
| `components/height-display.tsx` | 53 | нет входящих | SAFE | ничего |
| `components/height-ratio-indicator.tsx` | 63 | нет входящих | SAFE | ничего |
| `components/section-height-indicator.tsx` | 46 | нет входящих | SAFE | ничего |
| `components/section-overlay.tsx` | 70 | нет входящих | SAFE | ничего |
| `components/viewport-indicator.tsx` | 62 | нет входящих | SAFE | ничего |
| `components/width-indicators-container.tsx` | 84 | нет входящих; корень мёртвого поддерева из 4 файлов | SAFE | ничего |
| `components/scale-indicator.tsx` | 67 | мёртв только через `width-indicators-container.tsx` | SAFE | ничего |
| `components/section-border-lines.tsx` | 89 | то же | SAFE | ничего |
| `components/section-scale-indicator.tsx` | 92 | то же | SAFE | ничего |
| `components/section-width-indicator.tsx` | 46 | то же | SAFE | ничего |
| `components/ResponsiveScalableSection.tsx` | 98 | единственный импортёр — `examples/ExamplePage.tsx`, сам недостижимый | SAFE | ничего |
| `components/ScalableLayout.tsx` | 73 | то же | SAFE | ничего |
| `components/ScalableSection.tsx` | 112 | то же | SAFE | ничего |
| `components/styled/StyledScalableSection.tsx` | 78 | нет входящих | SAFE | ничего |
| `components/background-animation.tsx` | 68 | нет входящих; живой двойник в `landing-export/` | SAFE | ничего |
| `components/contact-section.tsx` | 310 (`@ts-nocheck`) | нет входящих; упомянут только в `landing-export/README.md` | SAFE | ничего |
| `components/floating-paper.tsx` | 80 (`@ts-nocheck`) | нет входящих; `AUDIT.md:122` уже помечает как дубль-заглушку `floating_paper.tsx` | SAFE | ничего |
| `components/robo-animation.tsx` | 44 (`@ts-nocheck`) | нет входящих | SAFE | ничего |
| `components/scroll-arrow.tsx` | 52 (`@ts-nocheck`) | нет входящих. **Но** `components/smooth-scroll-container.tsx:233` делает `document.querySelectorAll(".scroll-arrow")` — связь через CSS-класс, не импорт | SAFE | ничего (контейнер тоже мёртв) |
| `components/smooth-scroll-container.tsx` | 281 | нет входящих | SAFE | ничего |
| `components/mobile-scroll.tsx` | 73 | нет входящих | SAFE | ничего |

### 2.3 `components/ui/` — shadcn, не поставленные ни на одну страницу (30 из 52)

У всех ноль входящих импортов и нет возможности динамического импорта. Последней строкой добавлен
`components/theme-provider.tsx` — он лежит не в `components/ui/`, но принадлежит тому же блоку зависимостей.
Итого по каталогу `components/`: 27 (2.2) + 31 (эта таблица) + 8 файлов (2.4) = 66.

| путь | строк | доказательство | уверенность |
|---|---|---|---|
| `components/ui/sidebar.tsx` | 763 | приложение использует другой файл — `components/sidebar.tsx` | SAFE |
| `components/ui/chart.tsx` | 366 | нет входящих | SAFE |
| `components/ui/carousel.tsx` | 262 | нет входящих | SAFE |
| `components/ui/menubar.tsx` | 236 | нет входящих | SAFE |
| `components/ui/context-menu.tsx` | 200 | нет входящих | SAFE |
| `components/ui/use-toast.ts` | 194 | нет входящих; дубль `hooks/use-toast.ts` | SAFE |
| `components/ui/form.tsx` | 179 | нет входящих | SAFE |
| `components/ui/alert-dialog.tsx` | 141 | нет входящих | SAFE |
| `components/ui/sheet.tsx` | 140 | мёртв только через `ui/sidebar.tsx` | SAFE |
| `components/ui/toast.tsx` | 129 | мёртв только через `toaster.tsx`, `ui/use-toast.ts`, `hooks/use-toast.ts` — все мёртвые | SAFE |
| `components/ui/navigation-menu.tsx` | 128 | нет входящих | SAFE |
| `components/ui/drawer.tsx` | 119 | нет входящих | SAFE |
| `components/ui/pagination.tsx` | 117 | нет входящих | SAFE |
| `components/ui/breadcrumb.tsx` | 115 | нет входящих; `components/top-nav.tsx` собирает хлебные крошки вручную | SAFE |
| `components/ui/input-otp.tsx` | 72 | нет входящих | SAFE |
| `components/ui/toggle-group.tsx` | 61 | нет входящих | SAFE |
| `components/ui/accordion.tsx` | 58 | нет входящих | SAFE |
| `components/ui/avatar.tsx` | 50 | нет входящих | SAFE |
| `components/ui/scroll-area.tsx` | 48 | нет входящих | SAFE |
| `components/ui/resizable.tsx` | 46 | нет входящих | SAFE |
| `components/ui/toggle.tsx` | 45 | мёртв только через `ui/toggle-group.tsx` | SAFE |
| `components/ui/radio-group.tsx` | 44 | нет входящих | SAFE |
| `components/ui/toaster.tsx` | 35 | нет входящих; никогда не смонтирован в `app/layout.tsx` | SAFE |
| `components/ui/separator.tsx` | 31 | мёртв только через `ui/sidebar.tsx` | SAFE |
| `components/ui/sonner.tsx` | 31 | нет входящих — но `sonner` есть в `package.json` | LIKELY |
| `components/ui/hover-card.tsx` | 29 | нет входящих | SAFE |
| `components/ui/slider.tsx` | 28 | нет входящих | SAFE |
| `components/ui/use-mobile.tsx` | 19 | нет входящих; дубль `hooks/use-mobile.tsx` | SAFE |
| `components/ui/collapsible.tsx` | 11 | нет входящих | SAFE |
| `components/ui/aspect-ratio.tsx` | 7 | нет входящих | SAFE |
| `components/theme-provider.tsx` | 7 | нет входящих; обёртка `next-themes` не смонтирована, `AUDIT_DESIGN.md` фиксирует, что кабинет тёмный по решению | SAFE |

> **Важно для всего блока.** `components.json` — реестр shadcn с `"ui": "@/components/ui"`. Эти файлы
> управляются CLI по строковому имени: `npx shadcn add <name>` создаст их заново. Удаление безопасно в рантайме,
> но следом освобождаются соответствующие `@radix-ui/*` в `package.json` — это связывает данный шаг с разделом 4.

### 2.4 `components/` — функциональные (7)

| путь | строк | доказательство | уверенность | что сломается |
|---|---|---|---|---|
| `components/report-uploader.tsx` | 207 | нет входящих; `app/dashboard/admin/reports/page.tsx:4` импортирует **другой** — `simple-report-uploader` (254 строки, живой) | SAFE | ничего, вытеснен |
| `components/charts/TotalStreamChart.tsx` | 38 | нет входящих; соседний `DspStreamChart` жив через `next/dynamic`, для этого — ни одной цели динамического импорта | SAFE | ничего |
| `components/auth-check.tsx` | 18 | нет входящих. Но описан как живой в `API_DOCUMENTATION.md:63,816` и `openspec/specs/user-auth/spec.md:98`; `AUDIT.md:122` уже зовёт мёртвым | LIKELY | в рантайме ничего; три документа станут врать |
| `components/playlist-crawler-controls.tsx` | 70 | нет входящих | LIKELY | бэкенд `lib/playlist-crawler.ts` жив, но его `crawlArtistPlaylists` / `stopScheduledCrawling` / `isScheduledCrawlingActive` — сироты. Фича потеряла UI целиком |
| `components/playlist-crawler-initializer.tsx` | 19 | нет входящих | LIKELY | то же |
| `components/playlist-crawler-status.tsx` | 137 | нет входящих | LIKELY | то же |
| `components/missing-contract-banner.tsx` + `missing-contract-banner-client.tsx` | 3 + 113 | нет входящих (проверено: `MissingContractBanner` вне самих файлов не встречается). `openspec/specs/report-processing/spec.md:145` утверждает, что баннер смонтирован на странице отчётов | **RISKY** | Если фича должна быть живой — это **регресс, а не мёртвый код**. Клиентская половина импортирует живой `lib/artist-report-requirements.ts`. Нужно решение человека |

### 2.5 `lib/` (9)

| путь | строк | доказательство | уверенность | что сломается |
|---|---|---|---|---|
| `lib/report-generator.ts` | 319 (`@ts-nocheck`) | нет входящих; grep `lib/report-generator` по репозиторию — 0. Вытеснен `lib/python-report-processor.py`, который запускается из `app/api/reports/process-python/route.ts:173` | SAFE | ничего |
| `lib/excel-utils.ts` | 198 | нет входящих; дублирует `extractArtistsFromTrack` из `report-generator.ts` | SAFE | ничего |
| `lib/cached-admin-reports.ts` | 91 | нет входящих; живой аналог — `lib/cached-dashboard.ts` | SAFE | ничего |
| `lib/platform-partner-icon.ts` | 26 | нет входящих | SAFE | ничего |
| `lib/fetch-artist-releases-all.ts` | 21 | нет входящих | SAFE | ничего |
| `lib/buildin/index.ts` | 9 | бочка `export *` × 9, ноль импортёров. Все 9 целей имеют прямых импортёров — снятие бочки их не осиротит | SAFE | ничего |
| `lib/sftp-explorer.ts` | 258 | мёртв только через `scripts/explore-sftp.ts`, который сам мёртв | LIKELY | сломается только ручной запуск `npx tsx scripts/explore-sftp.ts` |
| `lib/sftp-downloader.ts` | 121 | мёртв только через `scripts/download-sftp.ts` | LIKELY | то же |
| `lib/sqlite3-lazy.ts` | 12 | нет входящих. Живые роуты инлайнят `require('sqlite3').verbose()` сами — `app/api/parsers/vk/route.ts:232,281`, `app/api/parsers/bandlink/route.ts:274,339` | LIKELY | Модуль существует, чтобы обойти падение сборки на нативном модуле. Дублирование его логики в роутах — и есть настоящая проблема. Решение человека |

### 2.6 `hooks/`, `types/`, `app/` (4)

| путь | строк | доказательство | уверенность | что сломается |
|---|---|---|---|---|
| `app/forms/forms-client.tsx` | 314 | почти-дубль `app/forms/page.tsx` (319 строк): те же `FormCard`, те же пружины, те же импорты. Не route-файл, значит не точка входа. Ноль входящих, grep `forms-client` вне файла — пусто | SAFE | ничего, живая копия — `app/forms/page.tsx` |
| `hooks/use-mobile.tsx` | 19 | мёртв только через `ui/sidebar.tsx`. Живой код использует **другой файл** — `hooks/use-mobile-detector.ts` | SAFE | ничего |
| `hooks/use-toast.ts` | 194 | мёртв только через `ui/toaster.tsx` | SAFE | ничего |
| `types/ssh2-sftp-client.d.ts` | 20 | ambient `declare module`, входящих импортов нет **по устройству** — подхватывается через `tsconfig.json` `include`. Проверено: у `ssh2-sftp-client` нет своих `.d.ts`, в `node_modules/@types/` пакета нет | **RISKY — не удалять** | `pnpm exec tsc --noEmit` падает в `lib/sftp-connect.ts`, `lib/sftp-playlist-sync.ts`, `lib/analytics-flash-import.ts` — все живые. Не используется только экспорт `SftpFileInfo` внутри файла |

### 2.7 `scripts/` — 49 одноразовых (все LIKELY, не SAFE)

Ни один не упомянут в `package.json`, `.github/workflows/*.yml`, `crontab`, `entrypoint.sh` или `scripts/*.sh`.
Запускаются руками через `npx tsx`, а историю команд оператора статический анализ не видит — поэтому **ни одного SAFE**.

**Не удалять без явного решения (упомянуты в runbook-документах):**

| путь | строк | где упомянут | уверенность |
|---|---|---|---|
| `scripts/migrate-to-supabase.ts` | 303 | `SUPABASE_SETUP.md` | RISKY |
| `scripts/setup-buildin-form-databases.ts` | 16 | `docs/FORMS_TESTING.md` | RISKY |

**Остальные 47** — по убыванию размера, все LIKELY:
`import-all-flash.ts` (259) · `split-merged-artist-users.ts` (257) · `download-sftp-last5-and-tables.ts` (192) ·
`analyze-sftp-files.ts` (184) · `fix-release-artists.js` (177) · `scrape-covers.js` (163) ·
`fix-releases-direct.js` (157) · `test-koala-parser.js` (144) · `analyze-flash-vs-supabase.ts` (138) ·
`setup-buildin-databases-shared.ts` (136, вытеснен `setup-buildin-databases.ts`, который **есть** в `package.json`) ·
`show-parser-results.js` (135) · `fix-activity-user-ids.ts` (135) · `download-flash-latest.ts` (133) ·
`fix-releases-complete.js` (131) · `enrich-features-from-report.js` (121) · `fix-report-artist-ids.ts` (120) ·
`check-supabase-storage.ts` (120) · `assign-artist-data.ts` (119) · `test-parsers-statuses.js` (116) ·
`audit-buildin-forms-crm-separation.ts` (116) · `test-parser-statuses.js` (111) · `test-sftp-playlist-sync.ts` (109) ·
`cleanup-duplicate-reports.ts` (95) · `checkpoint-buildin-workspace.ts` (90) · `test-sftp-flash-connection.ts` (87) ·
`migrate-dates-isrcs.ts` (85) · `migrate-passwords.js` (84) · `fix-release-statuses.js` (83) ·
`migrate_release_statuses.js` (79) · `assign-releases-to-auto-artists.ts` (64) · `test-supabase-storage.ts` (64) ·
`test-status-normalization.js` (63) · `find-orphans.ts` (62) · `fix-empty-tracks.ts` (58) ·
`cleanup-duplicate-releases.ts` (57) · `explore-sftp.ts` (56, единственный импортёр `lib/sftp-explorer.ts`) ·
`download-sftp.ts` (46, единственный импортёр `lib/sftp-downloader.ts`) · `analyze_missing_releases.ts` (44) ·
`update-moderated-to-delivered.js` (43) · `fix_orphaned_releases.ts` (34) · `test-supabase.ts` (34) ·
`analyze_tracks.ts` (31) · `rematch-analytics-artists.ts` (31) · `check_tracks_type.ts` (23) ·
`search_ohla.ts` (19, отладка под конкретного артиста) · `check_ohla_exact.ts` (13, то же) · `check_user.ts` (13)

> `scripts/audit-buildin-forms-crm-separation.ts` на момент прогона аудита не отслеживался git — сейчас
> отслеживается: закоммичен вместе с работой по очередям форм Buildin. Пометку «untracked» из отчёта агента
> считать снятой.

### 2.8 Корневые файлы вне заявленного объёма, но явно хлам

Все отслеживаются git, ни один ничем не импортируется: `App.tsx`, `test.ts`, `test2.ts`…`test9.ts`, `test-api.ts`,
`test-base64.ts`, `test-fetch.ts`, `test-fetch-list.ts`, `test-fetch-list2.ts`, `test-fetch-list3.ts`,
`test-prisma-dates.ts`, `test-sort.js`. Плюс `examples/ExamplePage.tsx` — единственный импортёр трёх `Scalable*`,
сам недостижим. Уверенность SAFE. Заметьте: `tsconfig.json` с `include: ["**/*.ts","**/*.tsx"]` означает, что
CI их всё это время типизирует.

### 2.9 Экспорты-сироты — 59 настоящих

Ни одной ссылки нигде, включая собственный файл. Проверено по каждому символу: `\bИМЯ\b` по всем
`.ts/.tsx/.js/.jsx/.mjs` в `app/ lib/ components/ hooks/ types/ scripts/ tests/ examples/ prisma/` и корне.

| файл | сироты-экспорты | уверенность | комментарий |
|---|---|---|---|
| `lib/storage.ts` | `getUserByEmail`, `getReleaseById`, `getAllReleases`, `getAllUsers`, `getFeaturedReleases`, `getReleasesWithArtists`, `findArtistsByNames`, `findArtistsByPartialName`, `loadReports`, `getActivitiesByUserId`, `getActivitiesByRole`, `getAllActivities`, `updateReportAcknowledgedStatus`, `assignReportsToArtist`, `addReport` | LIKELY | 15 функций. Сам модуль жив (динамические импорты — `lib/scheduler.ts:274,380`). Это остатки старого JSON-файлового API после перехода на Prisma. **Крупнейшая единичная цель чистки** |
| `lib/cached-dashboard.ts` | `getCachedArtistReleases`, `getCachedAdminPayments`, `getCachedAdminArtists`, `getCachedAdminReleases`, `PublicUser` | LIKELY | страницы переведены на прямые запросы Prisma, обёртки `unstable_cache` остались |
| `lib/sftp-playlist-storage.ts` | `ensureSftpPlaylistDatabase`, `getAllPlaylistUrls`, `deletePlaylist` | LIKELY | соседние `deletePlaylistById` / `deleteAllPlaylists` живые |
| `lib/playlist-crawler.ts` | `stopScheduledCrawling`, `isScheduledCrawlingActive` | RISKY | вместе с мёртвым UI (2.4) — фича целиком без обвязки |
| `lib/artist-report-requirements.ts` | `isArtistReadyForReport`, `formatMissingFieldsList` | LIKELY | модуль живой, сироты только эти две |
| `lib/server-auth.ts` | `requireUser` | RISKY | используется только `requireAdmin`. То, что `requireUser` не вызван, может означать незащищённые не-админские роуты. Это повод для проверки безопасности, а не для удаления |
| `lib/parser-run-history.ts` | `failStaleParserRuns`, `STALE_RUN_TIMEOUT_MINUTES`, `ParserType` | RISKY | `failStaleParserRuns` — уборщик зависших прогонов, которого никто не планирует. Зависшие прогоны парсеров, похоже, не закрываются никогда |
| `lib/cron-auth.ts` | `internalCronAuthHeaderOnly` | RISKY | перед удалением убедиться, что живые cron-роуты используют другие экспорты |
| `lib/analytics-artist-match.ts` | `resolveArtistIdFromDb` | LIKELY | |
| `lib/buildin/sync-hooks.ts` | `enqueuePlaylistPlacementSync` | LIKELY | все соседние `enqueue*Sync` импортируются динамически и используются, этот — нет |
| `lib/buildin/env.ts` | `assertBuildinConfigured`, `buildinDbEnvName` | LIKELY | |
| `lib/buildin/types.ts` | `multiSelectProp`, `filesExternalProp`, `SubmissionStatus` | SAFE | |
| `lib/buildin/dual-write.ts` | `fileFromFormDataFile` | LIKELY | |
| `lib/buildin/form-application-page.ts` | `releaseDateForSingle`, `yesNoFromPayload` | LIKELY | новый модуль, поверхность шире, чем нужно |
| `lib/buildin/form-session.ts` | `resolveFormQueueLabel` | LIKELY | |
| `lib/buildin/form-contracts.ts` | `PromoPayloadKey` | SAFE | тип |
| `lib/buildin/labels.ts` | `SubmissionOpsStatus` | SAFE | тип |
| `lib/playlist-history.ts` | `ensurePlaylistHistoryDatabase` | LIKELY | |
| `lib/hooks/use-dashboard-fetch.ts` | `useStreamAnalytics` | SAFE | единственное вхождение — определение на `:37` |
| `lib/password.ts` | `readablePassword` | LIKELY | |
| `lib/release-date.ts` | `compareReleasesByDateDesc` | LIKELY | |
| `lib/pyrus-catalog/field-map.ts` | `CATALOG_MAX_RELEASES` | LIKELY | ограничение, которое ничем не применяется |
| `lib/pyrus-catalog/validate.ts` | `CatalogReleaseInput` | SAFE | тип |
| `lib/pyrus-catalog/log.ts` | `catalogInfo` | SAFE | |
| `lib/playlist-placements.ts` | `PlacementTrackInput` | SAFE | тип |
| `components/ui/dropdown-menu.tsx` | `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuRadioGroup` | SAFE | поверхность shadcn, файл живой |
| `components/ui/select.tsx` | `SelectGroup` | SAFE | то же |
| `components/ui/command.tsx` | `CommandDialog` | SAFE | то же |
| `components/ui/dialog.tsx` | `DialogClose` | SAFE | то же |
| `tests/support/run-id.ts` | `syntheticEmail` | SAFE | |

### 2.10 Экспорты, используемые только внутри своего файла — 142

Это **не мёртвый код**. Правка — снять слово `export`, а не удалять реализацию. Отдельным проходом после
основной чистки: правка косметическая, риска почти нет, но и выигрыша в строках тоже.

Где их больше всего: `lib/storage.ts` (10) · `components/ui/dropdown-menu.tsx` (8) · `lib/buildin/labels.ts` (6) ·
`lib/analytics-artist-match.ts` (6) · `lib/cached-dashboard.ts` (5) · `lib/buildin/adapters/ops-mirrors.ts` (5) ·
`lib/analytics-flash-import.ts` (5) · `lib/report-acknowledgment.ts` (4) · `lib/pyrus-catalog/field-map.ts` (4) ·
`lib/buildin/form-session-client.ts` (4) · `components/ui/select.tsx` (4). Остальные — по 1–3 на файл.

Отдельно: `lib/pyrus-public-schemas.ts:191` — **переименовывающий реэкспорт**
(`catalogReleasesSchema as pyrusCatalogReleasesSchema`). Алиас не используется, но исходный символ жив под своим
именем. Удалять источник на основании неиспользуемого алиаса нельзя.

### 2.11 Экспорты, используемые только тестами

Не мёртвые, но в проде не вызываются — для полноты: `lib/analytics-artist-match.ts`
(`buildAnalyticsArtistLookup`, `isCollabFullyResolvedInRoster`, `needsManualUnmappedMapping`, `AnalyticsArtistUser`) ·
`lib/buildin/adapters/artists-releases.ts` (`ARTIST_OPS_PROPERTY_KEYS`, `RELEASE_OPS_PROPERTY_KEYS`) ·
`lib/buildin/adapters/ops-mirrors.ts` (`REPORT_OPS_PROPERTY_KEYS`) ·
`lib/buildin/adapters/submissions.ts` (`submissionIdempotencyKey`) · `lib/buildin/env.ts` (`BuildinDbKey`) ·
`lib/buildin/form-application-page.ts` (`payloadSummaryLines`, `genreForSingleRelease`, `releaseTypeForSingle`) ·
`lib/buildin/form-contracts.ts` (`FORM_QUEUE_COLUMNS`) · `lib/buildin/types.ts` (`peopleProp`) ·
`lib/buildin/outbox-test-helpers.ts` (`backoffProbe`) · `lib/playlist-placements.ts` (`resolvePlacementFirstSeen`) ·
`lib/pyrus-catalog/field-map.ts` (`collectDuplicateFieldIdsInSlot`) · `lib/storage-adapters.ts` (`normalizeTracks`).

Агент вынес сюда же `redactSubmissionPayloadForSharedInbox` как «PII-редактор, который вызывают только тесты», —
**это неверно**: он вызывается на живом пути записи, `lib/buildin/adapters/submissions.ts:98`, внутри
`createSubmissionInBuildin`.

### 2.12 Компоненты, которые нигде не рендерятся, хотя файл живой

| путь | компонент | доказательство | уверенность | что сломается |
|---|---|---|---|---|
| `components/analytics/TrackPaidFreeDistribution.tsx` | `TrackPaidFreeDistribution` | импортирован на `app/dashboard/admin/analytics/page.tsx:22`, но `<TrackPaidFreeDistribution` не встречается нигде в репозитории. Проверено отдельно | LIKELY | Неиспользуемый импорт держит мёртвый компонент в бандле. Похоже на график, снятый с аналитики и не возвращённый. Подтвердить с продуктом |
| `components/ui/progress.tsx` | `Progress` | импортирован на `components/report-processor.tsx:9`; `<Progress` вне собственных внутренностей файла не встречается | LIKELY | неиспользуемый импорт в живом файле |
| `components/ui/admin-select.tsx` | `AdminSelectContent`, `AdminSelectItem` | импортированы на `app/dashboard/admin/releases/admin-releases-client.tsx:8`, но страница рендерит `SelectContent`/`SelectItem` из `components/ui/select.tsx` (строки 340-345) | SAFE | ничего. Дропдаун работает; это лишний импорт и расхождение стилей — см. поправку в 2.0 |

Компоненты из мёртвых файлов (2.2–2.6) здесь не повторяются — их около 60, включая всю поверхность
31 мёртвого `components/ui/*`.

### 2.13 Закомментированные блоки длиннее 20 строк — не найдено

Ни одного непрерывного участка >20 закомментированных строк ни в одном `.ts`/`.tsx`. Детектор проверен снижением
порога до 8 — тогда находится 33 участка, то есть он работает; в репозитории просто нет длинных закомментированных
блоков. Самые длинные из найденных — это JSDoc-документация, а не выключенный код
(`scripts/migrate-buildin-form-queue-schemas.ts:1-18`, `lib/playlist-cover-scraper.ts:1-16`,
`app/api/cron/playlists/route.ts:9-23`).

Реально закомментированный код, полный список:

| файл:строки | длина | что это | уверенность |
|---|---|---|---|
| `app/page.tsx:34-40` | 7 | `useState` для `sectionPaddings` / `sectionContentHeights` / `paddingAdjustment` | SAFE |
| `app/page.tsx:16-19` | 4 | мёртвые импорты `mobile-services-slider` и `simple-debug-indicator` | SAFE |
| `app/page.tsx:557-560` | 4 | инлайновые стили (`width`/`maxWidth`/`overflow`/`position`) | SAFE |
| `app/page.tsx:576-579` | 4 | тот же блок, продублирован | SAFE |
| `hooks/use-mobile-detector.ts:11-15` | 4 | детект мобильного по User-Agent, заменён проверкой ширины | SAFE |
| `hooks/use-mobile-detector.ts:18-22` | 4 | детект тач-устройства | SAFE |
| `next-env.d.ts:1-5` | 4 | сгенерированные Next.js triple-slash ссылки | **RISKY — не трогать** |

### 2.14 Код за флагами, которых нет в `.env.example`

Самое важное здесь — не мёртвый код, а **флаги, которые тихо деградируют**. Отдельно вынесено в «Замечено, но не
входит в задачу», потому что это не про удаление.

| переменная | где читается | поведение, когда не задана | уверенность |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts:27` | падает на `NEXT_PUBLIC_SUPABASE_ANON_KEY`, затем на литерал `'dummy_key_for_build_purposes_only'` (`lib/supabase.ts:35`) после `console.warn`. Путь не мёртвый — он **тихо деградирует**: все записи в Storage (аватары, обложки) падают в рантайме, а не на старте | RISKY |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts:25` | фолбэк парсит `DATABASE_URL`, а если не вышло — **захардкоженный ref продакшена** `https://whygmlakldsunkjkhrsi.supabase.co`. Проверено лично | RISKY |
| `API_PERF_LOG` | `lib/api-perf-log.ts:12` | в проде логирование выключено, если не `"1"`. **Но модуль живой** — см. поправку в 2.0 | LIKELY |
| `PLAYLIST_SFTP_CLEANUP_REMOVED` | `app/api/cron/playlists-sftp/route.ts:72` | `=== '1'` → по умолчанию **выключено**. Очистка удалённых плейлистов не выполняется ни в одной документированной среде | LIKELY |
| `USE_SFTP_SYNC` | `app/api/cron/playlists/route.ts:39`, `app/api/parsers/vk/route.ts:316`, `app/api/parsers/bandlink/route.ts:377` | `!== 'false'` → по умолчанию **включено**; недостижим как раз путь «выключено» | LIKELY |
| `SFTP_IPV4_ONLY` | `lib/sftp-connect.ts:93` и др. | по умолчанию выключено | LIKELY |
| `SFTP_DISABLE_LEGACY_HANDSHAKE` | `lib/sftp-connect.ts:49` | по умолчанию выключено, legacy-алгоритмы остаются включёнными | LIKELY |
| `FORM_OUTBOX_BACKPRESSURE_LIMIT` | `lib/buildin/form-rate-limit.ts:46` | по умолчанию `500` | LIKELY |
| `E2E_BUILDIN_E2E_PARENT_PAGE_ID` | `scripts/setup-buildin-form-queues.ts:95` | падает на не-E2E parent page — то есть бутстрап E2E-воркспейса пишет в **продакшен-страницу** | LIKELY |
| `DIRECT_URL` | `prisma.config.ts` | падает на `DATABASE_URL`. `prisma migrate deploy` нужен прямой 5432, а не пулер | LIKELY |

**Обратное — есть в `.env.example`, но не читается ни одной строкой TS:**
`BRIGHT_DATA_RESIDENTIAL_USERNAME`, `BRIGHT_DATA_RESIDENTIAL_PASSWORD`, `TWOCAPTCHA_API_KEY`, `PROXY_HOST`,
`PROXY_PORT`, `BUILDIN_DB_ACTIVITY`, `BUILDIN_DB_AUTOMATION_RUNS`, `BUILDIN_DB_PLAYLISTS`,
`BUILDIN_DB_PLAYLIST_HISTORY`, `BUILDIN_OPS_CENTER_PAGE_ID`. Уверенность LIKELY: первые четыре потребляют
**Python**-парсеры в `parsers/`, вне TS-скана — проверить там до вычистки.

### 2.15 Динамика и строковые ссылки — читать до любого удаления

Статический анализ здесь слеп. Всё перечисленное граф проходит, но **любое новое решение об удалении надо
сверять с этим списком**.

**`next/dynamic`** — 3 места, 2 цели: `app/dashboard/admin/analytics/page.tsx:26` и
`app/dashboard/artist/[username]/analytics/page.tsx:17` → `@/components/charts/DspStreamChart` (`{ ssr: false }`),
чем он и жив, в отличие от соседа `TotalStreamChart`. И `components/streaming-chart-lazy.tsx:17` →
`@/components/streaming-chart` с извлечением именованного экспорта `.then(mod => mod.StreamingChart)` —
**строка `StreamingChart` и есть связь**: переименование этого экспорта молча ломает график в рантайме без ошибки типов.

**`await import(...)`** — живые рёбра, ключевые: `@/lib/buildin/sync-hooks` (из `app/api/artists/route.ts:207,518`,
`app/api/reports/upload-simple/route.ts:172`, `lib/parser-status.ts:54`, `lib/storage.ts:304,490,569,837,1020,1053,1091`,
`lib/playlist-history.ts:159`, `lib/sftp-playlist-storage.ts:389,426,469,662`) · `@/lib/storage` (`lib/scheduler.ts:274,380`) ·
`@/lib/buildin/adapters/artists-releases` (`lib/storage.ts:308,459,491`) · `@/lib/vk-playlists-persist`
(`lib/playlist-crawler.ts:42`, `lib/vk-parser.ts:229`) · `./lib/scheduler` (`instrumentation.ts:31`).

> **Следствие.** `lib/scheduler.ts` достижим **только** при `ENABLE_IN_PROCESS_SCHEDULER=true`. Проверено: флаг
> стоит `true` в `.env.example:70`, и это единственное, что держит живым большое поддерево. Всё, что достижимо
> только через него, понижается до LIKELY.

**Строковые пути к не-TS модулям:** выбор Python-парсера по рантайм-строке
(`app/api/parsers/bandlink/route.ts:89-93`), имена `.db` по платформе (`:342-343`), `parsers/vk_parser_linux.py`
и `vk_playlists.db` (`app/api/parsers/vk/route.ts:80,282`), `koala_releases_parser.py` из двух независимых мест
(`app/api/koala-parser/route.ts:94-96` и `lib/scheduler.ts:206-208`), `lib/python-report-processor.py`
(`app/api/reports/process-python/route.ts:173,186` — **вот почему мёртв `lib/report-generator.ts`**), скан каталога
`parsers/` и три `spawn('python3', …)` в `app/api/zvonko-parser/route.ts:364,406,516,558`.
**Ничто под `parsers/` нельзя судить о мёртвости из TS.**

**Маршруты по URL-строке** (живые, но никем не «импортируются»): curl из `crontab` — `POST /api/koala-parser`,
`POST /api/zvonko-parser`, `GET /api/cron/buildin-outbox?limit=20`; `scripts/cron-sftp.sh` →
`GET /api/cron/playlists-sftp`; `.github/workflows/forms-biweekly.yml` → `app/api/cron/forms-health/route.ts`.

Подтверждено **отсутствие**: `new Function(`, `eval(`, `require(` с переменной, реестра компонентов по строкам,
таблицы обработчиков маршрутов по пути.

### 2.16 Где я не уверен

- **Все 49 скриптов (2.7).** Историю команд оператора не видно. `migrate-to-supabase.ts` и
  `setup-buildin-form-databases.ts` процитированы в runbook — без вопроса к вам не удалять.
- **`missing-contract-banner` (2.4).** Спецификация говорит, что баннер должен быть на странице отчётов.
  Правдоподобнее, что это регресс, который надо чинить, а не код, который надо удалять.
- **Сироты с общими именами.** Сопоставление идёт по целому слову, поэтому два разных символа с одинаковым
  именем маскируют друг друга. Для строк с общими именами находка — это зацепка, а не приговор.
- **`components/ui/sonner.tsx`** при живой зависимости `sonner` в `package.json` — единственный LIKELY в блоке 2.3.

---

## 3. Дубли и параллельные реализации

### 3.1 Граница Prisma ↔ lib/storage.ts — главный вопрос

**Три слоя, а не два. И они разной природы.**

| Слой | Что это | Объём | Статус |
|---|---|---|---|
| Postgres через Prisma | единственное реляционное хранилище, 19 моделей | 98 файлов импортируют `lib/prisma` | канон |
| `lib/storage-adapters.ts` | трансляция DTO: строка Prisma → легаси-интерфейс со строковыми датами | 230 строк, **22 импортёра** | живой, канон |
| `lib/storage.ts` | легаси-CRUD-фасад **поверх Prisma** | 1173 строки, 38 импортёров, 4 модели | частично мёртв |
| SQLite `.db` | **отдельное** хранилище: пишет Python, читает TS | 2 живых файла | живой, обособлен |
| `data/*.json` | легаси-файлы, частично живые | 26 в git | смешанный |

Пересчёт по импортам: **98** файлов импортируют `prisma`, **38** — `lib/storage`, **16 — оба**:

`app/api/admin/assign-releases-to-artists/route.ts` (prisma.user + `assignReleasesToNewArtist`) ·
`app/api/artists/route.ts` (prisma.user + 8 функций storage) · `app/api/cron/playlists/route.ts`
(prisma.release, prisma.user + `addActivity`) · `app/api/koala-parser/route.ts` (prisma.release + storage) ·
`app/api/releases/[id]/route.ts` (prisma.release + `updateRelease`, `deleteRelease`, `getUserById`) ·
`app/api/releases/route.ts` (prisma.release, prisma.user + `addReleaseWithActivities`) ·
`app/api/reports/acknowledge/route.ts` (prisma.report + `addActivity`) · `app/api/reports/assign/route.ts`
(prisma.user + `moveReportToArtist`) · `app/api/reports/save/route.ts` (prisma.report + `findArtistByName`) ·
`app/api/reports/update-status/route.ts` (prisma.report + `updateReport*Status`) ·
`app/api/zvonko-parser/route.ts` (prisma.release, prisma.user + 6 функций) ·
`app/dashboard/artist/[username]/payments/page.tsx` · `lib/analytics-artist-match.ts` ·
`lib/cached-admin-reports.ts` · `lib/cached-dashboard.ts` · `lib/sftp-playlist-storage.ts`.

Часть из них импортирует из storage **только типы** (`type Release`, `type Report`, `type Activity`,
`UserRole`, `Track`) — это безобидно. Смешение путей записи — нет.

### 3.2 Реальный риск: обход побочных эффектов, а не рассинхрон БД

У функций записи в `lib/storage.ts` есть два побочных эффекта, которых нет у прямых вызовов Prisma:

1. **Ревалидация ISR-кэша** — `revalidateArtistDashboardsForArtistIds` (строки 250, 363, 398, 482, 564, 769)
2. **Постановка в очередь зеркала Buildin** — динамический импорт `lib/buildin/sync-hooks` (строки 304, 487–490, 569, 837, 1020, 1053, 1091)

Кто пишет мимо фасада — теряет и то, и другое.

#### Доказанный обход № 1 — подтверждение отчёта не доходит до Buildin

| | путь |
|---|---|
| Живой код | `app/api/reports/acknowledge/route.ts:56` — сырой `prisma.report.update({ isAcknowledged, acknowledgedAt })`, затем `addActivity` и `revalidateTag` |
| Готовая функция-двойник | `lib/storage.ts:1078` `updateReportAcknowledgedStatus` — та же запись **плюс** `enqueueReportSync` (строка 1091) |
| Доказательство | grep `updateReportAcknowledgedStatus` по всему репо → **0 внешних вызовов** |

Соседние маршруты статусов (`update-status`, поля signed/paid) идут **через** storage и зеркало
получают. Acknowledge — нет. Уверенность: **RISKY** (это не мусор, это расхождение поведения).

#### Доказанный обход № 2 — создание отчётов зеркалится только из одного маршрута

`enqueueReportSync` вызывается из `app/api/reports/upload-simple/route.ts:173` и трижды из
`lib/storage.ts`. Прочие маршруты, создающие отчёты, **не зеркалят**:
`app/api/reports/bulk-upload/route.ts:149`, `app/api/reports/save/route.ts:136`,
`app/api/reports/process-python/route.ts:351`.

#### Доказанный обход № 3 — удаление отчётов не архивирует сущность

`enqueueArchiveEntity` вызывается **только** из `lib/storage.ts` (строки 542, 570). Удаляют отчёты
напрямую: `app/api/reports/delete/[id]/route.ts:44`, `app/api/reports/delete-quarter/route.ts:62`,
`app/api/reports/clear-fake/route.ts:55`, `scripts/cleanup-duplicate-reports.ts:75`.

#### Чинится ли это автоматически — нет

`scripts/backfill-buildin.ts:416` переносит `isAcknowledged` пакетно, но это **ручной** скрипт
(`pnpm backfill:buildin`). Ни `crontab`, ни `.github/workflows/`, ни `app/api/cron/*` его не запускают.
Расхождение живёт до ручного прогона.

### 3.3 Мёртвая поверхность внутри lib/storage.ts — 23 экспорта из 57

Проверено по всему репо с исключением самоссылок `lib/storage.ts`.

| экспорт | что это | доказательство | увер. | что сломается |
|---|---|---|---|---|
| `saveUsers`, `saveReleases`, `saveReports`, `saveActivities` | **заглушки-пустышки**: тело — только `console.warn('... deprecated')` | 0 внешних вызовов | SAFE | ничего |
| `loadUsers`, `loadReleases`, `loadReports` | чтения-обёртки | 0 внешних; `loadUsers`/`loadReleases` зовутся только изнутри storage (строки 610, 614) | SAFE | ничего |
| `getAllUsers`, `getAllReleases` | алиасы к load* | 0 внешних | SAFE | ничего |
| `getReleaseById`, `getFeaturedReleases`, `getReleasesWithArtists`, `getUserByEmail` | чтения | 0 внешних | SAFE | ничего |
| `findArtistsByName`, `findArtistsByNames`, `findArtistsByPartialName` | поиск артистов | 0 внешних (`findArtistByName` в ед. ч. — **живой**, не путать) | SAFE | ничего |
| `getActivitiesByUserId`, `getActivitiesByRole`, `getAllActivities` | чтения активности | 0 внешних | SAFE | ничего |
| `trimActivitiesOlderThanDays` | чистка | 0 внешних; зовётся изнутри (строки 402, 833) | SAFE | ничего |
| `addReport` | создание отчёта **без** enqueue | 0 внешних | SAFE | ничего |
| `assignReportsToArtist` | назначение | 0 внешних (`assignReportsToNewArtist` — **живой**) | SAFE | ничего |
| `updateReportAcknowledgedStatus` | см. §3.2 | 0 внешних | **RISKY** | удалять нельзя «просто так»: это единственная реализация с зеркалированием. Либо маршрут переводят на неё, либо теряется логика |
| `addRelease` | создание релиза | единственный внешний вызов — `lib/scheduler.ts:270`, а он за флагом | **LIKELY** | сломается in-process планировщик |

Ложные срабатывания, которых удалось избежать (одноимённые **локальные** функции, не импорты storage):
`loadActivities` — `app/dashboard/admin/activity/page.tsx:155`, `components/activity-feed.tsx:29`;
`addRelease` — `app/forms/catalogUPLOAD/page.tsx:178`; `addRelease` в `tests/e2e/forms.spec.ts:267` — это
Playwright-локатор кнопки, а не функция.

### 3.4 Два параллельных планировщика

| | путь | расписание |
|---|---|---|
| Системный | `crontab` (корень репо) | koala `0 9,17` UTC · zvonko `0 11` UTC · sftp `0 13` и `30 21` UTC · buildin-outbox `*/5` |
| Внутрипроцессный | `lib/scheduler.ts` (621 строка, node-cron) | koala 12:00 и 20:00 · zvonko 14:00 · sftp 16:00 и 00:30 · buildin-outbox `*/5` · **playlist-covers сб/вс 06:00** |

Расписания совпадают почти один в один (МСК = UTC+3). `playlist-covers` есть **только** в
`lib/scheduler.ts` — то есть просто выключить его нельзя, задача пропадёт.

Достижимость: `lib/scheduler.ts` импортируется **единственный раз** — динамически, из
`instrumentation.ts:27`, под флагом `ENABLE_IN_PROCESS_SCHEDULER === 'true'`. Флаг **есть в
`.env.example` и выставлен в `true`**. То есть конфигурация по умолчанию включает второй планировщик
рядом с системным cron → двойные запуски. `AUDIT.md:296` этот риск уже фиксирует.

Дополнительно `lib/scheduler.ts:217` сам делает `spawn('python3', ...)` — третий путь к парсерам,
помимо `/api/koala-parser` и `/api/zvonko-parser`.

Уверенность: **RISKY**. Статический анализ покажет `scheduler.ts` как «почти мёртвый» — это ловушка.

### 3.5 Статус парсеров хранится тремя способами

| способ | где | кто пишет |
|---|---|---|
| JSON-файлы | `data/koala_parser_status.json`, `data/zvonko_parser_status.json` | `app/api/koala-parser/route.ts:47`, `app/api/zvonko-parser/route.ts:35` |
| Модель Prisma | `prisma.parserRunStatus` (bandlink, vk) | `lib/parser-status.ts` |
| SQLite | `bandlink_playlists.db` | пишет Python, мостом переносит `lib/parser-status-sqlite-bridge.ts:8` → `upsertParserRunStatus` |

### 3.6 `data/` — что живое, что мёртвое

| файл | статус | доказательство |
|---|---|---|
| `data/zvonko_parser_status.json` | **живой** | `app/api/zvonko-parser/route.ts:35` |
| `data/koala_parser_status.json` | **живой** | `app/api/koala-parser/route.ts:47` |
| `data/releases.json` | **живой** | пишется `app/api/zvonko-parser/route.ts:213`, читается `:223` |
| `data/backups.json` | **живой** | `lib/backup.ts:6` — метаданные бэкапов |
| `data/sftp_sync_index.json` | **живой** | `lib/sftp-playlist-sync.ts:35` |
| `data/users.json`, `reports.json`, `activities.json`, `balances.json` | легаси | только `scripts/migrate-to-supabase.ts` (разовая миграция) + строки-манифест в `lib/backup.ts:78-84` |
| `data/releases_backup_*.json` ×12, `data/users_backup_*.json` ×5 | **мёртвые** | только генераторы, читателей нет |

`lib/backup.ts:122` при создании бэкапа кладёт в архив `bandlink_playlists.db` и `vk_playlists.db` —
ещё одна причина, почему эти два файла нельзя трогать (`app/api/backups/route.ts`,
`app/api/cron/backup/route.ts` живые).

---

## 4. Зависимости

Метод: для каждого имени — grep по `from '<name>'`, `require('<name>')`, `import('<name>')` и подпутям
`<name>/…` по `app/ lib/ components/ scripts/ tests/ hooks/ types/ instrumentation.ts` + все корневые
конфиги. Затем граф достижимости от реальных точек входа: **497 исходных файлов, 370 достижимых,
127 недостижимых**. «Только из мёртвого кода» ниже означает, что единственный импортёр лежит в этих 127.

### 4.1 Не импортируются нигде

| пакет | версия | доказательство | увер. | что сломается |
|---|---|---|---|---|
| `kysely` | ^0.28.7 | 0 совпадений по всему репо, даже в документации. **Перепроверено лично.** | **SAFE** | ничего |
| `exceljs` | ^4.4.0 | 0 совпадений. Единственное упоминание — проза в `openspec/project.md:22` («ExcelJS для генерации…»), но весь Excel-код использует `xlsx`. **Перепроверено лично.** | LIKELY | ничего; документация вводит в заблуждение |
| `critters` | ^0.0.20 | 0 совпадений. Блок `experimental` в `next.config.mjs:40` содержит только `instrumentationHook` и `serverComponentsExternalPackages` — **`optimizeCss` отсутствует**, а без него Next не подключает critters. **Перепроверено лично.** | LIKELY | ничего, пока не включат `optimizeCss` |

### 4.2 Стоят в dependencies, нужны только для разработки

| пакет | доказательство | увер. |
|---|---|---|
| `@types/archiver` | пакет только с типами, рантайм-импортов нет | **SAFE** → devDependencies |
| `@types/pg` | пакет только с типами | **SAFE** → devDependencies |
| `prisma` | по сути CLI сборки (`prisma.config.ts:4` + `"build": "prisma generate && next build"`), но перенос в devDeps ломает установку с `--prod` в Docker | **RISKY** — оставить |

Плюс в самих devDependencies: `@types/xlsx@0.0.35` — устаревшая заглушка, `xlsx@0.18.5` везёт свои типы
(LIKELY удалить); `@types/bcryptjs@^2.4.6` — вероятно избыточен, `bcryptjs@3.x` везёт свои типы (LIKELY).

### 4.3 Тянутся только из мёртвого кода — 20 пакетов

Все они достижимы лишь из немонтируемых заготовок shadcn в `components/ui/*`.

| пакет | единственный импортёр | увер. |
|---|---|---|
| `@radix-ui/react-accordion` | `components/ui/accordion.tsx:4` — **0 импортёров** | LIKELY |
| `@radix-ui/react-alert-dialog` | `components/ui/alert-dialog.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-aspect-ratio` | `components/ui/aspect-ratio.tsx:3` — 0 импортёров | LIKELY |
| `@radix-ui/react-avatar` | `components/ui/avatar.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-collapsible` | `components/ui/collapsible.tsx:3` — 0 импортёров | LIKELY |
| `@radix-ui/react-context-menu` | `components/ui/context-menu.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-hover-card` | `components/ui/hover-card.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-menubar` | `components/ui/menubar.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-navigation-menu` | `components/ui/navigation-menu.tsx:2` — 0 импортёров | LIKELY |
| `@radix-ui/react-radio-group` | `components/ui/radio-group.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-scroll-area` | `components/ui/scroll-area.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-separator` | `components/ui/separator.tsx:4` → только `ui/sidebar.tsx` (недостижим) | LIKELY |
| `@radix-ui/react-slider` | `components/ui/slider.tsx:4` — 0 импортёров | LIKELY |
| `@radix-ui/react-toast` | `components/ui/toast.tsx:4` → `ui/toaster.tsx`/`hooks/use-toast.ts`; **`app/layout.tsx` не монтирует `<Toaster/>`** | LIKELY |
| `@radix-ui/react-toggle` | `components/ui/toggle.tsx:4` → только `ui/toggle-group.tsx` (недостижим) | LIKELY |
| `@radix-ui/react-toggle-group` | `components/ui/toggle-group.tsx:5` — 0 импортёров | LIKELY |
| `embla-carousel-react` | `components/ui/carousel.tsx:6` — 0 импортёров | LIKELY |
| `sonner` | `components/ui/sonner.tsx:4` — 0 импортёров, нигде не смонтирован | LIKELY |
| `next-themes` | `components/theme-provider.tsx:2` и `ui/sonner.tsx:3` — оба 0 импортёров; `app/layout.tsx` не монтирует ThemeProvider | LIKELY |
| `styled-components` (+ `@types/styled-components`) | `components/styled/StyledScalableSection.tsx:5` — сам компонент нигде не импортируется | LIKELY |

### 4.4 Выглядят неиспользуемыми, но удалять нельзя

| пакет | почему остаётся | увер. |
|---|---|---|
| `d3-scale` (pinned 4.0.2) | `next.config.mjs:47` — `config.resolve.alias['victory-vendor/d3-scale']`. Комментарий там же: без этого возвращается «n.scalePoint is not a function» | **RISKY — держать** |
| `d3-shape` (pinned 3.2.0) | `next.config.mjs:48`, тот же алиас | **RISKY — держать** |
| `victory-vendor` (pinned 36.9.2) | `next.config.mjs:44` `transpilePackages: ['recharts','victory-vendor']` + алиасы; закреплён намеренно, чтобы алиас резолвился | **RISKY — держать** |
| `autoprefixer`, `postcss`, `tailwindcss` | подключаются строками в `postcss.config.js` / `tailwind.config.js`, а не импортами | RISKY — держать |
| `react-dom` | ни один файл не импортирует явно, но нужен рантайму React/Next | RISKY — держать |
| `@sentry/node` | динамический `await import('@sentry/node')` — `instrumentation.ts:15`, только в prod при заданном `SENTRY_DSN`; плюс в `serverComponentsExternalPackages` | держать |
| `node-cron` | только `lib/scheduler.ts:1`, а тот за флагом (§3.4) | держать |
| `sqlite3` | `app/api/parsers/vk/route.ts:232,281`, `app/api/parsers/bandlink/route.ts:274,339`, `lib/sqlite3-lazy.ts:6`, `lib/parser-status-sqlite-bridge.ts:7` | держать |

### 4.5 Отсутствующая зависимость (баг)

`eslint.config.mjs:3` делает `import { FlatCompat } from "@eslint/eslintrc"`, но **`@eslint/eslintrc`
не объявлен в `package.json` вообще**. Резолвится только благодаря hoisting транзитивной зависимости
eslint в pnpm. Уверенность: RISKY. Это не удаление, а недостающая запись.

---

## 5. Маршруты и схема

### 5.1 Контекст для всего раздела

**Нет `vercel.json`, нет `middleware.ts`, нет `rewrites`/`redirects` в `next.config.mjs`.** Значит, ни один
маршрут не достижим через переадресацию URL: если литерального совпадения нет, маршрут действительно
не вызывается — кроме случаев сборки пути в рантайме.

Разрешённые динамические пути: все `${baseUrl}/api/...` в `lib/scheduler.ts` и `app/api/cron/*/route.ts`;
все шаблонные литералы `` `/api/x/${id}` ``; 6 подмаршрутов сессий в `lib/buildin/form-session-client.ts`;
`secrets.PROD_FORMS_HEALTH_URL` → `/api/cron/forms-health`. Централизованной карты маршрутов-констант
в TS нет.

### 5.2 API-маршруты без вызовов — 21 из 91

| маршрут | методы | доказательство | увер. | что сломается |
|---|---|---|---|---|
| `app/api/cron/forms-health/route.ts` | GET,POST | **Литерального пути в репо нет.** Достижим через собираемый в рантайме URL из секрета: `.github/workflows/forms-biweekly.yml:127` `PROD_HEALTH_URL: ${{ secrets.PROD_FORMS_HEALTH_URL }}`, затем `curl` на строках 135–139. Соответствие подтверждено `docs/FORMS_TESTING.md:110` | **RISKY — НЕ ТРОГАТЬ** | **Двухнедельная CI-задача `production-health` падает жёстко** (`exit 1`, если проба не отвечает). Классический ложноотрицательный результат статического анализа |
| `app/api/admin/buildin/kpi-snapshot/route.ts` | POST | вызовов нет; документирован `docs/BUILDIN_MIGRATION.md:124` | RISKY | ручная ops-ручка снятия KPI из runbook |
| `app/api/admin/buildin/reconciliation/route.ts` | GET | вызовов нет; `docs/BUILDIN_MIGRATION.md:134,159`, `BUILDIN_OPS_WORKSPACE.md:176` | RISKY | **гейт готовности к cutover (`cutoverReady`)** в runbook миграции |
| `app/api/admin/buildin/requeue/route.ts` | POST | вызовов нет; `docs/BUILDIN_MIGRATION.md:160`; за ним `requeueDeadOutbox` — `lib/buildin/outbox.ts:159` | RISKY | восстановление зависших задач outbox |
| `app/api/admin/buildin/reverse-sync/route.ts` | POST | вызовов нет; `docs/BUILDIN_MIGRATION.md:112` | RISKY | обратная запись Buildin→локально по allowlist |
| `app/api/submit-pyrus-catalog-upload/route.ts` | POST | `app/forms/catalogUPLOAD/page.tsx:14,488` перешла на `submitFormSession` → `/api/forms/sessions`. Возвращает 410 при `isPyrusWriteDisabled()` (`route.ts:40,51`) | **RISKY** | **`docs/PYRUS_ARCHIVE.md:5` прямо требует сохранить имена `submit-pyrus-*` ради стабильности URL** — они пишут в Buildin при отключённом Pyrus. 202 строки живого кода |
| `app/api/submit-pyrus-release-upload/route.ts` | POST | `app/forms/releaseUPLOAD/page.tsx:14,491` → `submitFormSession`; 410-гейт `route.ts:164,175` | **RISKY** | то же |
| `app/api/submit-pyrus-distribution/route.ts` | POST | `app/distribution/page.tsx:13,505` → `submitFormSession`; 410-гейт `route.ts:65,76` | **RISKY** | то же |
| `app/api/submit-pyrus-data-rf/route.ts` | POST | `app/forms/dataRF/page.tsx:183` шлёт в `/api/forms/simple`; 410-гейт `route.ts:67,78` | **RISKY** | то же, 173 строки |
| `app/api/submit-pyrus-data-not-rf/route.ts` | POST | `app/forms/dataNotRF/page.tsx:155` → `/api/forms/simple`; 410-гейт `route.ts:44,55` | **RISKY** | то же |
| `app/api/pyrus-file-upload/route.ts` | POST | вызовов нет; тело — безусловный 410 (`route.ts:10`), 11 строк | **SAFE** | ничего; только стабильность URL для устаревших вкладок |
| `app/api/reports/process/route.ts` | POST | вызовов нет; тело `@deprecated` → 410 (`route.ts:4,13`) | **SAFE** | ничего — заглушка |
| `app/api/reports/process-new/route.ts` | POST | вызовов нет; тело `@deprecated` → 410 | **SAFE** | ничего — заглушка |
| `app/api/artist-dashboard/[username]/route.ts` | GET | вызовов нет. Вытеснен: `app/dashboard/artist/[username]/dashboard/page.tsx:20` зовёт `getCachedArtistDashboard()` прямо на сервере | LIKELY | ничего — точный дубль RSC-пути |
| `app/api/balance/[artistId]/route.ts` | GET | вызовов нет. Вытеснен: `app/dashboard/artist/[username]/payments/page.tsx:24` зовёт `getArtistBalance()` на сервере | LIKELY | ничего — дубль RSC-пути |
| `app/api/cron/playlists/route.ts` | GET | вызовов нет; единственное совпадение — собственный комментарий `:10`. Это оркестратор, раздающий на `/api/cron/playlists-sftp` (`:46`), `/api/parsers/bandlink` (`:99`), `/api/parsers/vk` (`:126`) — но `crontab`/`scripts/cron-sftp.sh:7` и `lib/scheduler.ts:355` зовут `playlists-sftp` **напрямую**, минуя его | LIKELY | ничего запланированного; теряется объединённая точка входа |
| `app/api/excel/[artistId]/route.ts` | GET | вызовов нет; только `API_DOCUMENTATION.md:557`. Проверены все `window.open`/`fetch` — кнопки в UI нет | LIKELY | выгрузка XLSX по артисту; один из 7 потребителей `xlsx` |
| `app/api/reports/save/route.ts` | POST | вызовов нет; только `API_DOCUMENTATION.md:297`. 162 строки живого кода с `requireAdmin`, пишет в Report + Supabase Storage | LIKELY | вытеснен `/api/reports/upload-simple` и `/api/reports/bulk-upload` |
| `app/api/reports/clear-fake/route.ts` | GET | вызовов нет; `API_DOCUMENTATION.md:303`. **Помечен как CSRF-дыра в `AUDIT.md:81,252`** — деструктивная операция на GET | LIKELY + дефект безопасности | ничего. Массово удаляет все отчёты `isRegistered:false` и их объекты в Supabase. Удаление маршрута **закрывает** известную P1-находку |
| `app/api/upload-progress/[id]/route.ts` | GET (SSE) | `grep -rn EventSource app components lib hooks` → **0 совпадений**. `uploadId` всё ещё генерируется всеми 5 формами (`releaseUPLOAD:439`, `catalogUPLOAD:421`, `dataRF:181`, `dataNotRF:153`, `distribution:451`), но подписчиков нет. Producer `pushProgress` в `app/api/progress-stream.ts` зовётся только из двух мёртвых `submit-pyrus-*` | LIKELY | ничего — осиротевший SSE-канал. Удаление осиротит и `app/api/progress-stream.ts` с его `rateLimitUploadProgress` |
| `app/api/activities/parser-log/route.ts` | POST | в TS вызовов нет. Только `parsers/parser_logger.py:36`, а сам `parser_logger` **не импортируется ни одним Python-файлом** (`grep -rl parser_logger parsers/` → пусто). Плюс маршрут требует `requireAdmin`, который неаутентифицированный POST из Python никогда бы не прошёл | LIKELY | ничего сегодня |

### 5.3 Живые маршруты, чей единственный вызывающий — мёртвый код

Маршрут остаётся, но сквозного пути к нему нет.

| маршрут | мёртвый вызывающий |
|---|---|
| `/api/playlists/crawl` | `components/playlist-crawler-controls.tsx:17` (0 импортёров; соседи `playlist-crawler-status.tsx`, `playlist-crawler-initializer.tsx` тоже недостижимы) |
| `/api/reports/bulk-upload` | `components/report-uploader.tsx:63` (0 импортёров; живой — `simple-report-uploader.tsx`) |
| `/api/forms/simple` | один из вызывающих — недостижимый `components/contact-section.tsx:78`, но живые (`contact-form-section.tsx:70`, `dataRF`, `dataNotRF`) держат маршрут |

Отдельно: `app/api/parsers/history/route.ts` экспортирует `POST`, но вызывается только `GET`
(`admin/playlists/page.tsx:724`). Уверенность LIKELY.

### 5.4 Схема Prisma — модели

Все 19 моделей и читаются, и пишутся. Сырой SQL — ровно 4 места
(`app/api/reports/quarters/route.ts:12,19`, `app/api/reports/list/[quarter]/route.ts:50,66`), все по `"Report"`;
`$executeRaw` нет нигде. `scripts/import-all-flash.ts:115,150` работает через сырой `pg`-пул мимо Prisma.

Модели с единственным файлом-владельцем: `AnalyticsArtistAlias` (`lib/analytics-artist-match.ts`),
`ParserCookie` (`lib/parser-cookies.ts`), `ParserRun` (`lib/parser-run-history.ts`),
`FormDeliveryItem` и `FormDeliveryFile` (оба — `lib/buildin/form-session.ts`).

**Важная оговорка ко всей таблице полей:** `select:` встречается лишь в 87 местах, а **`include:` — ноль
раз во всём репо**. Большинство запросов возвращают строку целиком, поэтому любое поле может читаться
неявно при спреде или сериализации. Именно поэтому почти ничего ниже не помечено SAFE.

### 5.5 Поля Prisma, не встречающиеся в коде вообще

| поле | тип | доказательство | увер. |
|---|---|---|---|
| `FormDeliveryFile.checksumSha256` | String? | `grep -rn "\bchecksumSha256\b"` по app/lib/components/scripts/tests/hooks/types → **0**. Единственная вставка — `lib/buildin/form-session.ts:240-247`, где задаются только sessionId, fieldKey, filename, contentType, sizeBytes. Колонка всегда NULL | **SAFE** |
| `FormDeliveryFile.itemId` (+ связь `item`) | String? | 0 совпадений. `fileCreates` его не задаёт, `connect`/`include` нет. Обратная связь `FormDeliveryItem.files` тоже никогда не заполняется. Файлы сопоставляются с элементами косвенно — через `sessionId`+`fieldKey` | **SAFE** (мёртвый FK, всегда NULL) |
| `FormDeliverySession.leaseUntil` | DateTime? | 0 совпадений. Задумано под аренду воркером, но `lib/buildin/process-outbox.ts` сессии не арендует | **SAFE** |
| `FormSubmission.deliverySessions` | связь | 0 совпадений; структурно нужна схеме для `FormDeliverySession.submissionId` | LIKELY (нельзя убрать, не сняв связь) |

Все три мёртвые колонки приехали одной миграцией —
`prisma/migrations/20260731160000_form_delivery_sessions/migration.sql` (2026-07-31), как задел на будущее,
и остались неподключёнными.

### 5.6 Поля, которые пишутся, но никогда не читаются

| поле | доказательство | увер. |
|---|---|---|
| `BuildinExternalId.lastSyncedAt` | пишется `lib/buildin/outbox.ts:199,205`; нигде нет в `select`/`where`/`orderBy` и не читается с объекта | LIKELY |
| `BuildinOutbox.processedAt` | пишется `lib/buildin/outbox.ts:133,154,171`, `lib/buildin/reverse-sync.ts:93`; не фильтруется и не читается | LIKELY |
| `FormDeliverySession.totalFiles` | пишется `lib/buildin/form-session.ts:199`; статус-эндпоинт вместо чтения пересчитывает: `form-session.ts:789` `prisma.formDeliveryFile.count(...)` | LIKELY |
| `FormDeliverySession.totalBytes` | пишется `form-session.ts:200` (`BigInt`), не читается | LIKELY |
| `FormDeliverySession.completedFiles` | пишется `form-session.ts:692`; возвращается на `:694` свежесосчитанная локальная переменная, а не колонка | LIKELY |
| `StreamAnalytics.cpline`, `albumReleaseDate`, `daysSinceRelease` | пишутся `lib/flash-storage.ts:75,76,77` из `lib/flash-parser.ts:71,72,73`; в UI не читаются | LIKELY |
| `StreamAnalytics.isMonthlyAggregate` | `lib/flash-storage.ts:43,80` + сырой SQL; входит в уникальный ключ `stream_analytics_flash_row_key`. **Всегда пишется `false`** — ветка месячных агрегатов (`month`/`year` + `true`) никогда не создаётся, только запрашивается | LIKELY, полумёртвая фича |
| `Report.fileUrl` | 24 совпадения, но задаётся только `app/api/reports/upload-simple/route.ts:185`; `lib/excel-utils.ts:177` хардкодит `"#"` в недостижимом коде | LIKELY, почти мёртвое |
| связи `FormDeliveryItem.session`, `FormDeliveryFile.session`, `FormDeliverySession.submission`, `BuildinExternalId.submission`, `BuildinOutbox.submission`, `FormSubmission.externalIds`, `FormSubmission.outbox`, `FormDeliverySession.items`, `FormDeliverySession.files`, `FormDeliveryItem.files` | `include:` нет нигде; связи чисто структурные, но семантика FK и `onDelete: Cascade` **работает в рантайме** | **RISKY — держать** |

### 5.7 Расхождение схемы и миграций — самая серьёзная находка раздела

**Ни в одной миграции нет `CREATE TABLE "StreamAnalytics"`.** Проверено лично:
`grep -rn 'CREATE TABLE.*StreamAnalytics' prisma/migrations/` → **0 совпадений**, при том что таблицу
используют три миграции: `20260319000000_add_compound_indexes`,
`20260418130000_stream_analytics_unique_constraint` (удаляет дубли и добавляет
`stream_analytics_flash_row_key`), `20260609120000_enable_rls_server_only`.

Таблица создавалась в Supabase вручную, мимо миграций. Следствие: **`prisma migrate deploy` на пустой
базе упадёт** — а `entrypoint.sh:29` выполняет `pnpm db:migrate` при каждом старте контейнера.
Уверенность: **RISKY**. Это не кандидат на удаление, а дефект, который надо чинить отдельно.

У всех остальных 18 моделей `CREATE TABLE` на месте; колонок, добавленных миграцией и убранных из
схемы, нет; таблиц-сирот в миграциях без модели нет.

---

## 6. Документация

Проверка каждого документа против кода: существуют ли упомянутые пути, эндпоинты, env-переменные и
npm-скрипты. Даты — `git log -1 --format=%ci`.

Опорные цифры: 91 файл `route.ts` существует, `API_DOCUMENTATION.md` описывает 43.
**Мёртвых задокументированных эндпоинтов — 0; недокументированных существующих — 48.**

### 6.1 Корневые документы

| документ | строк | посл. коммит | о чём | соответствует ли реальности | вытеснен | увер. | что теряется |
|---|---|---|---|---|---|---|---|
| `ARCHITECTURE.md` | **360** | 2026-01-09 | ASCII-схема: JSON-файлы + SQLite + Pyrus; модели данных; «рекомендуем мигрировать на PostgreSQL» | **ОПИСЫВАЕТ НЕСУЩЕСТВУЮЩУЮ АРХИТЕКТУРУ. Перепроверено лично: `prisma` — 0 упоминаний, `supabase` — 0, `postgres` — 1** (в строке про будущую миграцию). Блок хранилища — `users.json / reports / releases / balances`, тогда как источник истины — Prisma+Supabase (`lib/prisma.ts`, 98 импортёров; `entrypoint.sh:29` гоняет `prisma migrate deploy`). §331 «Текущие проблемы: пароли в открытом виде, localStorage для аутентификации, нет серверных сессий» — про сессии уже неправда: `lib/server-auth.ts:121` ставит httpOnly-куку `rossel_session`. §353 рекомендует миграцию, которая давно состоялась | `README.md` (2026-07-22) + `API_DOCUMENTATION.md` §«Хранение данных» + `openspec/project.md` | **SAFE** | только ASCII-диаграммы потоков (обработка отчётов, выплаты, парсинг) §48–176 — они пересказаны в `API_DOCUMENTATION.md` §864. Чинить по кусочкам смысла нет: переписывать с нуля или удалять |
| `API_DOCUMENTATION.md` | 1224 | 2026-07-26 | стек, 43 эндпоинта, страницы, компоненты, потоки, интеграции | **НАПОЛОВИНУ УСТАРЕЛ.** Верно: §1105 «Supabase Postgres (source of truth)», §1115 «Legacy JSON (deprecated)». Неверно: **строка 31** — «Хранение: JSON файлы (file-based storage), SQLite»; **строка 62** — «Аутентификация: на основе localStorage» (на деле httpOnly-кука); §646/818 — «Сохранение в localStorage». Мёртвый путь: `components/layout.tsx` (§797) не существует. **48 недокументированных маршрутов**: весь `/api/forms/*` (7), `/api/admin/buildin/*` (4), `/api/analytics/*` (8), `/api/cron/*` (9), `/api/auth/*`, `/api/koala-parser`, `/api/zvonko-parser`, `/api/playlists/{assign,history,sftp,sftp-admin,sync-sftp}`, `/api/parsers/{history,delete-playlist}`, `/api/reports/{acknowledge,delete-quarter,upload-simple}`, `/api/uploads/avatars`, `/api/vk/cookies`, `/api/artist-dashboard/[username]`, `/api/pyrus-file-upload`, `/api/forms/simple` | пересекается с `ARCHITECTURE.md` (этот новее и лучше) | **RISKY** — самый ценный документ несмотря на дыры; чинить строки 31/62/646/797/818 | единственный справочник по эндпоинтам |
| `AUDIT.md` | 335 / 51K | 2026-07-26 | аудит безопасности от 2026-07-10, находки P0–P2 | **В ОСНОВНОМ УСТРАНЁН → устарел как список задач.** Исправлено: F-SEC-1 (все три `app/api/backups/*` теперь зовут `requireAdmin`), F-SEC-2 (`app/api/vk/cookies/route.ts:11`, `bandlink/cookies/route.ts:12`). Ещё открыто: `next.config.mjs:113 ignoreBuildErrors:true` и `:116 ignoreDuringBuilds:true`; в `app/` **нет ни одного** `error.tsx`/`global-error.tsx`/`not-found.tsx`. Ссылается на уже удалённые `components/kokonutui/list-02.tsx`, `parsers/page.tsx` | частично `AUDIT_FUNCTIONAL.md` | **LIKELY** — в архив, не удалять | исторический след реального аудита; два открытых пункта надо вынести в задачи до архивации |
| `AUDIT_FUNCTIONAL.md` | 171 / 29K | 2026-07-26 | функциональный аудит 2026-07-20, 50+ дефектов (даты, коллабы, деньги) | **ЧАСТИЧНО УСТРАНЁН, размечен изнутри** маркерами «СТАТУС: по сути РЕШЕНО». Находка A7 («`mskDateString()` не используется») теперь ложна: у `lib/msk-date.ts` 5 импортёров. Ссылки на строки `lib/cached-dashboard.ts:384,563` и `lib/storage.ts:187,459` разъехались | пересекается с `AUDIT.md` | **LIKELY** — в архив | таксономия дефектов дат/коллабов, объясняющая, зачем существуют `lib/release-date.ts` и `lib/split-artist-names.ts` |
| `AUDIT_DESIGN.md` | 120 / 18K | 2026-07-28 | визуальный/a11y аудит, DS1–DS8 | **УСТАРЕЛ — ссылается на несуществующие файлы.** DS1 указывает на `components/theme-toggle.tsx` и `components/kokonutui/top-nav.tsx` — **оба удалены**, то есть DS1 уже отработан. Дизайн-токены совпадают с `.cursorrules` и `tailwind.config.js` | `.cursorrules` — живой нормативный документ | **LIKELY** — в архив | мобильные/a11y-находки, возможно ещё открытые |
| `SUPABASE_SETUP.md` | 350 / 17K | 2026-02-13 | пошаговое руководство **как мигрировать** на Supabase+Prisma | **РУКОВОДСТВО ПО УЖЕ ВЫПОЛНЕННОЙ РАБОТЕ.** §69 вручную пишет схему Prisma, которую вытеснил `prisma/schema.prisma`. §273 «Шаг 8» предлагает «Вариант A: заменить реализацию в `lib/storage.ts`» либо «Вариант B: новый слой `lib/db.ts`» — **`lib/db.ts` никогда не существовал**, и ни один из вариантов не описывает то, что реально вышло. Переменные `SUPABASE_*` реальны (`lib/supabase.ts:25,27`), но **отсутствуют в `.env.example`**, как и `DIRECT_URL` из `entrypoint.sh` | `docs/TIMEWEB_PERSISTENCE.md` (новее) + `README.md` | **LIKELY** — удалить шаги 1–9, сохранить §314 «Важно по безопасности» и §338 «Деплой» | шаги первичной настройки Supabase (строка подключения, пулер :6543 против :5432) и единственное описание `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` |
| `BANDLINK_PARSER_README.md` | 228 | 2025-10-21 | два продакшн-парсера bandlink | **ТОЧЕН, про живой код.** Цитата совпадает с `app/api/parsers/bandlink/route.ts:90-91` дословно. **Содержит захардкоженный пароль Bright Data** — ротировать | подмножество `DOCKER_PARSER_README.md` | **RISKY** (оставить), но вычистить секрет | единственная документация живых парсеров |
| `KOALA_PARSER_README.md` | 263 | 2026-01-09 | `koala_releases_parser.py` | **ТОЧЕН, про живой код**: скрипт достижим из `app/api/koala-parser/route.ts:94` и `lib/scheduler.ts:206` | `openspec/specs/koala-parser/spec.md` пересекается ~60 % | **RISKY** (оставить) | runbook живого ежедневного крон-парсера |
| `DOCKER_PARSER_README.md` | 342 | 2025-10-21 | запуск `bandlink_parser_production_linux.py` в `Dockerfile.parser` | **ТОЧЕН, но про побочный канал, который прод не использует**: прод гоняет парсер из основного `Dockerfile` через `/api/parsers/bandlink`, а не через этот compose. «Мёртвые пути» `/app/parsers`, `/app/bandlink_playlists.db` — внутриконтейнерные, ложные срабатывания | `BANDLINK_PARSER_README.md` | **LIKELY** | единственное описание `docker-compose.parser.yml`; `docker-compose.vk-parser.yml` не описан нигде |
| `BRIGHT_DATA_SETUP.md` | 109 | 2025-10-16 | настройка `bandlink_parser_brightdata_linux.py` | **УСТАРЕВШАЯ ПОДСИСТЕМА**: скрипт — сирота, на него ссылается только этот документ | `BANDLINK_PARSER_README.md` | **SAFE** (удалять вместе со скриптом) | заметки по аккаунту Bright Data, частично продублированы в `parsers/WEB_UNLOCKER_README.md` |
| `БЕЗОПАСНЫЙ_ПАРСЕР.md` | 225 | 2025-10-14 | «безопасные» парсеры bandlink | **МЁРТВАЯ ПОДСИСТЕМА**: все 4 упомянутых скрипта — сироты | `parsers/SAFE_PARSER_README.md` | **SAFE** | стратегия обхода капчи через куки, дублируется в `parsers/HOW_TO_GET_COOKIES.md` |
| `DOCKER_INSTALL.md` | 133 | 2025-10-21 | как поставить Docker Desktop | точен, но полностью общий — ничего проектного | `DOCKER_PARSER_README.md` §prereqs | **SAFE** | общеизвестные шаги установки |
| `ENV_SETUP.md` | 62 | 2025-10-14 | только 2captcha | **УЗКИЙ, НО ЖИВОЙ**: `TWOCAPTCHA_API_KEY` есть в `.env.example` и используется `app/api/parsers/vk/route.ts:44`. Утверждение «парсеры Bandlink и VK» наполовину неверно — продакшн-парсеры bandlink 2captcha не используют. `README.md:14` ссылается на него как на полный env-документ, чем он не является | `parsers/2CAPTCHA_SETUP.md` (189 строк, новее) | **LIKELY** | ничего уникального, но сначала поправить ссылку в `README.md:14` |
| `README.md` | 29 | 2026-07-22 | Next 14 + Prisma 7, деплой | **ТОЧЕН**, все упомянутые скрипты и файлы существуют | — | **RISKY** (оставить) | точка входа |
| `SECURITY.md` | 7 | 2026-07-22 | ротация секретов, ACL для ПДн | **ТОЧЕН**, все ссылки живы; пункт 6 про admin-гейт на cookie-эндпоинтах подтверждён | — | **RISKY** (оставить) | актуален и краток |
| `AGENTS.md` | 17 | 2026-01-09 | указатель OpenSpec | точен, цель существует | — | RISKY (оставить, генерируется `openspec update`) | маршрутизация агентов |
| `.cursorrules` | 121 | 2026-04-16 | живая дизайн-система | **ТОЧЕН, кроме одной мёртвой ссылки**: `components/layout.tsx` (строка 9) не существует | `AUDIT_DESIGN.md` — снимок находок, а этот нормативен | **RISKY** (оставить), поправить строку 9 | единственная живая спецификация дизайн-системы |

### 6.2 `docs/`

| документ | строк | посл. коммит | соответствие | увер. |
|---|---|---|---|---|
| `docs/BUILDIN_MIGRATION.md` | 222 | 2026-07-31 | **точен и актуален**; все npm-скрипты существуют | **RISKY** (оставить — активная миграция) |
| `docs/BUILDIN_OPS_WORKSPACE.md` | 187 | 2026-07-31 | актуален, совпадает с `openspec/changes/refactor-buildin-ops-workspace/` | **RISKY** (оставить) |
| `docs/FORMS_TESTING.md` | 144 | 2026-07-31 | **точен**, совпадает с обоими CI-воркфлоу | **RISKY** (оставить) |
| `docs/PYRUS_ARCHIVE.md` | 13 | 2026-07-22 | **АКТУАЛЕН И НЕСУЩИЙ.** Пункт 5 — единственный факт, удерживающий от удаления пяти живых маршрутов `submit-pyrus-*`; пункт 6 запрещает трогать код field-map до конца архивного окна | **RISKY** (оставить) |
| `docs/TIMEWEB_PERSISTENCE.md` | 101 | 2026-06-05 | точен; единственное описание границы эфемерного диска | **RISKY** (оставить) |
| `docs/BUILDIN_TOKEN_SETUP.md` | 40 | 2026-07-22 | точен; пересекается с `BUILDIN_MIGRATION.md` §16 и `SECURITY.md` §5 | **LIKELY** (слить в BUILDIN_MIGRATION.md); ценна неочевидная заметка про 403 на общем хабе |
| `docs/DASHBOARD_PERF_ACCEPTANCE.md` | 27 | 2026-05-31 | проверяемо: `take=100` совпадает с `lib/sftp-playlist-response.ts:20` | **LIKELY** (слить с BASELINE) |
| `docs/DASHBOARD_PERF_BASELINE.md` | 33 | 2026-05-31 | точен; его правило «никакого localStorage» противоречит `API_DOCUMENTATION.md:62` — прав этот документ | **LIKELY** (слить) |
| `docs/artist-cabinet-screens.md` | 269 | 2026-04-16 | чистая проза без путей — не может «шумно» протухнуть, но и не проверяется | **LIKELY** (артефакт дизайн-передачи) |
| `docs/landing-screens.md` | 355 | 2026-04-16 | то же; упомянутый `components/sparkles.tsx` жив (10 импортёров) | **LIKELY** |
| `docs/monitoring-pg-stat.md` | 57 | 2026-04-16 | точен, SQL не зависит от провайдера | **LIKELY** (низкая ценность, низкий риск) |
| `docs/BUILDIN_CRM_VIEW_CHECKLIST.md` | 40 | **не в git** | актуален, но это разовый ручной чек-лист | **LIKELY** после выполнения |
| `docs/CLEANUP_PROMPTS.md` | 191 | **не в git** | мета-документ: план этой самой чистки | **LIKELY** (удалить по завершении) |
| `docs/*.env`, `docs/FORMS_STAGING.env.example` | — | — | все на месте, на них ссылаются `BUILDIN_TOKEN_SETUP.md` и `FORMS_TESTING.md` | оставить |

### 6.3 `parsers/*.md`

| документ | строк | описывает | скрипт достижим? | увер. |
|---|---|---|---|---|
| `parsers/2CAPTCHA_SETUP.md` | 189 | 2captcha | жив только для `vk_parser_linux.py` | **LIKELY** (оставить этот, убрать корневой `ENV_SETUP.md`) |
| `parsers/HOW_TO_GET_COOKIES.md` | 141 | `bandlink_parser_linux.py` | **сирота** | **LIKELY** — сама процедура ещё нужна для `/api/bandlink/cookies`; переписать, а не удалять |
| `parsers/MAC_TESTING.md` | 176 | `run_mac_test.py`, `bandlink_parser_mac.py`, `test_mac.sh` | все три **сироты** | **SAFE** |
| `parsers/SAFE_PARSER_README.md` | 128 | `bandlink_parser_safe.py` | **сирота** | **SAFE** |
| `parsers/SITEKEY_SEARCH_GUIDE.md` | 122 | `sitekey_finder.py` | **сирота** | **SAFE** |
| `parsers/WEB_UNLOCKER_README.md` | 193 | `bandlink_parser_unlocker_linux.py` | **сирота** | **SAFE** |
| `parsers/WEB_UNLOCKER_PROXY_README.md` | 178 | тот же скрипт, режим прокси | **сирота** | **SAFE** — прямой дубль предыдущего: один скрипт, два документа, один день коммита |

### 6.4 `openspec/` (30 файлов)

| группа | статус | увер. |
|---|---|---|
| `openspec/AGENTS.md` (456), `openspec/project.md` (262) | `project.md` содержит **ту же устаревшую формулировку, что и ARCHITECTURE.md**: «Storage: File-based JSON (data/*.json), SQLite для парсеров», «Integrations: Pyrus API» | **LIKELY** — правка одной строки, не удаление: файл управляется OpenSpec и от него зависит `pnpm spec:validate` |
| `openspec/specs/*` (9 спек, 976 строк) | `forms-integration/spec.md` — Pyrus-сторона, заменяется через `openspec/changes/replace-pyrus-with-buildin-forms/` | **RISKY** — удалять руками нельзя, для этого есть `openspec archive` |
| `openspec/changes/replace-pyrus-with-buildin-forms/` (6), `refactor-buildin-ops-workspace/` (5) | активные | оставить |
| `openspec/changes/add-playlist-scheduler/` (3) | **застряло на 7 месяцев**; его предмет — `lib/scheduler.ts`, см. §3.4 | **LIKELY** — архивировать |
| `openspec/changes/archive/2026-05-31-update-contracts-supabase-only/` (5) | уже в архиве | оставить |

### 6.5 Группы дублирующей документации

| тема | документы | что оставить |
|---|---|---|
| архитектура/хранение | `ARCHITECTURE.md` (01-09), `API_DOCUMENTATION.md` §1103–1185 (07-26), `openspec/project.md` (01-09), `README.md` (07-22) | `README.md` + `API_DOCUMENTATION.md` |
| парсер bandlink | 9 документов: `BANDLINK_PARSER_README.md`, `DOCKER_PARSER_README.md`, `BRIGHT_DATA_SETUP.md`, `БЕЗОПАСНЫЙ_ПАРСЕР.md`, `parsers/{SAFE_PARSER_README,MAC_TESTING,WEB_UNLOCKER_README,WEB_UNLOCKER_PROXY_README,HOW_TO_GET_COOKIES}.md` | `openspec/specs/playlist-parsers/spec.md` + `BANDLINK_PARSER_README.md`; **остальные 8 — про скрипты-сироты** |
| Web Unlocker | `parsers/WEB_UNLOCKER_README.md` + `parsers/WEB_UNLOCKER_PROXY_README.md` | ни один — один сиротский скрипт на два документа |
| 2captcha | `ENV_SETUP.md` (2025-10-14), `parsers/2CAPTCHA_SETUP.md` (2026-04-18) | `parsers/2CAPTCHA_SETUP.md` |
| деплой Supabase/Postgres | `SUPABASE_SETUP.md` (02-13), `docs/TIMEWEB_PERSISTENCE.md` (06-05), `README.md` (07-22) | `docs/TIMEWEB_PERSISTENCE.md` |
| токен Buildin | `docs/BUILDIN_TOKEN_SETUP.md`, `docs/BUILDIN_MIGRATION.md` §16, `SECURITY.md` §5 | `docs/BUILDIN_MIGRATION.md` |
| перф дашборда | `DASHBOARD_PERF_ACCEPTANCE.md` + `DASHBOARD_PERF_BASELINE.md` | слить в один |
| дизайн-система | `.cursorrules` (нормативный), `AUDIT_DESIGN.md` (снимок находок) | `.cursorrules` |
| аудиты | `AUDIT.md`, `AUDIT_FUNCTIONAL.md`, `AUDIT_DESIGN.md` (~98 КБ) | все три — срезы во времени, архивировать комплектом |

---

## Порядок удаления

Последовательность выстроена по одному принципу: **сначала обратимое, потом необратимое; сначала листья графа,
потом то, что от них зависит.** Зависимости между шагами реальные, не стилистические — например, 20 пакетов из
раздела 4.3 нельзя удалять до шага 3, потому что до него они формально «используются».

### Чем страховаться и где страховки нет

`pnpm build` · `pnpm lint` · `pnpm test` (19 unit-файлов) · `tests/integration` (2) · `tests/e2e` (1).
Тесты покрывают **только формы, Buildin и форматирование**. Дашборд, релизы, отчёты, плейлисты и парсеры
не покрыты ничем — на шагах 5 и 6 зелёный билд означает лишь «типы сошлись», а не «работает».
Там, где это критично, ниже помечено «нужна ручная проверка».

Рабочее дерево на момент написания чистое: работа по очередям форм Buildin закоммичена (`3ef9653` + следующий
за ним коммит), незакоммиченных правок нет. Отдельная ветка под чистку ещё не создана.

### Стоп-лист: не удалять ни на каком шаге

| что | почему |
|---|---|
| `types/ssh2-sftp-client.d.ts` | ambient-типы; без него `tsc` падает в трёх живых модулях (2.6) |
| `lib/api-perf-log.ts` | `jsonWithPerfLog` импортируют три живых роута (2.0) |
| `lib/report-acknowledgment.ts`, `lib/artist-report-requirements.ts` | живые модули, сироты только часть поверхности (2.0) |
| `app/api/cron/forms-health/route.ts` | двухнедельная CI-задача падает жёстко (5.2) |
| `app/api/admin/buildin/*` — 4 маршрута | ops-ручки из runbook миграции, включая гейт `cutoverReady` (5.2) |
| `app/api/submit-pyrus-*` — 5 маршрутов | `docs/PYRUS_ARCHIVE.md:5` требует сохранить имена ради стабильности URL; при отключённом Pyrus они пишут в Buildin (5.2) |
| `next-env.d.ts:1-5` | генерируется Next.js (2.13) |
| `prisma` в dependencies | перенос в devDeps ломает установку с `--prod` в Docker (4.2) |
| `data/*.json`, `backups/` | **на диске оставить**, только вывести из git — там пароли, см. шаг 1 |
| всё под `parsers/` | выбирается строковыми путями в рантайме, из TS не судится (2.15) |

### Шаги

**Шаг 1 — `.gitignore` и вывод мусора из-под версий. Полностью обратимо, диска не касается.**
Добавить шаблоны из раздела 1, затем `git rm --cached` для 39 файлов, отслеживаемых вопреки `.gitignore` (1.12),
и для дампов, `.db`, логов, офисных файлов, `data/releases_backup_*`. **Файлы на диске не трогать.**
Эффект: чекаут легчает примерно на 27 МБ, индексируемая агентом поверхность падает почти вдвое.
Отдельно закрыть дыры в `.gitignore` (1.14): `venv_selenium/`, `test_env/`, `parsers/mac_test_env/`, `tmp/`,
`logs/`, `reports/`, `uploads/`, общий `*.log`.
Осторожно: вместе с мусором в `tmp/` не отслеживается и **реальная незавершённая работа** (1.14) — эти 10 файлов
надо, наоборот, добавить в git, а не смести.
Прогон: `pnpm build`. Риск: нулевой.

**Шаг 2 — корневые отладочные файлы. Первое настоящее удаление, изолированное.**
`test.ts`…`test9.ts`, `test-api.ts`, `test-base64.ts`, `test-fetch*.ts`, `test-prisma-dates.ts`, `test-sort.js`,
`App.tsx`, `App.css`, `examples/ExamplePage.tsx`, файлы с битыми именами (1.6), `debug_*.html`, `deploy-logs-*` (2.8, 1.7, 1.8).
Все SAFE, ни одного входящего импорта. Побочный выигрыш: `tsconfig.json` с `include: ["**/*.ts","**/*.tsx"]`
перестаёт их типизировать в CI.
Прогон: `pnpm build` + `pnpm lint`. Риск: низкий.

**Шаг 3 — мёртвые компоненты. Листья графа, дальше всех от продакшена.**
Порядок внутри шага важен: сперва `components/ui/*` (30 файлов, 2.3) и `components/theme-provider.tsx`, затем блок
2.2 (27 файлов лендинга и debug), затем из 2.4 только два SAFE — `report-uploader.tsx` и
`charts/TotalStreamChart.tsx`.
**Не трогать на этом шаге:** `missing-contract-banner*` (RISKY — вероятный регресс, спека требует баннер на
странице отчётов), `playlist-crawler-*` (LIKELY — целая фича без обвязки), `auth-check.tsx` (три документа его
описывают как живой).
Помнить: `components.json` — реестр shadcn; удалённые `ui/*` вернёт `npx shadcn add <name>`, если понадобятся.
Прогон: `pnpm build` + `pnpm lint`. Риск: низкий, но **нужна ручная проверка лендинга и кабинета** — тестов там нет.

**Шаг 4 — мёртвые модули `lib/`. Только после шага 3.**
Шесть SAFE из 2.5: `report-generator.ts`, `excel-utils.ts`, `cached-admin-reports.ts`, `platform-partner-icon.ts`,
`fetch-artist-releases-all.ts`, `buildin/index.ts`. Плюс `hooks/use-mobile.tsx` и `hooks/use-toast.ts` (2.6) —
они мёртвы только через удалённые на шаге 3 `ui/sidebar.tsx` и `ui/toaster.tsx`, то есть именно сейчас становятся
безусловно мёртвыми. Плюс `app/forms/forms-client.tsx` (2.6).
**Отложить:** `sftp-explorer.ts` и `sftp-downloader.ts` — умрут вместе со своими скриптами на шаге 8;
`sqlite3-lazy.ts` — сначала решение по инлайновым `require('sqlite3')` в роутах.
Прогон: `pnpm build` + `pnpm lint` + `pnpm test`. Риск: низкий.

**Шаг 5 — мёртвые API-маршруты. Первый шаг, где ошибка видна пользователю.**
Сначала три SAFE-заглушки, отдающие 410: `pyrus-file-upload`, `reports/process`, `reports/process-new`.
Затем LIKELY, каждый — отдельным коммитом, чтобы откат был точечным:
`artist-dashboard/[username]` и `balance/[artistId]` (точные дубли RSC-путей) · `excel/[artistId]` ·
`reports/save` · `cron/playlists` (оркестратор в обход которого всё и так ходит) · `activities/parser-log` ·
`upload-progress/[id]` — вместе с ним осиротеет `app/api/progress-stream.ts`, удалять их одним коммитом.
**`reports/clear-fake` удалить обязательно**: это не только мёртвый маршрут, но и известная CSRF-дыра
(`AUDIT.md:81,252`) — деструктивная операция на GET. Его удаление закрывает P1-находку.
Прогон: `pnpm build` + `pnpm lint` + `pnpm test` + e2e форм. **Нужна ручная проверка** дашборда артиста,
страницы платежей и админских отчётов — автотестов на них нет.

**Шаг 6 — зависимости. Только сейчас, не раньше.**
До шага 3 эти пакеты формально «использовались». Порядок: `kysely` (SAFE, 0 совпадений во всём репо), затем
`exceljs` и `critters` (LIKELY), затем 20 пакетов из 4.3, освободившихся после удаления `components/ui/*` —
16 `@radix-ui/*`, `embla-carousel-react`, `sonner`, `next-themes`, `styled-components`.
Переносы в devDependencies: `@types/archiver`, `@types/pg`. Удалить `@types/xlsx` и, вероятно, `@types/bcryptjs` —
оба пакета везут свои типы.
Обновить lock-файл. Прогон: `pnpm install` + `pnpm build` + `pnpm lint` + `pnpm test`. Риск: средний —
это единственный шаг, где ломается сборка, а не рантайм, то есть ошибка видна сразу.

**Шаг 7 — сужение экспортов. Косметика, можно и пропустить.**
59 настоящих сирот (2.9) удалить, 142 «используется только внутри своего файла» (2.10) — снять слово `export`.
Делать **после** шага 5, потому что удаление маршрутов создаёт новых сирот: список надо пересчитать, а не
брать этот. Строк почти не убавится, читаемость публичной поверхности вырастет заметно.
Не трогать `lib/pyrus-public-schemas.ts:191` — переименовывающий реэкспорт (2.10).
Прогон: `pnpm build` + `pnpm test`.

**Шаг 8 — скрипты. Не автоматизируется, нужен человек.**
49 файлов (2.7), все LIKELY: статический анализ не видит историю команд оператора. Предложение — не удалять,
а перенести в `scripts/archive/` одним коммитом, и удалить через квартал, если никто не хватится.
`migrate-to-supabase.ts` и `setup-buildin-form-databases.ts` оставить на месте — они процитированы в runbook.
Вместе с их скриптами уходят `lib/sftp-explorer.ts` и `lib/sftp-downloader.ts` из шага 4.

**Шаг 9 — документация.** Это уже фаза 3, а не чистка: раздел 6 отчёта, `ARCHITECTURE.md` и `AGENTS.md`.

### Что в этот порядок не входит

- **Слой хранения** (раздел 3). `lib/storage.ts` — фасад над Prisma, а не второе хранилище; проблема там
  в обходе побочных эффектов, а не в мусоре. Отдельная задача.
- **Пароли в git-истории.** Шаг 1 убирает файлы из HEAD, но **историю не чистит**. Нужны `git filter-repo`/BFG
  и ротация паролей — и это делается до, а не после публикации репозитория куда-либо.
- **`StreamAnalytics` без `CREATE TABLE` в миграциях** (5.7) — дефект, ломающий `prisma migrate deploy` на
  пустой базе. Чинится, а не удаляется.
- **Два планировщика одновременно** (3.4) и **захардкоженный ref Supabase** (2.14) — решения человека.

---

## Замечено, но не входит в задачу

Ничего из этого не тронуто и не предлагается к удалению — это находки «по дороге».

1. **Пароли в git-истории.** `data/users.json` в HEAD, 45 записей `"password"`. Плюс 5 копий
   `data/users_backup_*.json`, плюс `backups/backup_2025-10-10_01-21-45.zip`. Удаление файлов из HEAD
   историю не чистит: нужна перезапись (`git filter-repo`/BFG) **и** ротация паролей. Сюда же —
   `parsers/koala_config.json`, `temp_bandlink_config.json`, `test_selenium_mac.json`.
2. **Пароли открытым текстом — осознанное решение.** `lib/storage.ts:355-358`: комментарий
   «J1 (решение владельца): пароли хранятся открытым текстом, чтобы админ мог заходить в профили
   артистов. Хеширование убрано». Старые bcrypt-хеши ещё проверяются в
   `app/api/auth/login/route.ts`. Это архитектурное решение, а не баг для чистки.
3. **Два планировщика включены одновременно** (§3.4). `.env.example` по умолчанию ставит
   `ENABLE_IN_PROCESS_SCHEDULER=true` рядом с системным `crontab` — двойные запуски парсеров.
   `AUDIT.md:296` это уже фиксирует. Требуется решение человека, а не удаление файла.
4. **Подтверждение отчёта не доходит до зеркала Buildin** (§3.2). Функциональное расхождение,
   а не мусор. Аналогично — создание отчётов из трёх маршрутов из четырёх и удаление отчётов
   вообще без архивации.
5. **`.gitignore` дырявый**: нет правил для `venv_selenium/`, `test_env/`, `parsers/mac_test_env/`,
   `tmp/`, `logs/`, `reports/`, `uploads/`, нет общего `*.log`. Из-за последнего в git попали 6 логов.
6. **Каталог с пробелом в имени** — `screens new/`. На него ссылается комментарий
   `app/globals.css:1634` как на источник истины по размерам стат-карт.
7. **Узкое тестовое покрытие.** 19 unit-файлов (в основном buildin/pyrus/форматирование),
   2 интеграционных и 1 e2e — все про формы. Дашборд, релизы, отчёты, плейлисты и парсеры
   тестами не покрыты. Это прямо влияет на раздел «Порядок удаления»: страховки там нет.
8. **Незакоммиченная работа рядом с мусором** (§1.14). На момент прогона 11 файлов реальной незавершённой
   работы лежали неотслеживаемыми вперемешку со 140 файлами хлама в `tmp/`. Закрыто: работа по очередям форм
   Buildin закоммичена, `docs/CLEANUP_PROMPTS.md` и этот отчёт — следующим коммитом. Наблюдение остаётся в силе
   как класс проблемы: пока в `.gitignore` нет правила на `tmp/`, `git add -A` в любой момент снова смешает одно
   с другим.
