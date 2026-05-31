## 1. Data & Scripts
- [x] 1.1 Add `scripts/seed-artist-contracts.ts` and `scripts/seed-data/artist-contracts.json`
- [x] 1.2 Remove local runtime contract JSON and default percentage fallback
- [x] 1.3 Add `lib/templates/report-mendxza.xlsx` to repo (not gitignored)

## 2. Report Processing
- [x] 2.1 Validate fio, contract, percentage in `lib/python-report-processor.py`
- [x] 2.2 Emit `REPORT_INCOMPLETE_JSON` with per-artist missing fields
- [x] 2.3 Parse incomplete artists in `POST /api/reports/process-python`
- [x] 2.4 Deprecate `POST /api/reports/process` and `process-new` (410)

## 3. Shared Validation & API
- [x] 3.1 Add `lib/artist-report-requirements.ts`
- [x] 3.2 Add `GET /api/artists?incompleteReportData=1` (alias `missingContract=1`)

## 4. Admin UI
- [x] 4.1 Add `components/missing-contract-banner.tsx` on reports generator
- [x] 4.2 Show incomplete artists with field breakdown in `report-processor.tsx`
- [x] 4.3 Show «нет данных для отчёта» badge in admin artists list

## 5. Documentation
- [x] 5.1 Update `docs/TIMEWEB_PERSISTENCE.md`
- [x] 5.2 Update OpenSpec (report-processing, user-auth, artist-management)
