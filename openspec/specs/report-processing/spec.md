# Report Processing

## Purpose
Система обработки отчетов о прослушиваниях с ЦМС. Загрузка Excel-файлов, парсинг данных, группировка по артистам, назначение отчетов, управление статусами, генерация индивидуальных отчетов и скачивание.
## Requirements
### Requirement: Contract Data Source
The system SHALL read artist contract fields (fio, fioShort, contract, percentage) exclusively from Supabase `User` table. (Данные договоров ДОЛЖНЫ храниться только в Supabase.)

#### Scenario: Report uses Supabase contract
- **WHEN** administrator generates reports via `/api/reports/process-python`
- **THEN** contract fields are loaded from Prisma/Supabase User rows
- **AND** no local JSON or Excel artists file is used at runtime
- **AND** no hardcoded default percentage is applied

#### Scenario: Missing required contract field
- **WHEN** artist is missing any required field: fio, contract, or percentage (`NULL`)
- **THEN** report is not generated for that artist
- **AND** missing fields are recorded per artist

#### Scenario: Empty string or dash treated as missing
- **WHEN** artist has fio or contract as empty string or `-`
- **THEN** field is treated as missing for report generation

#### Scenario: Zero percentage is valid
- **WHEN** artist has `percentage = 0` in Supabase
- **THEN** report generation proceeds for that artist

### Requirement: Upload Excel Report
The system SHALL allow uploading Excel reports with streaming data from CMS.

#### Scenario: Upload single report
- **WHEN** administrator uploads an Excel file
- **THEN** file is parsed
- **AND** streaming data is extracted
- **AND** reports are created for each artist with contract data in Supabase

#### Scenario: Invalid file format
- **WHEN** administrator uploads file with invalid format
- **THEN** system shows an error

### Requirement: Report Parsing
The system SHALL parse Excel files and extract streaming data grouped by artist.

#### Scenario: Parse report data
- **WHEN** Excel file is uploaded
- **THEN** track name, artist, streams, revenue are extracted

#### Scenario: Group by artist
- **WHEN** data is extracted
- **THEN** streams are grouped by artist
- **AND** separate report is created for each artist with complete contract data in Supabase

### Requirement: Report Assignment
The system SHALL allow assigning reports to artists automatically or manually.

#### Scenario: Auto-assign by name
- **WHEN** report is processed
- **AND** artist name matches existing artist
- **THEN** report is automatically assigned to that artist

#### Scenario: Manual assignment
- **WHEN** report is not auto-assigned
- **THEN** administrator can assign it manually

### Requirement: Report Status Management
The system SHALL track report status through the workflow.

#### Scenario: Update report status
- **WHEN** administrator changes report status
- **THEN** status is updated (pending → assigned → sent → paid)

### Requirement: Report Download
The system SHALL allow downloading reports individually or in bulk.

#### Scenario: Download single report
- **WHEN** user clicks "Download" on a report
- **THEN** Excel file is downloaded from Supabase Storage

#### Scenario: Download all reports for quarter
- **WHEN** administrator clicks "Download all" for a quarter
- **THEN** ZIP archive with all reports is downloaded

### Requirement: Artist Report View
The system SHALL display artist's own reports in their dashboard.

#### Scenario: View own reports
- **WHEN** artist opens "Reports" page
- **THEN** only their reports are displayed grouped by quarter

### Requirement: Report Readiness Validation
The system SHALL validate that each artist has fio, contract number, and percentage before generating an individual report.

#### Scenario: Shared validation helper
- **WHEN** server or client checks artist report readiness
- **THEN** `lib/artist-report-requirements.ts` determines missing fields consistently

#### Scenario: Skip artist without full data
- **WHEN** Python processor loads artists from Prisma export
- **AND** artist fails readiness check
- **THEN** artist is skipped with warning log naming missing fields

### Requirement: Incomplete Report Data Notifications
The system SHALL notify administrators when artists lack required data for report generation.

#### Scenario: Pre-generation banner
- **WHEN** administrator opens report generator page
- **AND** one or more artists have incomplete report data
- **THEN** warning banner lists affected artists and missing fields (ФИО, номер договора, процент)

#### Scenario: Post-generation notification
- **WHEN** report processing completes
- **AND** artists were skipped due to incomplete data
- **THEN** API response includes `incompleteArtists` with `name` and `missingFields`
- **AND** UI displays per-artist missing field list

#### Scenario: Python incomplete JSON marker
- **WHEN** Python processor skips one or more artists
- **THEN** stdout includes `REPORT_INCOMPLETE_JSON` with incomplete artist details

### Requirement: Report Readiness API
The system SHALL expose artists with incomplete report data via API.

#### Scenario: List incomplete artists
- **WHEN** client calls `GET /api/artists?incompleteReportData=1`
- **THEN** response lists artists missing fio, contract, or percentage
- **AND** each entry includes `missingFields` array

#### Scenario: Legacy missingContract alias
- **WHEN** client calls `GET /api/artists?missingContract=1`
- **THEN** same incomplete-artist filter is applied as `incompleteReportData=1`

## Technical Details

### Storage
- Report metadata in Supabase **`Report`** table (Prisma)
- Generated Excel files in **Supabase Storage** bucket `reports`
- Artist contracts in Supabase **`User`** (`fio`, `fioShort`, `contract`, `percentage`)
- Track royalty splits in **`Release.tracks[].royaltyShares`**

### Components
- `app/dashboard/admin/reports/page.tsx` — report management
- `app/dashboard/admin/reports-generator/page.tsx` — report generator
- `app/dashboard/artist/[username]/reports/page.tsx` — artist reports
- `components/report-processor.tsx` — report upload component
- `components/missing-contract-banner.tsx` — admin warning for artists with incomplete report data (fio, contract, percentage)
- `lib/artist-report-requirements.ts` — shared report readiness validation

### Libraries
- `lib/python-report-processor.py` — Python report generation (production)
- `lib/export-data-for-python.ts` — Prisma → temp JSON export
- `lib/templates/report-mendxza.xlsx` — report form template
- `scripts/seed-artist-contracts.ts` — one-time contract data import

### API
- `GET /api/reports/quarters` — list quarters
- `GET /api/reports/list/[quarter]` — reports for quarter
- `POST /api/reports/process-python` — process Excel (production)
- `POST /api/reports/process` — **deprecated** (410)
- `POST /api/reports/process-new` — **deprecated** (410)
- `POST /api/reports/assign` — assign report
- `POST /api/reports/update-status` — update status
- `GET /api/reports/download/[id]` — download report
- `GET /api/artists?incompleteReportData=1` — artists missing fio, contract, or percentage
