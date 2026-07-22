# Token setup checklist (no secrets in this file)

Dual-write and outbox require a Buildin **Integration API token** in server env.

## Steps

1. Buildin UI → Settings → Integrations
2. Create **Rossel Music Production** (do not rely on Cursor MCP alone)
3. Copy token into `.env.local`:
   ```
   BUILDIN_API_TOKEN=<paste locally only>
   ```
4. Copy the same value to Timeweb secrets for production
5. Ensure `BUILDIN_DB_*` from [BUILDIN_DATABASE_IDS.env](BUILDIN_DATABASE_IDS.env) are in `.env.local`
6. Run:
   ```bash
   npm run smoke:buildin
   ```
7. On success, submit one real form and check `GET /api/admin/buildin/reconciliation`

## Shared space (обязательно)

Production bot **rossel 66** must have access to the team page, not only personal root:

1. Open [ROSSEL 66 — Командный хаб](https://buildin.ai/1a844652-0f7a-437f-b630-7ebb67eb2fd4)
2. Share / invite integration **rossel 66** (can edit)
3. Re-run `npm run smoke:buildin`

Without this step the API returns 403 («机器人没有访问指定页面的权限»).

Ops DBs live as children of that hub; IDs are in [`BUILDIN_DATABASE_IDS.env`](BUILDIN_DATABASE_IDS.env).

## Status (repo)

- Skill `buildin-cli` installed under `.agents/skills/buildin-cli/`
- REST client audited against OpenAPI upload rules
- 11 ops DBs are under the shared hub; `.env.local` points at those IDs
- Smoke fails with 403 until the production integration is invited to the hub
- Do not paste the token into chat or commit it
- Personal-root duplicates (created earlier by the production bot) can be deleted in the UI
