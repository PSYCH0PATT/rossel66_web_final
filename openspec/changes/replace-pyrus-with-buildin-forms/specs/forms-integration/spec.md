## MODIFIED Requirements

### Requirement: Artist Data Form RF
The system SHALL allow Russian artists to submit their data form with Buildin as the business system of record.

#### Scenario: Submit RF form
- **WHEN** artist fills the RF data form
- **AND** clicks "Submit"
- **THEN** a Buildin submissions page is created without passport/bank fields in the shared inbox
- **AND** a closed Buildin PII RF page stores structured personal fields only
- **AND** confirmation is displayed
- **AND** no new Pyrus task is created when Pyrus write is disabled

#### Scenario: Validation errors
- **WHEN** form is filled incorrectly
- **THEN** validation errors are displayed
- **AND** form is not submitted

### Requirement: Artist Data Form Not RF
The system SHALL allow non-Russian artists to submit their data form with Buildin as the business system of record.

#### Scenario: Submit non-RF form
- **WHEN** artist fills the non-RF data form
- **AND** clicks "Submit"
- **THEN** a Buildin submissions page is created without passport/bank fields in the shared inbox
- **AND** a closed Buildin PII non-RF page stores structured personal fields only
- **AND** confirmation is displayed

### Requirement: Catalog Upload Form
The system SHALL allow uploading a music catalog of any release count within resource quotas via direct uploads to Buildin.

#### Scenario: Submit catalog with more than five releases
- **WHEN** user adds 7 or more releases within session quotas
- **AND** completes direct file uploads
- **AND** finalizes the session
- **THEN** Buildin contains one submission page plus one release page per release and track pages for tracks
- **AND** the Next.js request path does not buffer audio/cover binaries into memory

#### Scenario: Reject oversized file
- **WHEN** a file exceeds 100 MB
- **THEN** the client and server reject the file before finalize
- **AND** the submission is not marked complete

### Requirement: Release Upload Form
The system SHALL allow uploading a single release with attachments via the Buildin session pipeline without Pyrus pre-upload GUIDs.

#### Scenario: Submit release
- **WHEN** user fills release upload form
- **AND** attaches files (audio, cover)
- **AND** completes the session
- **THEN** Buildin stores the submission with file attachments
- **AND** no `/api/pyrus-file-upload` call is required

### Requirement: Form Selection Page
The system SHALL display a page with all available forms and descriptions.

#### Scenario: View available forms
- **WHEN** user opens forms page
- **THEN** all available forms are displayed
- **AND** brief description for each
