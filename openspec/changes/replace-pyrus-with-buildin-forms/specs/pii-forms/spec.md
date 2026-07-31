## ADDED Requirements

### Requirement: Closed PII storage for artist questionnaires
The system SHALL store passport and bank fields only in closed Buildin PII databases. Shared Заявки MUST NOT contain those fields.

#### Scenario: RF questionnaire shared inbox is redacted
- **WHEN** a data_rf form is submitted
- **THEN** the shared submissions page stores nickname/type/status and a relation pointer only
- **AND** passport and bank values exist only on the closed PII RF page

#### Scenario: Delivery ledger excludes plaintext PII
- **WHEN** a PII form delivery session is created
- **THEN** temporary Postgres records do not store passport or bank values in plaintext JSON columns
- **AND** any temporary envelope is encrypted at rest with FORM_DELIVERY_ENCRYPTION_KEY
