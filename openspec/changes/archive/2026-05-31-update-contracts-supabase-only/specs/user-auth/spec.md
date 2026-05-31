## ADDED Requirements

### Requirement: Artist Contract Profile Fields
The system SHALL store artist contract data required for report generation on the `User` record in Supabase Postgres.

#### Scenario: Contract fields on User
- **WHEN** administrator views or edits an artist user
- **THEN** fields `fio`, `fioShort`, `contract`, and `percentage` are available
- **AND** values persist in Supabase via Prisma

#### Scenario: Create artist with contract fields
- **WHEN** administrator creates artist via `POST /api/artists`
- **THEN** optional contract fields may be supplied in request body
- **AND** are saved to the linked `User` row

#### Scenario: Required fields for reports
- **WHEN** report generation runs
- **THEN** `fio`, `contract`, and `percentage` MUST be present and non-empty for each included artist
- **AND** `fioShort` MAY fall back to `fio` or display name in generated Excel
