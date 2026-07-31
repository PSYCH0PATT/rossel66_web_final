## MODIFIED Requirements

### Requirement: Artist Data Form RF
The system SHALL allow Russian artists to submit their data form with dual-write to Pyrus (until cutover) and Buildin.

#### Scenario: Submit RF form
- **WHEN** artist fills the RF data form
- **AND** clicks "Submit"
- **THEN** a canonical `FormSubmission` row is stored in Postgres
- **AND** a Buildin submissions page is created without passport/bank payload fields
- **AND** a closed Buildin PII RF page stores structured personal fields only
- **AND** confirmation is displayed

#### Scenario: Validation errors
- **WHEN** form is filled incorrectly
- **THEN** validation errors are displayed
- **AND** form is not submitted

### Requirement: Artist Data Form Not RF
The system SHALL allow non-Russian artists to submit their data form with dual-write to Pyrus (until cutover) and Buildin.

#### Scenario: Submit non-RF form
- **WHEN** artist fills the non-RF data form
- **AND** clicks "Submit"
- **THEN** a canonical `FormSubmission` row is stored in Postgres
- **AND** a Buildin submissions page is created without passport/bank payload fields
- **AND** a closed Buildin PII non-RF page stores structured personal fields only
- **AND** confirmation is displayed

### Requirement: Catalog Upload Form
The system SHALL allow uploading music catalog via form with dual-write.

#### Scenario: Submit catalog
- **WHEN** user fills catalog upload form
- **AND** attaches files
- **AND** clicks "Submit"
- **THEN** data is stored as `FormSubmission`
- **AND** Buildin receives the submission with file attachments when dual-write is enabled

### Requirement: Release Upload Form
The system SHALL allow uploading releases via form with dual-write.

#### Scenario: Submit release
- **WHEN** user fills release upload form
- **AND** attaches files (audio, cover)
- **AND** clicks "Submit"
- **THEN** data is stored as `FormSubmission`
- **AND** Buildin receives the submission with file attachments when dual-write is enabled

## ADDED Requirements

### Requirement: Dual-write retry integrity
The system SHALL retry failed Buildin submission writes without creating duplicate pages and without silently dropping expected files.

#### Scenario: Retry after transient Buildin failure
- **WHEN** initial Buildin page create or file upload fails after the submission is stored
- **THEN** an outbox job retries with idempotency key `submission:<submissionId>`
- **AND** staged files are re-uploaded when available
- **AND** status remains `partial` until expected uploads succeed
