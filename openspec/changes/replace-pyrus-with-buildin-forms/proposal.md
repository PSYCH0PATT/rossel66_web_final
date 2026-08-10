# Change: Replace Pyrus with Buildin forms intake

## Why
Pyrus hard-limits catalog uploads to 5 releases (fixed form slots), couples file upload to a write-only CRM, and blocks Buildin-only cutover. Team already runs ops in Buildin; forms must stop depending on Pyrus. Early Buildin intake used separate «Релизы заявок» / «Треки заявок» tables that are unusable for ops — one application must be one page.

## What Changes
- **BREAKING**: New form submissions write only to Buildin (business SoT); Postgres keeps a temporary encrypted delivery ledger with TTL, not a permanent payload copy
- Catalog: no product release-count cap; resource quotas (100 MB/file, 500 files, 30 GB/session)
- **Three ops queues**: «Бэк-каталог», «Загрузка релиза», «Дистрибуция» — one row = one application
- **One page per application**: releases, tracklists, UPC/ISRC, promo payload, and files as blocks inside that page (no child submission DBs)
- Ops CRM «Релизы» / «Треки» stay Supabase mirrors only — forms never write them
- Session API with direct presigned uploads (browser → Buildin); Next.js never buffers binaries
- All public forms (catalog, release, distribution, RF, non-RF, contact) use the same pipeline
- Remove Pyrus write path after cutover gates pass

## Impact
- Affected specs: `forms-integration` (MODIFIED), new `buildin-forms-intake`, `pii-forms`
- Affected code: `app/forms/**`, `app/api/submit-pyrus-*`, `app/api/forms/**`, `lib/buildin/**`, Prisma delivery models, `components/contact-form-section.tsx`
- Non-goals: Buildin as SoT for royalties/payments/parser cookies; replaying historical Pyrus tasks; writing form tracks into CRM `tracks` DB
