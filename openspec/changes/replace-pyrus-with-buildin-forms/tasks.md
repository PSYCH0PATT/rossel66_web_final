## 1. Specs and schema
- [x] 1.1 OpenSpec proposal/design/deltas validated
- [x] 1.2 Buildin defs: submission_releases, submission_tracks; submissions status «Загружается» + contact type
- [x] 1.3 Prisma FormDeliverySession/Item/File + migration

## 2. Delivery pipeline
- [x] 2.1 Encrypted manifest helpers + TTL cleanup
- [x] 2.2 Session API: create, materialize, presign, complete, finalize, status
- [x] 2.3 Outbox events for materialize/finalize retries

## 3. Frontends
- [x] 3.1 Catalog: remove 5-cap; session upload client
- [x] 3.2 Release upload + distribution on session/Buildin-only
- [x] 3.3 Data RF / not RF Buildin-only
- [x] 3.4 Contact → Buildin contact type

## 4. Hardening and cutover
- [x] 4.1 Quotas, distributed-ish rate limits, ownership token
- [x] 4.2 Tests for quotas/idempotency/encryption
- [x] 4.3 Docs: PYRUS_WRITE_DISABLED cutover; remove Pyrus write from new paths
