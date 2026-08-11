# Архив одноразовых скриптов

Сюда перенесены скрипты, на которые нет ни одной ссылки: ни в `package.json`, ни в
`.github/workflows/`, ни в `crontab`, `entrypoint.sh`, `scripts/*.sh`, ни в коде, ни в
документации. Шаг 8 порядка удаления из `docs/CLEANUP_AUDIT.md`.

**Почему перенесены, а не удалены.** Статический анализ не видит историю команд оператора:
эти скрипты запускались руками через `npx tsx scripts/<имя>.ts`, и доказать, что они больше
не нужны, из репозитория нельзя. Поэтому они помечены LIKELY, а не SAFE.

**Что с ними делать.** Если до ноября 2026 никто не хватится — удалить всей папкой.
Они останутся в истории git.

**Если понадобилось запустить.** Относительные импорты уже поправлены на новую глубину
(`../lib/...` → `../../lib/...`), так что `npx tsx scripts/archive/<имя>.ts` работает как раньше.

## Что здесь лежит

- **Разовые миграции данных**: `migrate-dates-isrcs.ts`, `migrate-passwords.js`,
  `migrate_release_statuses.js`, `update-moderated-to-delivered.js`
- **Точечные починки после сбоев**: `fix-release-artists.js`, `fix-release-statuses.js`,
  `fix-releases-complete.js`, `fix-releases-direct.js`, `fix-empty-tracks.ts`,
  `fix_orphaned_releases.ts`, `enrich-features-from-report.js`
- **Разведка и анализ**: `analyze-sftp-files.ts`, `analyze_missing_releases.ts`,
  `analyze_tracks.ts`, `check_tracks_type.ts`, `check_user.ts`, `show-parser-results.js`
- **Отладка под конкретного артиста**: `search_ohla.ts`, `check_ohla_exact.ts`
- **Смоук-проверки интеграций**: `test-supabase.ts`, `test-supabase-storage.ts`,
  `check-supabase-storage.ts`, `test-koala-parser.js`, `test-parser-statuses.js`,
  `test-parsers-statuses.js`, `test-status-normalization.js`
- **SFTP**: `explore-sftp.ts`, `download-sftp.ts` — единственные потребители
  `lib/sftp-explorer.ts` и `lib/sftp-downloader.ts`. Эти два модуля оставлены в `lib/`
  именно поэтому: пока скрипты живы в архиве, ломать их нечем
- **Прочее**: `assign-releases-to-auto-artists.ts`, `checkpoint-buildin-workspace.ts`,
  `scrape-covers.js`

## Чего здесь нет и почему

`scripts/migrate-to-supabase.ts` и `scripts/setup-buildin-form-databases.ts` остались на
месте — они процитированы как шаги runbook в `SUPABASE_SETUP.md` и `docs/FORMS_TESTING.md`,
и перенос сломал бы пути в документации.
