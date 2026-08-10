## ADDED Requirements

### Requirement: Buildin is business system of record for form submissions
The system SHALL store permanent submission content and files in Buildin only. Postgres SHALL store only temporary delivery metadata and an encrypted manifest until finalize succeeds.

#### Scenario: Successful finalize clears business payload
- **WHEN** a delivery session reaches completed state
- **THEN** the encrypted manifest is deleted from Postgres
- **AND** Buildin retains the application page with release/track sections and attachments

#### Scenario: Retry after Buildin outage
- **WHEN** Buildin is temporarily unavailable after session create
- **THEN** the delivery session remains recoverable
- **AND** outbox retries materialize/finalize without creating duplicate Buildin pages

### Requirement: Three ops queues by form type
The system SHALL route catalog, release upload, and distribution submissions into three separate Buildin databases titled for ops: back catalog, release upload, and distribution. Contact and PII forms SHALL use the shared inbox database.

#### Scenario: Catalog lands in back-catalog DB
- **WHEN** a catalog_upload session is created
- **THEN** the Buildin page is created in the back-catalog database
- **AND** not in the release-upload or distribution databases

### Requirement: One application page with nested content
The system SHALL materialize all releases, tracks, UPC/ISRC (when provided), promo payload, and files as blocks on the single application page. The system SHALL NOT create rows in `submission_releases` or `submission_tracks` for new sessions. The system SHALL NOT write form intake into CRM `releases` or `tracks` databases.

#### Scenario: Multi-release catalog on one page
- **WHEN** a session includes multiple releases with tracks and files
- **THEN** materialize builds release sections and track tables on the application page
- **AND** finalize marks status as Новая
- **AND** no CRM track/release mirror pages are created from the form

### Requirement: Session direct upload pipeline
The system SHALL accept catalog and release files via per-file Buildin upload URLs issued by the server, with browser PUT and server-side complete/finalize.

#### Scenario: Presign and complete one file
- **WHEN** client requests a presign for a known session file
- **AND** uploads bytes with PUT to the returned URL
- **AND** posts complete with size metadata
- **THEN** the file block is appended to the application page
- **AND** the delivery file row records oss_name

### Requirement: Resource quotas without release-count product cap
The system SHALL NOT enforce a fixed maximum release count for catalog uploads. The system SHALL enforce resource quotas of at most 100 MB per file, 500 files per session, 30 GB total bytes per session, and 5 MB encrypted manifest size.

#### Scenario: Fifteen releases within quotas
- **WHEN** a session includes 15 releases and total files/bytes stay within quotas
- **THEN** materialize creates all release and track sections on the application page
- **AND** finalize marks the Buildin submission status as Новая

### Requirement: Human-readable form labels
The system SHALL write Russian labels for form type, release type (including album option 4), genre, and language on Buildin pages.

#### Scenario: Album release type four
- **WHEN** a release_upload or distribution manifest uses releaseType "4"
- **THEN** the application page shows «Альбом (8 и более треков)»

### Requirement: Contact form intake
The system SHALL accept landing contact messages as Buildin submissions of type contact.

#### Scenario: Submit contact
- **WHEN** a visitor submits the contact form
- **THEN** a Buildin shared-inbox page of type contact is created
- **AND** Google Apps Script is not required
