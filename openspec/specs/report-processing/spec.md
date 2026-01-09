# Report Processing

## Purpose
Система обработки отчетов о прослушиваниях с ЦМС. Загрузка Excel-файлов, парсинг данных, группировка по артистам, назначение отчетов, управление статусами, генерация индивидуальных отчетов и скачивание.

## Requirements

### Requirement: Upload Excel Report
The system SHALL allow uploading Excel reports with streaming data from CMS.

#### Scenario: Upload single report
- **WHEN** administrator uploads an Excel file
- **THEN** file is parsed
- **AND** streaming data is extracted
- **AND** reports are created for each artist

#### Scenario: Invalid file format
- **WHEN** administrator uploads file with invalid format
- **THEN** system shows an error

### Requirement: Report Parsing
The system SHALL parse Excel files and extract streaming data grouped by artist.

#### Scenario: Parse report data
- **WHEN** Excel file is uploaded
- **THEN** track name, artist, platform, streams, revenue are extracted

#### Scenario: Group by artist
- **WHEN** data is extracted
- **THEN** streams are grouped by artist
- **AND** separate report is created for each artist

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
- **THEN** Excel file is downloaded

#### Scenario: Download all reports for quarter
- **WHEN** administrator clicks "Download all" for a quarter
- **THEN** ZIP archive with all reports is downloaded

### Requirement: Artist Report View
The system SHALL display artist's own reports in their dashboard.

#### Scenario: View own reports
- **WHEN** artist opens "Reports" page
- **THEN** only their reports are displayed grouped by quarter

## Technical Details

### Storage
- Reports stored in `data/reports.json`
- Excel files in `reports/` directory

### Components
- `app/dashboard/admin/reports/page.tsx` — report management
- `app/dashboard/admin/reports-generator/page.tsx` — report generator
- `app/dashboard/artist/[username]/reports/page.tsx` — artist reports
- `components/report-processor.tsx` — report upload component

### Libraries
- `lib/report-processor.ts` — Excel parsing
- `lib/report-generator.ts` — report generation
- `lib/excel-utils.ts` — Excel utilities

### API
- `GET /api/reports/quarters` — list quarters
- `GET /api/reports/list/[quarter]` — reports for quarter
- `POST /api/reports/process` — process Excel
- `POST /api/reports/assign` — assign report
- `POST /api/reports/update-status` — update status
- `GET /api/reports/download/[id]` — download report
