## ADDED Requirements

### Requirement: Buildin is business system of record for form submissions
The system SHALL store permanent submission content and files in Buildin only. Postgres SHALL store only temporary delivery metadata and an encrypted manifest until finalize succeeds.

#### Scenario: Successful finalize clears business payload
- **WHEN** a delivery session reaches completed state
- **THEN** the encrypted manifest is deleted from Postgres
- **AND** Buildin retains the submission, release, and track pages with attachments

#### Scenario: Retry after Buildin outage
- **WHEN** Buildin is temporarily unavailable after session create
- **THEN** the delivery session remains recoverable
- **AND** outbox retries materialize/finalize without creating duplicate Buildin pages

### Requirement: Session direct upload pipeline
The system SHALL accept catalog and release files via per-file Buildin upload URLs issued by the server, with browser PUT and server-side complete/finalize.

#### Scenario: Presign and complete one file
- **WHEN** client requests a presign for a known session file
- **AND** uploads bytes with PUT to the returned URL
- **AND** posts complete with size metadata
- **THEN** the file block is appended to the target Buildin page
- **AND** the delivery file row records oss_name

### Requirement: Resource quotas without release-count product cap
The system SHALL NOT enforce a fixed maximum release count for catalog uploads. The system SHALL enforce resource quotas of at most 100 MB per file, 500 files per session, 30 GB total bytes per session, and 5 MB encrypted manifest size.

#### Scenario: Fifteen releases within quotas
- **WHEN** a session includes 15 releases and total files/bytes stay within quotas
- **THEN** materialize creates all release and track pages
- **AND** finalize marks the Buildin submission status as Новая

### Requirement: Contact form intake
The system SHALL accept landing contact messages as Buildin submissions of type contact.

#### Scenario: Submit contact
- **WHEN** a visitor submits the contact form
- **THEN** a Buildin submissions page of type contact is created
- **AND** Google Apps Script is not required
