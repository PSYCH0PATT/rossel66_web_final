# Artist Management

## Purpose
Система управления артистами лейбла. Позволяет создавать, редактировать, удалять артистов, массово добавлять артистов, просматривать профили с релизами, отчетами и плейлистами.
## Requirements
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

### Requirement: Create Artist
The system SHALL allow creating new artists with associated user accounts.

#### Scenario: Create single artist
- **WHEN** administrator fills the artist creation form
- **AND** clicks "Save"
- **THEN** artist is created in the system
- **AND** a user with "artist" role is created

#### Scenario: Bulk create artists
- **WHEN** administrator uploads a list of artists
- **THEN** all artists are created in the system
- **AND** a user is created for each

### Requirement: Edit Artist
The system SHALL allow editing artist data and associated user accounts.

#### Scenario: Update artist info
- **WHEN** administrator changes artist data including contract fields (fio, contract, percentage)
- **AND** clicks "Save"
- **THEN** changes are saved to Supabase Postgres
- **AND** associated user is updated

### Requirement: Delete Artist
The system SHALL allow deleting artists and their associated user accounts.

#### Scenario: Delete artist
- **WHEN** administrator deletes an artist
- **THEN** artist is removed from system
- **AND** associated user is deleted

### Requirement: Artist Profile
The system SHALL display artist profile with detailed information and navigation to related data.

#### Scenario: View artist profile
- **WHEN** administrator opens artist profile
- **THEN** full artist information is displayed
- **AND** links to releases, reports, payments, playlists

### Requirement: Report Readiness Indicator
The system SHALL indicate in the admin artist list when an artist lacks data required for report generation.

#### Scenario: Incomplete data badge
- **WHEN** artist is missing fio, contract, or percentage
- **THEN** badge «нет данных для отчёта» is shown
- **AND** tooltip or title lists missing field labels

#### Scenario: Complete data display
- **WHEN** artist has fio, contract, and percentage filled
- **THEN** percentage is displayed on artist card

## Technical Details

### Storage
- Artists stored in **Supabase Postgres** (`User` table via Prisma)
- Contract fields: `fio`, `fioShort`, `contract`, `percentage`

### Components
- `app/dashboard/admin/artists/page.tsx` — artist list
- `app/dashboard/admin/artists/admin-artists-client.tsx` — list UI with report-readiness badge
- `app/dashboard/admin/artists/add/page.tsx` — add artist
- `app/dashboard/admin/artists/bulk-add/page.tsx` — bulk add
- `app/dashboard/admin/artists/[id]/page.tsx` — artist profile

### API
- `GET /api/artists` — list artists
- `GET /api/artists?incompleteReportData=1` — artists missing report-required fields
- `POST /api/artists` — create artist (optional contract fields)
- `PUT /api/artists` — update artist
- `DELETE /api/artists?id=` — delete artist
