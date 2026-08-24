# Бэклог разнобоя в кабинетах

Что осталось без канона после этапа 5 «канон шапки» (C-01). Здесь **только
фиксация масштаба** — ничего из списка в задачу канона не входило и не чинилось.
Каждый пункт — с примерами файлов и строк, чтобы оценить объём до того, как за
него браться.

Собрано проходом по всем экранам `app/dashboard/admin/**` и
`app/dashboard/artist/**` 24 августа 2026, сразу после применения канона шапки.
Системные причины и волны — в [ui-audit.md](ui-audit.md), вердикты по
иерархии — в [ia-decisions.md](ia-decisions.md).

---

## B-01. `mb-*` на блоках верхнего уровня — теперь мёртвый код

Корень страницы после канона шапки везде `space-y-8`, и он **побеждает**:
селектор Tailwind `.space-y-8 > :not([hidden]) ~ :not([hidden])` специфичнее
`.mb-12` и заодно выставляет этим детям `margin-bottom: 0`. То есть все `mb-*`
на блоках верхнего уровня перестали работать — ритм между секциями стал ровно
32px везде. Классы остались в разметке и вводят в заблуждение: читаешь `mb-12`,
а видишь 32.

Убрать их — правка чисто косметическая (визуально ноль), но затрагивает ~25
мест; в задачу канона не входила. Живыми `mb-*` остаются только у **вложенных**
блоков (не прямых детей корня) — вот там разнобой 32/40/48 настоящий и его
надо разбирать отдельно.

| Значение | Где | Пример |
|---|---|---|
| `mb-12` | сетки статистики, ленты | [admin-dashboard-client.tsx:94](../app/dashboard/admin/dashboard/admin-dashboard-client.tsx#L94), [artist-dashboard-client.tsx:65](../app/dashboard/artist/[username]/dashboard/artist-dashboard-client.tsx#L65), [payments-client.tsx:187](../app/dashboard/artist/[username]/payments/payments-client.tsx#L187), [playlists/page.tsx:82](../app/dashboard/artist/[username]/playlists/page.tsx#L82) |
| `mb-10` | ровно два места | [admin-artists-client.tsx:181](../app/dashboard/admin/artists/admin-artists-client.tsx#L181), [payments-client.tsx:175](../app/dashboard/artist/[username]/payments/payments-client.tsx#L175) |
| `mb-8` | карточки артист-ЛК | [artist-settings-client.tsx:178,199,255](../app/dashboard/artist/[username]/settings/artist-settings-client.tsx#L178), [releases/[id]/page.tsx:143,195](../app/dashboard/artist/[username]/releases/[id]/page.tsx#L143) |
| нет `mb`, ритм от `space-y-8` | весь админ-ЛК | [admin/activity/page.tsx:272](../app/dashboard/admin/activity/page.tsx#L272) |

## B-02. Плотность карточек — семь вариантов паддинга

`card-glass` встречается с семью разными паддингами; правила «когда какой» нет,
на соседних карточках одного экрана значения расходятся.

```
21 × p-6 md:p-8      11 × p-6      8 × p-5      6 × p-4
 4 × p-4 md:p-6       2 × p-0      1 × p-8
```

Примеры расхождения внутри одного экрана: [payments-client.tsx:117](../app/dashboard/artist/[username]/payments/payments-client.tsx#L117) (`p-4 md:p-6`)
против [payments-client.tsx:248](../app/dashboard/artist/[username]/payments/payments-client.tsx#L248) (`p-0`);
[admin/playlists/page.tsx:700](../app/dashboard/admin/playlists/page.tsx#L700) (`p-4 md:p-6`) против
[admin/activity/page.tsx:275](../app/dashboard/admin/activity/page.tsx#L275) (`p-6 md:p-8`).
Просится вариант плотности у самой карточки (`density="compact" | "regular"`),
а не класс по месту.

## B-03. Загрузочное состояние экрана — четыре раскладки

Один и тот же «спиннер посреди страницы» сверстан по-разному, и высота, на
которой он появляется, прыгает от экрана к экрану.

| Раскладка | Файлы |
|---|---|
| `flex justify-center py-16` | [releases/[id]:162](../app/dashboard/admin/releases/[id]/page.tsx#L162), [koala-parser:143](../app/dashboard/admin/releases/koala-parser/page.tsx#L143), [zvonko-parser:176](../app/dashboard/admin/releases/zvonko-parser/page.tsx#L176) |
| `flex items-center justify-center h-64` | [admin/analytics:361,702](../app/dashboard/admin/analytics/page.tsx#L361), [artists/[id]/payments:104](../app/dashboard/admin/artists/[id]/payments/page.tsx#L104), [artists/[id]/playlists:65](../app/dashboard/admin/artists/[id]/playlists/page.tsx#L65), [artists/[id]/releases:64](../app/dashboard/admin/artists/[id]/releases/page.tsx#L64), [artist/analytics:205,345](../app/dashboard/artist/[username]/analytics/page.tsx#L205) |
| `flex min-h-[40vh] items-center justify-center` | [artist releases/[id]:106](../app/dashboard/artist/[username]/releases/[id]/page.tsx#L106) |
| скелетон вместо спиннера | [admin/playlists/loading.tsx](../app/dashboard/admin/playlists/loading.tsx) — единственный `loading.tsx` во всём кабинете |

Просится `PageLoading` в ките (C-14 закрыл `Spinner`, но не его обрамление).
Заодно: скелетон есть ровно у одного роута из 31 — остальные показывают спиннер
или пустой экран.

## B-04. Пустые состояния и экраны ошибок — два поколения

`EmptyState` используется в 31 месте, но ветки «не найдено» на пяти страницах
сверстаны руками, до кита, и с ручной крошкой-ссылкой вместо шапки:

- [admin/artists/[id]/page.tsx:303–315](../app/dashboard/admin/artists/[id]/page.tsx#L303) — `space-y-6` + `<Link>` «Назад к списку артистов» + `Banner`
- [admin/artists/[id]/payments/page.tsx:113](../app/dashboard/admin/artists/[id]/payments/page.tsx#L113) — то же
- [admin/artists/[id]/playlists/page.tsx:74](../app/dashboard/admin/artists/[id]/playlists/page.tsx#L74) — то же
- [admin/artists/[id]/releases/page.tsx:73](../app/dashboard/admin/artists/[id]/releases/page.tsx#L73) — то же
- [admin/artists/[id]/reports/page.tsx:10](../app/dashboard/admin/artists/[id]/reports/page.tsx#L10) — `<div className="text-center py-8 text-gray-400">Артист не найден</div>`, вообще без шапки и действия

У этих экранов нет PageHeader — то есть при ошибке пользователь теряет заголовок
и навигацию. Канон шапки их не трогал: там нет H1.

## B-05. Подпись возврата — три формулировки

Канон C-01 свёл возврат в слот `backHref` шапки, но текст крошки остался разный:

- `К списку` (дефолт компонента) — [artists/add](../app/dashboard/admin/artists/add/page.tsx#L155), [artists/bulk-add](../app/dashboard/admin/artists/bulk-add/page.tsx#L169), [artists/[id]](../app/dashboard/admin/artists/[id]/page.tsx#L324), [releases/add](../app/dashboard/admin/releases/add/page.tsx#L188), [releases/[id]](../app/dashboard/admin/releases/[id]/page.tsx#L212)
- `Назад к списку артистов` — [artists/[id]/payments:134](../app/dashboard/admin/artists/[id]/payments/page.tsx#L134), [artists/[id]/releases:94](../app/dashboard/admin/artists/[id]/releases/page.tsx#L94)
- `Назад` — [artist releases/[id]](../app/dashboard/artist/[username]/releases/[id]/page.tsx#L134)

Плюс внутри контента живут ещё две формулировки того же действия: «Вернуться к
релизам» ([artist releases/[id]:121](../app/dashboard/artist/[username]/releases/[id]/page.tsx#L121))
и «Вернуться к релизу» в состоянии «Релиз удалён»
([admin releases/[id]:181](../app/dashboard/admin/releases/[id]/page.tsx#L181) — судя по контексту, опечатка: ведёт на список).
Тексты в задачу канона не входили, поэтому оставлены как есть.

## B-06. Отступ у SectionHeader — четыре значения

`mb-6` (12 раз), `mb-2` (2), `mb-1` (2), `mb-0` (2) — задаются классом по месту,
хотя это тот же случай, что и с шапкой: отступ должен жить в компоненте.
Примеры: [admin/activity:276](../app/dashboard/admin/activity/page.tsx#L276) (`mb-0`),
[playlists/history:173](../app/dashboard/admin/playlists/history/page.tsx#L173) (`mb-6`),
[artist-settings-client:181](../app/dashboard/artist/[username]/settings/artist-settings-client.tsx#L181) (`mb-6`).

## B-07. Сетки карточек — 14 разных наборов колонок

`grid grid-cols-*` в кабинетах написан 14 несовпадающими способами. Два из них
явно каноничны и повторяются (`grid-cols-2 sm:grid-cols-2 lg:grid-cols-3
xl:grid-cols-4 gap-3 sm:gap-6` — 8 раз; `grid-cols-2 md:grid-cols-2
xl:grid-cols-4 gap-3 md:gap-6` — 2), остальные двенадцать — по одному-два раза.
Разные брейкпоинты дают на планшете разное число колонок у соседних экранов:
[admin-artists-client:181](../app/dashboard/admin/artists/admin-artists-client.tsx#L181)
(`md:grid-cols-3`) против [payments-client:71](../app/dashboard/artist/[username]/payments/payments-client.tsx#L71)
(`md:grid-cols-2 xl:grid-cols-3`).

## B-08. Плотность таблиц — два значения по вертикали

В ячейках `DataTable` живут и `py-3`, и `py-4` (8 и 7 вхождений), при одинаковом
`px-6`. Строки соседних таблиц отличаются по высоте на 8px. Плотность должна
быть пропом `DataTable`, а не классом ячейки.

## B-09. Клампы h1 в `dashboard.css` пережили канон

[dashboard.css:105–123](../app/dashboard/dashboard.css#L105) держит два
медиазапроса, которые перебивают размер H1 на всём, что уже 1024px:
`clamp(1.5rem, 7.5vw, 2.25rem)` до 640 и `clamp(1.75rem, 4.5vw, 3rem)` на
641–1023. Написаны они были как обходной путь, пока размер задавался классами в
~30 местах; теперь размер один и живёт в PageHeader, и адаптив логичнее держать
там же, а из глобального CSS убрать. Пока не трогал: это меняет типографику на
мобиле и планшете на всех экранах разом и требует своего визуального прогона.

## B-10. Подвал страницы рисует не shell — ЗАКРЫТО (этап 5, часть Б)

Было: `<DashboardFooter />` вызывался вручную из 23 файлов, а не из `DashboardShell`, —
на части экранов его просто не было (остаток F-30). Закрыто не переносом в shell, а
удалением: решение владельца 0-д п.1 (docs/ia-decisions.md) — подвала «Система работает»
в кабинете больше нет, компонент `components/dashboard-footer.tsx` удалён.

## B-11. `cn()` может молча съедать классы — проверять надо весь кит

При канонизации шапки выяснилось, что `cn()` (это `twMerge`) держит
`text-balance` и `text-4xl` в одной группе `text-*` и выбрасывает первый.
Из-за этого `text-balance` у H1 не доезжал до разметки вообще, и фикс F-83
(перенос «РЕДАКТИРОВАНИ / Е» на 390) годами не работал — при том что класс
в исходнике был. Лечится тем, что строка перестала идти через `cn()`
([page-header.tsx:134](../components/ui/page-header.tsx#L134)).

Проверить остальные компоненты кита на тот же класс проблем: везде, где
`cn()` склеивает базовые классы с вариантными, утилита из «спорной» группы
(`text-balance`, `text-pretty`, `text-nowrap`, `text-clip`/`text-ellipsis`
рядом с размером или цветом) может исчезать так же тихо. Быстрый способ
проверки — прогнать twMerge на паре аргументов из компонента и сравнить вход
с выходом.

## B-12. Стенд не показывает половину контента двух экранов

Не разнобой вёрстки, а дыра в данных: `scripts/seed-e2e.ts` заполняет пользователей,
релизы, отчёты и плейлисты, но почти не заполняет **аналитику** и совсем не заполняет
**историю плейлистов**. Следствие — и живой прогон, и визуальные эталоны снимают эти экраны
в состоянии, которого в бою не бывает:

| Экран | Что в сиде | Что не видно |
|---|---|---|
| `/dashboard/admin/analytics` | 5 строк `streamAnalytics`, все одной датой 2026-06-15 | поведение списков треков (в бою 179 строк), top-10 против «всех», разброс по датам и площадкам — график собирается из одной точки |
| `/dashboard/admin/playlists/history` | 0 строк `PlaylistHistory` | вся таблица: экран всегда в `EmptyState`, фильтры проверить нечем |

Частично закрыто в этапе 5 (часть Б): в сид добавлен «каталожный» артист с 16 треками
аналитики и записи истории плейлистов — ровно столько, чтобы top-10 и таблица истории
имели что показывать. Остаётся: разброс аналитики по датам и площадкам (сейчас один день,
один DSP `Spotify`), из-за чего графики по площадкам и периодам на стенде вырождены.
Числа сида контрактные (`1500`/`2200`/`2500` в `tests/integration/stream-metric.test.ts`,
`reports-money.test.ts`, `tests/e2e/cabinet-linked.spec.ts`) — расширять их можно только
данными вне групп E2E Main/Linked либо правя тесты вместе с сидом.

---

**Итого: 12 расхождений (11 однотипных по вёрстке + B-12 про данные стенда).** Самый дорогой по объёму — B-02
(~53 карточки, семь плотностей). Самые дешёвые и заметные — B-03 (4 раскладки,
~11 мест) и B-06 (18 мест). B-01 (~25 мест) визуально уже ничего не меняет —
это чистка мёртвых классов. B-04 — не косметика: на этих экранах
пользователь остаётся без заголовка и навигации. B-10 закрыт в части Б.
