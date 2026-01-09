# Release Management

## Purpose
Система управления релизами (альбомы, EP, синглы). Позволяет создавать, редактировать, удалять релизы, загружать обложки, управлять треками и отображать релизы в кабинете артиста.

## Requirements

### Requirement: Release List
The system SHALL display a list of all releases with filtering and search capabilities.

#### Scenario: View all releases
- **WHEN** administrator opens releases page
- **THEN** a table with all releases is displayed
- **AND** shows title, artist, release date, type, cover

#### Scenario: Filter releases
- **WHEN** administrator applies filters by artist, type, or date
- **THEN** list is filtered accordingly

### Requirement: Create Release
The system SHALL allow creating new releases with cover images and track lists.

#### Scenario: Create release with cover
- **WHEN** administrator fills release creation form
- **AND** uploads a cover image
- **AND** clicks "Save"
- **THEN** release is created in the system
- **AND** cover is saved to `public/images/covers/`

#### Scenario: Create release without cover
- **WHEN** administrator creates release without cover
- **THEN** placeholder image is used

### Requirement: Edit Release
The system SHALL allow editing releases including cover replacement.

#### Scenario: Update release info
- **WHEN** administrator changes release data
- **AND** clicks "Save"
- **THEN** changes are saved

#### Scenario: Update release cover
- **WHEN** administrator uploads new cover
- **THEN** old cover is replaced with new one

### Requirement: Delete Release
The system SHALL allow deleting releases from the system.

#### Scenario: Delete release
- **WHEN** administrator deletes a release
- **THEN** release is removed from system

### Requirement: Artist Release View
The system SHALL display artist's own releases in their dashboard.

#### Scenario: View own releases
- **WHEN** artist opens "Releases" page
- **THEN** only their releases are displayed

## Technical Details

### Storage
- Releases stored in `data/releases.json`
- Covers in `public/images/covers/`

### Components
- `app/dashboard/admin/releases/page.tsx` — release list (admin)
- `app/dashboard/admin/releases/add/page.tsx` — add release
- `app/dashboard/admin/releases/[id]/page.tsx` — edit release
- `app/dashboard/artist/[username]/releases/page.tsx` — release list (artist)

### API
- `GET /api/releases` — list releases
- `POST /api/releases` — create release
- `PUT /api/releases` — update release
- `DELETE /api/releases?id=` — delete release
- `POST /api/uploads/covers` — upload cover
