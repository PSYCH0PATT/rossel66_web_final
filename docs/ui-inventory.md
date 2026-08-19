# Инвентаризация UI

Проект **rossel-music** (Next.js), скоуп — только личные кабинеты. Данные четырёх сканов: админ-ЛК (`app/dashboard/admin`, 29 tsx, ~9900 строк), артист-ЛК (`app/dashboard/**`, 21 tsx + `dashboard.css`), дашборд-компоненты (`components/*` + `analytics/` + `charts/`, 27 файлов), дизайн-система (`components/ui`, 22 файла + `globals.css` + `tailwind.config.js`). Всего вне ui-кита просканировано 77 tsx-файлов.

## Сводка в цифрах

| Метрика | Значение |
|---|---|
| Raw `<button>` всего | **48** (админ 30, артист 9, компоненты 9, ui-кит 0) |
| Уникальных «диких» вариантов кнопок | **36** (админ 12, артист 9, компоненты 15) |
| Файлов с вёрсткой без единого импорта из `components/ui` | **39 из 77** (админ 8/29, артист 19/21, компоненты 12/27) |
| Файлов с arbitrary-цветами (hex/rgba в классах) | **27** (админ 9, артист 10, компоненты 5, срез ДС 3) |
| Вариантов шапки страницы | **7** (при полном отсутствии PageHeader/Breadcrumb в ui-ките) |
| Raw `<input>` / `<select>` / `<table>` | 14 / 3 / 10 |
| Inline `style={{}}` | ~89 (админ 45, артист 21, компоненты 22, ui 1 легитимный) |
| Вхождений arbitrary-цветов в tsx | ~131 (админ 50, артист 65, компоненты ~13, ui/select 3) + 88 в `globals.css` + 15 хексов в `tailwind.config.js` |
| Написаний акцентного зелёного | минимум 5: токен `bg-primary` (hsl 160 64% 40%), hex `#10b981`, `emerald-400/500/600`, config `emerald: #00C957`, `--primary` |
| Использований ui/Button в components/* | 31 в 10 файлах (при 9 raw-кнопках рядом) |

## Варианты кнопок

Сигнатура → где используется → чем заменить.

| # | Сигнатура | Где | Замена |
|---|---|---|---|
| 1 | shadcn `variant="outline"` без className (19x) | 9 админ-страниц | оставить (эталон) |
| 2 | shadcn default без className (11x) | 7 админ-страниц | оставить (эталон) |
| 3 | Primary CTA, токен: `bg-primary text-black hover:bg-primary/90` (~17x + вариации) | 8 админ-страниц; `artist-advances`, `artist-linked-profiles` | ui/button `variant=default` |
| 4 | Primary CTA, hex + glow: `bg-[#10b981] hover:bg-emerald-400 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,…)]` | админ: artists-client, analytics, releases/add, releases-client; артист: settings x2, playlists/[id]; `artist-reports`, `unmapped-artists-panel` | ui/button `variant=default` (glow — единый `variant=cta`, если нужен) |
| 5 | Primary CTA: `bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl h-12` | `login-form` | ui/button `variant=default size=lg` |
| 6 | Primary CTA: `bg-emerald-600 hover:bg-emerald-700 text-white` (единственная с белым текстом) | `simple-report-uploader` | ui/button `variant=default` |
| 7 | Серый outline в 2 написаниях: `border-white/20` (7x) и `rounded-lg border-white/15 text-gray-300 hover:bg-white/5` (9x) | 6 админ-страниц | ui/button `variant=outline` + правка токена `border-input` |
| 8 | Danger в 4 написаниях (outline red-500/50, `bg-red-600`, ghost red, raw icon red) | playlists, settings, artists/[id], artists/[id]/playlists, releases-client | `variant=destructive` + новый `destructive-outline` |
| 9 | Легаси azure: `bg-azure hover:bg-azure-dark text-black` (4x) + outline-azure (2x) | `artists/[id]/payments`, `artists/[id]/releases` | `variant=default` при редизайне легаси-страниц |
| 10 | Тулбар releases: общий `toolbarBtnClass` + цвета через `style={{borderColor,color,background:rgba}}` (7x) | `admin-releases-client` | новый **Toolbar/ToolbarButton** |
| 11 | Пагинационные pill-кнопки (rounded vs rounded-lg, hex vs токен, min-h-11 только у artists) | admin-releases-client, admin-artists-client, activity; артист: releases-client (5 raw) | новый **Pagination** |
| 12 | Сегмент-переключатель периода: `text-[10px] font-bold uppercase`, active `bg-emerald-500/10 text-emerald-400` | admin/analytics, artist/analytics | новый **SegmentedControl** (или ui/tabs) |
| 13 | Ghost-мини аналитики: `ghost text-[10px] uppercase h-7/h-8 hover:bg-[#141414]` | admin/analytics, `unmapped-artists-panel` | `variant=ghost size=sm` |
| 14 | Стеклянные outline (date-picker): `bg-[#141414]/60 backdrop-blur-xl border-white/5 h-9` | admin/analytics, artist/analytics | `variant=outline` + glass-токен |
| 15 | Круглые икон-кнопки: `p-1.5 rounded-full bg-primary/90|bg-destructive/90` | admin/playlists | ui/button `size=icon variant=default/destructive` |
| 16 | Кнопка закрытия баннера (raw, скопирована дословно 3 раза) | admin: playlists:873, settings:329, unregistered-reports:160 | **Banner/Alert с onClose** |
| 17 | Raw икон-кнопки 44px: `h-11 w-11 rounded-lg text-gray-400 hover:bg-white/5` | sidebar, top-nav, artist-reports | ui/button `variant=ghost size=icon` |
| 18 | Raw logout x2 (hover-фон различается: red-500/10 vs white/5) | sidebar, top-nav | ui/button `variant=ghost` + danger-текст, один компонент |
| 19 | Фильтр-чипы с inline-hex (`#3b82f6/#ef4444/#f97316/#f59e0b`) | `reports-list` (4 шт) | новый **FilterChip** на токенах |
| 20 | Зелёный/красный outline «Скачать»/«Удалить» (`border-green-500/50`, `border-red-500/50`) | reports-list, unregistered-reports-list, pending-signature-list, artist-advances, artist-linked-profiles | `variant=outline` + success/destructive токены |
| 21 | Ghost-шеврон свёртывания квартала (slate) | reports-list, unregistered-reports-list | `variant=ghost size=icon` |
| 22 | Combobox-триггер выбора артиста | `unmapped-artists-panel` | оставить (стандарт shadcn combobox) |
| 23 | Текстовые ссылки-действия («Все релизы», «Сбросить поиск», border-b link) | artist page, dashboard-client, releases-client | ui/button `variant=link` |
| 24 | Outline-primary pill (Link-как-кнопка) и ghost-outline «Назад» | artist page, releases/[id] | `variant=outline size=sm` |
| 25 | Соцсети-чипы (внешние `<a>` с платформенным цветом текста) | artist page | оставить как `<a>`, вынести в компонент |
| 26 | Amber-Link «под кнопку» (`border-amber-500/30 text-amber-200`) | `missing-contract-banner-client` | `variant=outline` + warning-токен |

**Итог:** primary-CTA существует минимум в **6 несовместимых написаниях** (строки 3–6 + hex-glow + сток shadcn); danger — в 4; серый outline — в 2. Всё сводится к стоковым вариантам ui/button + 4 новым компонентам (Toolbar, Pagination, SegmentedControl, FilterChip).

## Шапки страниц

| Группа / файлы | Как устроена | Отличия |
|---|---|---|
| **A. Админ-стандарт** (11): activity, payments, settings, reports, reports-generator, unregistered-reports, playlists/history, artists/add, artists/[id], artists/bulk-add, releases/[id] | `border-b border-white/5 pb-8` (releases/[id] — pb-6); h1 `font-display text-3xl md:text-4xl uppercase`; subtitle `text-sm text-gray-400 mt-2` | breadcrumb «К списку» только на 5 (artists add/[id]/bulk-add, releases add/[id]); actions справа — не везде |
| **B. Админ-крупный** (7): dashboard, artists list, playlists, analytics, releases/add, koala-parser, zvonko-parser | то же, но h1 `text-4xl md:text-5xl`; отступ то `mb-2` на h1, то `mt-2` на subtitle | analytics: `pb-6` + actions **под** h1; dashboard: `pb-4 md:pb-8` |
| **C. Releases-клиент админа** (1) | двухрядная: h1 `text-4xl/5xl` **без** класса uppercase и без subtitle; строка 2 — тулбар из 7 кнопок + raw search-input; `pb-6` | уникальна, не похожа ни на что |
| **D. Легаси** (3): artists/[id]/{payments,releases,playlists} | h1 `text-2xl font-bold` без font-display/uppercase; back-link с lucide ArrowLeft («Назад к списку артистов»); без border-b, без subtitle | другое поколение дизайна (azure-кнопки, lucide) |
| **E. Артист-канон** (10): releases, dashboard, analytics, payments, playlists, playlists/[id], releases/[id], activity, settings, page + `artist-reports.tsx` | `flex-col md:flex-row … md:items-end border-b border-white/5 pb-8`; h1 `text-4xl md:text-5xl mb-2`; subtitle `max-w-md`; actions справа | breadcrumb нет **нигде** (в releases-client — пустой комментарий `{/* Breadcrumb */}`, в releases/[id] вычисленные href не используются); dashboard ужимает mobile-отступы; analytics один на `lg:` вместо `md:` |
| **F. Голый h1** (1): admin artists/[id]/reports | `h1 text-2xl font-bold` в space-y-6, больше ничего | минимальный |
| **G. Login** | шапки нет: центрированная колонка, свой шрифт, styled-jsx keyframes | автономный экран |

**Вывод:** один и тот же паттерн «h1 + subtitle + border-b pb-8 + actions» скопипащен в **~34 экранах** с расхождениями в размере h1 (3 группы), pb (4/6/8), отступе subtitle (mt-2 vs mb-2) и брейкпоинте (md vs lg). Breadcrumb двух видов существует на 5 админ-страницах, в артист-ЛК отсутствует, а в `top-nav.tsx` `generateBreadcrumbs()` полностью вычисляется и **не рендерится** (мёртвый код). Нужен единый **PageHeader** с пропсами `title, subtitle, backHref/breadcrumbs, actions, size`.

## Raw-элементы по файлам

| Файл | button | input | select | table | прочее |
|---|---|---|---|---|---|
| admin/releases/admin-releases-client.tsx | 15 | 1 | — | 1 | 24 inline style |
| admin/artists/admin-artists-client.tsx | 5 | 1 | — | — | |
| admin/analytics/page.tsx | 3 | 3 | — | — | |
| admin/playlists/page.tsx | 3 | — | — | — | |
| admin/artists/[id]/page.tsx | 1 | 1 | — | — | |
| admin/dashboard/admin-dashboard-client.tsx | 1 | — | — | — | |
| admin/settings/page.tsx | 1 | — | — | 1 | |
| admin/unregistered-reports/page.tsx | 1 | — | — | — | |
| admin/artists/add, releases/[id], releases/add | — | 1+1+1 | — | — | |
| admin/releases/zvonko-parser | — | — | 1 | — | |
| admin/activity, artists/bulk-add, payments-client, playlists/history | — | — | — | 1 каждый | |
| artist/releases/releases-client.tsx | 5 | 1 | — | 1 | |
| artist/settings/artist-settings-client.tsx | 2 | 4 | — | — | 1 img |
| artist/releases/[id]/page.tsx | 1 | — | — | 1 | |
| artist/analytics/page.tsx | 1 | — | — | — | 1 styled-jsx |
| artist/playlists/[id]/page.tsx | — | — | — | 1 | 1 a |
| artist/[username]/page.tsx | — | — | — | — | 3 a, 1 img |
| artist/playlists/page.tsx; login | — | — | — | — | 1 a; 1 styled-jsx |
| components/sidebar.tsx | 2 | — | — | — | |
| components/top-nav.tsx | 2 | — | — | — | |
| components/artist-reports.tsx | 5 | — | — | — | |
| components/artist-linked-profiles.tsx | — | — | 1 | — | |
| components/profile-filter.tsx | — | — | 1 | — | |
| components/report-preview.tsx | — | — | — | 1 | |
| components/report-processor.tsx | — | — | — | — | 1 details |
| **Итого** | **48** | **14** | **3** | **10** | |

Примечательно: 6 админ raw-таблиц имеют идентичную thead-строку (`text-left text-xs font-mono uppercase text-gray-500 border-b border-white/10`), при этом ui/Table используется лишь в 3 файлах (koala-parser, zvonko-parser, unregistered-reports).

## Arbitrary-цвета и inline-стили

| Файл | Arbitrary | Inline style | Что именно |
|---|---|---|---|
| app/globals.css | 88 (73 rgba + 15 hex) | — | статус-бейджи, glass, scrollbar — мимо токенов |
| artist/analytics/page.tsx | 27 | 3 | JS-палитра SOURCE_COLORS (12 hex), `bg-[#141414]/60`, тени |
| admin/releases/admin-releases-client.tsx | 20 | 24 | `#10b981` x20; цвета тулбара через style; SelectContent inline `#0f1117` |
| artist/releases/releases-client.tsx | 18 | 9 | `#10b981` x15, `#1a1a1a`, `#0a0a0a` |
| tailwind.config.js | 15 | — | azure `#00FFFF`, emerald `#00C957`, category.*, accent-* |
| admin/analytics/page.tsx | 11 | 3 | `#141414`, `#1a1a1a`, `#0a0a0a`, `#10b981` |
| admin/artists/admin-artists-client.tsx | 7 | 7 | `#10b981` x6, `#1c1508` |
| admin/dashboard-client + artist/dashboard-client | 4+4 | — | `#c084fc/#10b981/#0ea5e9` иконки stat-карт, tooltip rgba |
| admin/playlists/page.tsx | 3 | 11 | `bg-[#0f0f0f]` (Dialog); брендовые цвета площадок inline (VK `#0077FF`, Yandex `#FFCC00`, MTS `#E30611`, Sber `#21A038`) — продублированы в 2 местах файла |
| artist/settings-client | 4 | — | `#10b981` x2 + glow-тени |
| unmapped-artists-panel / Track*Bar / artist-reports | 4/3+3/2 | —/2+2/— | `#141414`, `#1a1a1a`, `#0f0f0f`, `#10b981` |
| components/ui/select.tsx | 3 | — | форк под тёмное стекло `bg-[rgba(12,12,12,0.5)]` |
| reports-list / streaming-chart / DspStreamChart | — | 6/4/4 | hex-фильтры и Switch-цвета; самописные chart-tooltip |
| остальные (payments-client, playlists/[id], releases/[id], login, settings x2, artists/[id], bulk-add, unregistered, profile-filter, pending-signature, login-form и пр.) | 1–3 каждый | 1–5 | преимущественно `#0f0f0f` (Dialog) и `#10b981` |

Системные проблемы:
- Фон тёмных оверлеев задан **4 разными значениями**: `bg-[#0f0f0f]` (8 вхождений в 6 файлах), `bg-[#141414]` (analytics, panel, tooltips), `bg-[#1a1a1a]` (Popover), inline `#0f1117` (releases-client) — потому что дефолтная тема ui/dialog|popover светлая.
- `#10b981` захардкожен ~44+ раз в tsx при живом токене `--primary` того же цвета.
- 14 из 21 артист-inline-стилей — `style={{fontSize}}` на material-symbols лигатурах.

## Использование components/ui

**Не импортируют ui вообще (39 файлов с вёрсткой/логикой):**
- Админ (8): artists/[id]/reports, artists/page, dashboard/page, layout, payments/page, playlists/loading, releases/page, reports-generator (полностью самописный card-glass).
- Артист (19 из 21): всё, кроме `analytics/page.tsx` (Card/Select/Button/Calendar/Popover — каждый с полным override) и `artist-dashboard-client.tsx` (только Tooltip). Т.е. **артист-ЛК фактически самописный**.
- Компоненты (12): sidebar, dashboard-shell, dashboard-footer, activity-feed, streaming-chart(+lazy), playlist-cover-image, profile-filter, auth-check (@deprecated), missing-contract-banner(+client), DspStreamChart.

**Активные потребители ui:** admin/playlists (9 компонентов), analytics, artists/bulk-add, releases-клиенты; в components — reports-list (11 ui/Button), simple-report-uploader, report-processor (импортирует неиспользуемый Progress), unmapped-artists-panel (Command/Dialog/Popover). Параллельная система инпутов: `AdminInput/AdminSelect` только в admin/releases-client и admin/settings, остальные — ui/input|select.

**Два визуальных языка в components/:** «отчётный» slate-кластер (reports-list, unregistered-reports-list, pending-signature-list, simple-report-uploader, report-sort-controls: `border-slate-600/30`, lucide) против остального дашборда (gray-* + white/5 + card-glass + material-symbols). `report-processor.tsx` вообще свёрстан под **светлую** тему (bg-blue-50/red-50/amber-50, text-gray-900) внутри тёмного кабинета.

## Что уже есть в системе

- **components/ui: 22 файла** — 20 стоковых shadcn (new-york, baseColor neutral, cssVariables) + 2 самописных `admin-input`/`admin-select` (скин через data-атрибуты в `dashboard.css`). Raw-кнопок в ките ноль.
- **ui/button** — канонический cva: 6 вариантов (default/destructive/outline/secondary/ghost/link) и 4 размера, с a11y-патчем тач-таргетов 44px (`max-md:h-11`, `pointer-coarse:h-11`, кастомный вариант в tailwind-плагине). Т.е. замена почти всех 36 «диких» вариантов уже существует.
- **ui/select форкнут**: SelectContent/SelectItem захардкожены под тёмное стекло в обход токенов — единственный тёмный примитив без `.dark`.
- **Токены расходятся**: «изумрудный» в 3 значениях (config `emerald #00C957`, реальный акцент `#10b981`, `--primary hsl(160 64% 40%)`), «лазурный» в 2 (`#00FFFF` и `#0ea5e9`). `--radius` объявлен, но не подключён к borderRadius. `darkMode:["class"]` — но тёмный вид достигается хардкодом, primary/secondary одинаковы в обеих темах.
- **globals.css — 1769 строк, из них дашборду принадлежит ~293 (~17%)**; остальное лендинг. Внутри: 165 `!important`, дубли селекторов (`@keyframes float` дважды с разными телами, `.nav-*` дважды, `.sections-scroll-host` продублирован дословно, `::-webkit-scrollbar` дважды с конфликтом — дашбордная версия побеждает и красит весь сайт), мёртвый импорт шрифта Mulish, мёртвые копии `globals.css.backup` и `globals.css.original` рядом. Дашбордные паттерны (stat-card-glass, release-status-badge, table-glass, glass-panel) — это CSS-классы с хексами, а не React-компоненты; glass-утилиты разнесены между `globals.css` и `dashboard.css`.
- **В ките отсутствуют:** breadcrumb, separator, avatar, sheet, toast/sonner, form, pagination, scroll-area, sidebar, page-header — всё это страницы собирают вручную.

## Сводка: паттерн → дубли → чем закрыть

| Паттерн | Масштаб дублирования | Компонент |
|---|---|---|
| Шапка страницы (h1 + subtitle + border-b + actions) | ~34 экрана, 7 вариантов, 3 размера h1 | **PageHeader** (props: title, subtitle, back/breadcrumbs, actions, size) |
| Breadcrumb / back-link | 2 стиля на 9 страницах + мёртвый код в top-nav | **ui/breadcrumb** внутри PageHeader |
| Primary CTA | 6 написаний в ~20 файлах | **ui/button variant=default** (+ единый glow-вариант) |
| Danger-кнопки | 4 написания в 5+ файлах | **ui/button destructive / destructive-outline** |
| Пагинация + page-size чипы | raw-код в 3 файлах (releases-client admin 605–651, artists-client 207–399, artist releases-client) + ui-версия в reports-list | **Pagination** |
| Тулбар releases (7 кнопок, цвета inline) | 1 файл, но 15 raw-кнопок и 24 inline style | **Toolbar / ToolbarButton** |
| Поисковый инпут с иконкой | 2 raw-варианта (artists-client:191, releases-client:427) + profile-filter | **SearchInput** на ui/input |
| Raw-таблицы с одинаковым thead | 6 админ + 3 артист + report-preview | **ui/table** + пресет DataTable |
| KPI stat-карточки (stat-card-glass + иконка) | 4 (artist dashboard) + 3 (payments) + admin payments | **StatCard** |
| StatusBadge релиза (~100 строк, дословный дубль) | 2 файла + CSS-классы в globals.css | **ReleaseStatusBadge** на ui/badge + токены |
| Кнопка закрытия баннера | 3 дословные копии | **Banner/Alert с onClose** |
| Сегмент-переключатель периода | 2 (admin/artist analytics) | **SegmentedControl** |
| Секционный h2 + цветная палочка | 6+ мест (artist pages, advances, linked-profiles) | **SectionHeader** |
| Chart-tooltip | 3 несовместимых стиля (streaming-chart, DspStreamChart, Track*Bar) | **ChartTooltip** |
| Спиннеры загрузки | 3 исполнения (border-t-primary, Loader2, border-b-2 white) | **Spinner** |
| Empty/loading-состояния списков и чартов | releases-client («Сбросить поиск»), streaming-chart skeleton/empty | **EmptyState** |
| Фон Dialog/Popover | 4 hex-значения в 9+ файлах | тёмная тема **ui/dialog|popover** через токены |
| Фильтр-чипы и Switch с inline-hex | reports-list (4+2), pending-signature (1) | **FilterChip** + темизация ui/switch |
| Иконочные кнопки 44px | sidebar, top-nav, artist-reports, playlists | **ui/button size=icon** |
| Дубль-инпуты AdminInput vs ui/input | 2 файла на admin-*, остальные на ui | унификация на **ui/input** |
| Цвет `#10b981` / emerald / bg-primary | ~44+ хардкодов в tsx + rgba-тени | единый токен **primary** |
| Брендовые цвета площадок (VK/Yandex/MTS/Sber) | inline в 2 местах playlists/page.tsx | константа-палитра + PlatformBadge |
