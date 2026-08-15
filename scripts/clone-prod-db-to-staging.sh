#!/usr/bin/env bash
#
# Копирует ДАННЫЕ боевой базы в стейджинговую. Схему не трогает — она поднимается
# миграциями (`prisma migrate deploy`), поэтому журнал _prisma_migrations на
# стейдже честный и будущие миграции применяются штатно.
#
#   pnpm db:clone-to-staging
#
# Запускать повторно можно и нужно: копия одноразовая, прод живёт дальше и данные
# со временем расходятся. Каждый запуск очищает стейдж и заливает свежий снимок.
#
# Откуда берутся строки подключения:
#   прод    — DATABASE_URL из .env.local
#   стейдж  — STAGING_DATABASE_URL из .env.staging.local
# Оба файла в .gitignore.
set -euo pipefail

cd "$(dirname "$0")/.."

RED=$'\033[31m'; GREEN=$'\033[32m'; BLUE=$'\033[34m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
step() { printf '\n%s▶ %s%s\n' "$BLUE" "$1" "$RESET"; }
fail() { printf '\n%s✘ %s%s\n' "$RED" "$1" "$RESET"; exit 1; }

# Ref боевого проекта. Захардкожен намеренно: это предохранитель, который делает
# запись в прод невозможной, даже если перепутать переменные местами.
PROD_REF="whygmlakldsunkjkhrsi"

read_env() { # файл, ключ
  [ -f "$1" ] || return 1
  grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

mask() { sed -E 's#(postgresql://[^:]+):[^@]+@#\1:***@#g' <<<"$1"; }

SRC_URL="$(read_env .env.local DATABASE_URL || true)"
DST_URL="$(read_env .env.staging.local STAGING_DATABASE_URL || true)"

[ -n "$SRC_URL" ] || fail "В .env.local нет DATABASE_URL (боевая база)"
[ -n "$DST_URL" ] || fail "В .env.staging.local нет STAGING_DATABASE_URL (стейдж-база).
   Взять: дашборд Supabase проекта rossel-staging → Connect → Session pooler (порт 5432)"

# --- Предохранители направления -------------------------------------------
case "$DST_URL" in
  *"$PROD_REF"*) fail "ОТКАЗ: адрес назначения указывает на БОЕВУЮ базу ($PROD_REF).
   Скрипт пишет только в стейдж. Проверьте STAGING_DATABASE_URL в .env.staging.local" ;;
esac
case "$SRC_URL" in
  *"$PROD_REF"*) : ;;
  *) fail "ОТКАЗ: источник не похож на боевую базу — в DATABASE_URL нет $PROD_REF" ;;
esac
[ "$SRC_URL" != "$DST_URL" ] || fail "ОТКАЗ: источник и назначение совпадают"

# pg_dump не работает через транзакционный пулер (6543) — нужен session pooler.
# Через sed, а не через ${var/a/b}: в подстановке bash обратный слеш остаётся
# в строке буквально и ломает адрес.
SRC_URL=$(printf '%s' "$SRC_URL" | sed -E 's#:6543/#:5432/#')
DST_URL=$(printf '%s' "$DST_URL" | sed -E 's#:6543/#:5432/#')

printf 'источник : %s\n' "$(mask "$SRC_URL")"
printf 'назначение: %s\n' "$(mask "$DST_URL")"

# Клиент postgres 17 из docker: сервер Supabase 17.x, локальный клиент часто старее,
# а pg_dump отказывается работать с более новым сервером.
PG_IMAGE="postgres:17-alpine"
# Без -i: с ним docker забирает stdin, и цикл сверки ниже читал бы не список
# таблиц, а пустоту — сверка молча проходила после первой же таблицы.
pg() { docker run --rm -e PGCONNECT_TIMEOUT=30 "$PG_IMAGE" "$@"; }
# Отдельный вариант для случая, когда на вход действительно подаётся файл.
pg_stdin() { docker run --rm -i -e PGCONNECT_TIMEOUT=30 "$PG_IMAGE" "$@"; }

command -v docker >/dev/null || fail "нужен docker (в нём postgres 17 клиент)"
docker info >/dev/null 2>&1 || fail "docker не запущен"

step "Проверяю связь с обеими базами"
pg psql "$SRC_URL" -tAc "select 1" >/dev/null || fail "нет связи с боевой базой"
pg psql "$DST_URL" -tAc "select 1" >/dev/null || fail "нет связи со стейдж-базой"

STAGING_TABLES=$(pg psql "$DST_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema='public' and table_name <> '_prisma_migrations'")
[ "${STAGING_TABLES:-0}" -gt 0 ] || fail "в стейдж-базе нет таблиц — сначала примените миграции:
   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy"

step "Очищаю данные стейджа (схема остаётся)"
# Одним TRUNCATE по всем таблицам сразу: без внешних ключей порядок не важен,
# но CASCADE оставлен на случай их появления в будущем.
TRUNCATE_SQL=$(pg psql "$DST_URL" -tAc "
  select 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' CASCADE;'
  from pg_tables
  where schemaname = 'public' and tablename <> '_prisma_migrations'")
[ -n "$TRUNCATE_SQL" ] && pg psql "$DST_URL" -v ON_ERROR_STOP=1 -q -c "$TRUNCATE_SQL"

step "Переношу данные (может занять пару минут)"
DUMP_FILE=$(mktemp -t rossel-dump)
DUMP_ERR=$(mktemp -t rossel-dump-err)
trap 'rm -f "$DUMP_FILE" "$DUMP_ERR"' EXIT

pg pg_dump "$SRC_URL" \
  --data-only --no-owner --no-privileges --schema=public \
  --exclude-table='_prisma_migrations' \
  > "$DUMP_FILE" 2>"$DUMP_ERR" || { cat "$DUMP_ERR" >&2; fail "pg_dump не отработал"; }

printf '   дамп: %s\n' "$(du -h "$DUMP_FILE" | cut -f1)"
pg_stdin psql "$DST_URL" -v ON_ERROR_STOP=1 -q < "$DUMP_FILE" || fail "загрузка в стейдж не удалась"

step "Сверяю количество строк по всем таблицам"
COUNT_SQL="select table_name from information_schema.tables
           where table_schema='public' and table_type='BASE TABLE'
             and table_name <> '_prisma_migrations' order by table_name"
MISMATCH=0
CHECKED=0
TABLES=$(pg psql "$SRC_URL" -tAc "$COUNT_SQL" | tr -d '\r')
[ -n "$TABLES" ] || fail "не удалось получить список таблиц для сверки"

for tbl in $TABLES; do
  a=$(pg psql "$SRC_URL" -tAc "select count(*) from \"$tbl\"" | tr -d '\r')
  b=$(pg psql "$DST_URL" -tAc "select count(*) from \"$tbl\"" | tr -d '\r')
  CHECKED=$((CHECKED + 1))
  if [ "$a" = "$b" ]; then
    printf '   %-28s %s\n' "$tbl" "$a"
  else
    printf '   %s%-28s прод %s ≠ стейдж %s%s\n' "$RED" "$tbl" "$a" "$b" "$RESET"
    MISMATCH=1
  fi
done

[ "$MISMATCH" = "0" ] || fail "данные скопировались не полностью"
# Страховка от «сверил одну таблицу и отрапортовал успех».
[ "$CHECKED" -ge 15 ] || fail "сверено всего $CHECKED таблиц — сверка не отработала целиком"
printf '   сверено таблиц: %s\n' "$CHECKED"

printf '\n%s✔ Данные скопированы, все таблицы сходятся%s\n' "$GREEN" "$RESET"
printf '%sНе забудьте про файлы: pnpm storage:clone-to-staging%s\n' "$YELLOW" "$RESET"
