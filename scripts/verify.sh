#!/usr/bin/env bash
#
# Полная локальная проверка: одна команда, ничего платного, прод не затрагивается.
#
#   pnpm verify              — весь набор
#   pnpm verify --fast       — без e2e (типы, линт, юниты, питон)
#
# База поднимается в docker (docker-compose.test.yml), Supabase Storage и Buildin
# заменены локальными стабами, все значения окружения берутся из .env.e2e.
set -euo pipefail

cd "$(dirname "$0")/.."

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

BLUE=$'\033[34m'; GREEN=$'\033[32m'; RED=$'\033[31m'; RESET=$'\033[0m'
step() { printf '\n%s▶ %s%s\n' "$BLUE" "$1" "$RESET"; }
fail() { printf '\n%s✘ %s%s\n' "$RED" "$1" "$RESET"; exit 1; }

started=$(date +%s)

step "Проверка типов"
pnpm exec tsc --noEmit || fail "tsc нашёл ошибки"

step "Линт"
pnpm lint >/dev/null || fail "линт не прошёл"

step "Юнит-тесты"
pnpm test || fail "юнит-тесты упали"

if [ "$FAST" = "1" ]; then
  printf '\n%s✔ Быстрая проверка пройдена за %ss%s\n' "$GREEN" "$(( $(date +%s) - started ))" "$RESET"
  exit 0
fi

step "Поднимаю тестовую базу"
docker compose -f docker-compose.test.yml up -d >/dev/null || fail "docker не поднялся"
until docker compose -f docker-compose.test.yml exec -T postgres pg_isready -U rossel -d rossel_test >/dev/null 2>&1; do
  sleep 1
done

step "Миграции с нуля"
pnpm test:db:migrate || fail "миграции не применились на пустую базу"

step "Схема против миграций"
pnpm check:drift || fail "schema.prisma разошлась с миграциями"

step "Сид"
pnpm seed:e2e || fail "сид не отработал"

step "Интеграционные тесты"
pnpm test:integration || fail "интеграционные тесты упали"

step "Сборка"
pnpm build >/dev/null || fail "сборка не прошла"

step "E2E"
pnpm exec playwright test || fail "e2e упали"

printf '\n%s✔ Всё зелёное за %ss%s\n' "$GREEN" "$(( $(date +%s) - started ))" "$RESET"
