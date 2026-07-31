# Что сделать руками в Buildin (пошагово)

Код и API уже сделали большую часть.  
**Views, pin в сайдбаре и share/ACL** Buildin API/MCP не умеет — только браузер владельца.

Делай один раз. Если что-то уже есть — не дублируй.

---

## Статус на 2026-07-28 (что уже сделано автоматически)

| Что | Статус |
|---|---|
| Схема: people Assignee / Ответственный | ✅ |
| Relations (7 направлений) + backfill | ✅ (releases 426, tracks 655, reports 29, playlists 21; submissions/PII пока 0 записей) |
| Русские статусы (Заявки / Ops Status) | ✅ |
| Payload JSON убран из PII РФ / не РФ | ✅ |
| Архивные названия Activity / History | ✅ |
| Страница **ROSSEL — Операционный центр** | ✅ создана под хабом |
| Pin в сайдбаре | ⏳ нужен логин владельца в браузере |
| Views (фильтры) | ⏳ нужен логин владельца |
| PII ACL (owner + Cursor + rossel 66) | ⏳ нужен логин владельца; не трогать, если пропадёт production bot |
| `PYRUS_WRITE_DISABLED` | **`true`** после E2E — legacy multipart и `pyrus-file-upload` → 410; data forms → Buildin only |

Ссылка на Операционный центр:  
https://buildin.ai/0951bf11-7507-463c-9b2d-5f5b484c2eef  

ID: `0951bf11-7507-463c-9b2d-5f5b484c2eef`  
Родитель (хаб): `1a844652-0f7a-437f-b630-7ebb67eb2fd4`

Checkpoint (без токенов): `.tmp/buildin-checkpoint/`  
Откат schema: см. `docs/BUILDIN_MIGRATION.md` § rollback schema.

---

## Зачем это вообще

Нужна одна главная страница-вход: **«куда заходить утром»**.  
Страница уже создана — осталось закрепить и настроить фильтры.

---

## Шаг 1. Закрепить Операционный центр

1. Войди в Buildin как **владелец** workspace `ROSSEL 66`.
2. Открой https://buildin.ai/0951bf11-7507-463c-9b2d-5f5b484c2eef  
3. Закрепи страницу в боковом меню (pin / избранное / «в сайдбар»).

Не создавай вторую страницу с тем же именем.

---

## Шаг 2. Views (фильтры) — один раз

### Заявки
| Название | Фильтр |
|---|---|
| Новые | Статус = «Новая» |
| В работе | Статус = «В работе» |
| Ждём ответа | Статус = «Ждём артиста» |
| Мои задачи | Ответственный = я |

### Релизы
- Pipeline по `Ops Status` (Приёмка → … → Доставлен / Блок)
- Календарь по `Release Date`

### Отчёты
| Название | Фильтр |
|---|---|
| Очередь | Ops Status = «Очередь» |
| К выплате | Ops Status = «К выплате» |
| Блок | Ops Status = «Блок» |

### Плейлисты
Одна строка = один трек в плейлисте. Колонки только:
`Артист`, `Трек`, `Плейлист`, `URL`, `Впервые обнаружен`.

- View «Текущие размещения»: активные записи, сортировка по `Впервые обнаружен` (новые сверху).
- **`Впервые обнаружен`** = самое раннее наблюдение системой/парсером (MSK): `min(существующее, CSV parsed_date, Playlist.firstSeenDate, история)`. Это **не** дата добавления трека на DSP — такой даты в отчётах нет. Дата не сдвигается вперёд при реимпорте/cleanup.

Backfill ложных дат миграции:

```bash
npm run backfill:playlist-first-seen -- --dry-run
npm run backfill:playlist-first-seen -- --sync-buildin
```
- Если трек исчез из отчёта и потом вернулся, дата первого обнаружения **не сбрасывается**.

Миграция / backfill:
```bash
npx prisma migrate deploy
npm run migrate:buildin-playlist-placements -- --dry-run
npm run migrate:buildin-playlist-placements
npm run migrate:buildin-playlist-placements -- --archive-legacy
# после сверки:
npm run migrate:buildin-playlist-placements -- --cleanup-schema
npm run reconcile:buildin-mirrors
# mapped playlist_placement должен совпасть с active Postgres;
# Buildin archive = PATCH { in_trash: true } (поле archived API игнорирует)
```

Треки (каталог релизов) — только в разделе Каталог Операционного центра, не в главном меню.  
Automation Runs — в Технике.  
PII — в Закрыто.  
Activity / History — в Архиве (уже переименованы).

---

## Шаг 3. Про мусор «Без названия»

В сайдбаре могут торчать пустые страницы «Без названия».

**Не удаляй по названию автоматически.**  
Составь список (ID + что внутри) и решай отдельно.  
API-поиском по «Без названия» на момент настройки совпадений не нашлось.

---

## Шаг 4. Права на PII (осторожно)

Цель: **владелец + две интеграции** (`Cursor`, production `rossel 66`).  
Широкую видимость workspace на PII — убрать, если включена.  
Сотрудников сейчас **не** добавлять.

### Как выдать доступ legal позже
1. Владелец открывает Share у `ROSSEL — PII РФ` и `PII не РФ`.
2. Добавляет конкретного пользователя (legal) с правом просмотра/редактирования.
3. Проверяет, что интеграции `Cursor` и `rossel 66` **остались** в списке с write.
4. Записывает: кому выдали, дата.

### Как отозвать
1. Share → убрать пользователя.
2. Снова проверить, что обе интеграции на месте.

### Стоп-правило
Если в Share **не видно** production integration `rossel 66` или есть риск её снять — **не сохраняй** ACL-изменения. Остановись и опиши блок.

Полноценный negative-тест «ops не видит паспорта» — после появления второго сотрудника.

---

## Шаг 5. Что уже в коде (не трогать руками)

- заявки пишутся в Buildin;
- артисты/релизы/треки/отчёты/плейлисты синкаются с relations;
- ручной Ops Status / Assignee / Notes forward-sync не затирает;
- retry заявок идемпотентный;
- Activity/History больше не заливаются.

Пока E2E не зелёный — **`PYRUS_WRITE_DISABLED=false`**. После E2E: `true` (см. `docs/BUILDIN_MIGRATION.md` § Form session API).

### Form session API (файловые формы)

Каталог / релиз / дистрибуция после cutover:

1. `POST /api/forms/sessions` — создать сессию + encrypted manifest
2. `POST /api/forms/sessions/{id}/materialize` — страницы в Buildin
3. `POST /api/forms/sessions/{id}/files/presign` + PUT в storage + `files/complete`
4. `POST /api/forms/sessions/{id}/finalize`

Данные РФ / не РФ: `POST /api/forms/simple` или legacy `submit-pyrus-data-*` (без Pyrus при `PYRUS_WRITE_DISABLED`).

Очистка TTL-сессий: `npm run cleanup:form-sessions`

---

## Если что-то «застряло» в синхроне

```bash
npm run reconcile:buildin-mirrors
npm run process:buildin-outbox
npm run migrate:buildin-relations -- --dry-run
```

Админ API:
- health: `GET /api/admin/buildin/reconciliation`
- requeue: `POST /api/admin/buildin/requeue`

---

## Короткий чеклист

- [x] Страница **ROSSEL — Операционный центр** создана (API)
- [ ] Она закреплена в меню
- [ ] Фильтры Заявки / Релизы / Отчёты / Плейлисты
- [ ] PII: owner + Cursor + rossel 66; без broad workspace
- [ ] `PYRUS_WRITE_DISABLED` = `true` (после E2E; иначе `false`)
