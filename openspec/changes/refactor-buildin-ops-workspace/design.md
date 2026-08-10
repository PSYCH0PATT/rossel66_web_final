# Design: Buildin Ops ownership and reliability

## Context
Postgres/Supabase stays domain SoT. Buildin is the ops workspace. Current forward sync patches full property sets and can reset manual CRM fields. PII forms duplicate sensitive payloads into the shared inbox.

## Decisions
1. **Partial PATCH only** for updates: send mirror-owned fields; never send `Операционный статус`, `Ответственный`, `Заметки`, `Дедлайн`, `Теги` on update.
2. **Create path** may set initial `Операционный статус` defaults once; subsequent updates skip ops fields entirely.
3. **PII**: shared submission stores nickname/type/status + link metadata only; closed DBs store structured fields without `Payload JSON`.
4. **Retry**: idempotency key = `submission:<submissionId>`; binaries staged under Supabase Storage bucket/path; `completed` only after expected files uploaded (or none expected).
5. **Activity / PlaylistHistory**: stop enqueueing; keep existing Buildin pages as archive.
6. **Reverse-sync**: keep admin endpoint as audit/version marker only; document that ops fields are Buildin-owned until a future Postgres ops store exists.
7. **Infra**: keep Timeweb cron + Postgres outbox; no Cloudflare worker.

## Risks
- Existing Buildin pages already contain leaked PII in submissions → manual cleanup/ACL required.
- Relations/people properties may need UI mutate after defs change; adapters remain text-ID compatible during transition.
