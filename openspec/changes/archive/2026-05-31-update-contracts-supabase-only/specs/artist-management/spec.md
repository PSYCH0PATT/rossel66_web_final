## MODIFIED Requirements

### Requirement: Artist List
The system SHALL display a list of all label artists with search and filter capabilities.

#### Scenario: View artist list
- **WHEN** administrator opens the artists page
- **THEN** a table with all artists is displayed
- **AND** shows name, image, social media links
- **AND** shows report-readiness badge when fio, contract, or percentage is missing

#### Scenario: Search artists
- **WHEN** administrator enters text in search field
- **THEN** list is filtered by artist name

### Requirement: Edit Artist
The system SHALL allow editing artist data and associated user accounts.

#### Scenario: Update artist info
- **WHEN** administrator changes artist data including contract fields (fio, contract, percentage)
- **AND** clicks "Save"
- **THEN** changes are saved to Supabase Postgres
- **AND** associated user is updated

## ADDED Requirements

### Requirement: Report Readiness Indicator
The system SHALL indicate in the admin artist list when an artist lacks data required for report generation.

#### Scenario: Incomplete data badge
- **WHEN** artist is missing fio, contract, or percentage
- **THEN** badge «нет данных для отчёта» is shown
- **AND** tooltip or title lists missing field labels

#### Scenario: Complete data display
- **WHEN** artist has fio, contract, and percentage filled
- **THEN** percentage is displayed on artist card
