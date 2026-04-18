# Security notes

1. **Секреты**: если когда-либо попадали в git — ротировать (Pyrus, SFTP, DB, VK, 2captcha, Bright Data, `CRON_SECRET`, и т.д.) и очистить историю (`git filter-repo` / BFG) при необходимости.
2. **Прод**: задать `AUTH_SECRET` (подписанные сессии). Без него в production в лог пишется предупреждение.
3. **Vercel Cron**: в проекте задайте `CRON_SECRET`; платформа передаёт его в `Authorization: Bearer` при вызове cron URL. В `vercel.json` не храните секреты в query.
4. **Локально**: используйте `.env.local` (уже под `.gitignore` через `.env*`).
