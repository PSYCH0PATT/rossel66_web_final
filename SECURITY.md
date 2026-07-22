# Security notes

1. **Секреты**: если когда-либо попадали в git — ротировать (Pyrus, SFTP, DB, VK, 2captcha, Bright Data, `CRON_SECRET`, `BUILDIN_API_TOKEN`, и т.д.) и очистить историю (`git filter-repo` / BFG) при необходимости.
2. **Прод**: задать `AUTH_SECRET` (подписанные сессии). Без него в production в лог пишется предупреждение.
3. **Cron (Timeweb / Docker `crond`)**: задайте `CRON_SECRET`; системный cron в контейнере вызывает внутренние эндпоинты с `Authorization: Bearer $CRON_SECRET` (см. `crontab`, `scripts/cron-sftp.sh`, `entrypoint.sh`). Секрет не передаётся в query.
4. **Локально**: используйте `.env.local` (уже под `.gitignore` через `.env*`).
5. **Buildin**: нужен отдельный production Bearer token (`BUILDIN_API_TOKEN` или CLI-алиас `BUILDIN_TOKEN`) в `.env.local` / секретах Timeweb. Cursor MCP (`mcp.buildin.ai`) **не** заменяет этот токен для сервера приложения. Создайте интеграцию «Rossel Music Production» в Buildin → Settings → Integrations; не коммитьте и не вставляйте токен в чат. Закрытые PII-базы (`BUILDIN_DB_PII_*`) ограничить ACL до уполномоченных. Не зеркалировать пароли, session cookies, значения parser cookies, API keys.
6. **Публичные cookie endpoints**: `GET /api/vk/cookies` и `GET /api/bandlink/cookies` требуют admin и возвращают только имена/метаданные, не значения.