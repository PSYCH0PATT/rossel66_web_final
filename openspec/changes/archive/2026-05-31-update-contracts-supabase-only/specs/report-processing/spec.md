## MODIFIED Requirements

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

### Requirement: Report Parsing
The system SHALL parse Excel files and extract streaming data grouped by artist.

#### Scenario: Parse report data
- **WHEN** Excel file is uploaded
- **THEN** track name, artist, streams, revenue are extracted

#### Scenario: Group by artist
- **WHEN** data is extracted
- **THEN** streams are grouped by artist
- **AND** separate report is created for each artist with complete contract data in Supabase

## ADDED Requirements

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
