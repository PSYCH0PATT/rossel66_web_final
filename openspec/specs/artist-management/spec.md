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
- **WHEN** administrator changes artist data
- **AND** clicks "Save"
- **THEN** changes are saved
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

## Technical Details

### Storage
- Artists stored in `data/artists/[id].json`
- Linked to users via username

### Components
- `app/dashboard/admin/artists/page.tsx` — artist list
- `app/dashboard/admin/artists/add/page.tsx` — add artist
- `app/dashboard/admin/artists/bulk-add/page.tsx` — bulk add
- `app/dashboard/admin/artists/[id]/page.tsx` — artist profile

### API
- `GET /api/artists` — list artists
- `POST /api/artists` — create artist
- `PUT /api/artists` — update artist
- `DELETE /api/artists?id=` — delete artist
