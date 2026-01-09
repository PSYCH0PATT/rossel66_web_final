# Forms Integration

## Purpose
Интеграция с Pyrus для обработки форм артистов. Анкеты для артистов из РФ и не из РФ, загрузка каталога и релизов, оформление дистрибуции с отправкой данных в Pyrus API.

## Requirements

### Requirement: Artist Data Form RF
The system SHALL allow Russian artists to submit their data form to Pyrus.

#### Scenario: Submit RF form
- **WHEN** artist fills the RF data form
- **AND** clicks "Submit"
- **THEN** data is sent to Pyrus (form ID 1100)
- **AND** confirmation is displayed

#### Scenario: Validation errors
- **WHEN** form is filled incorrectly
- **THEN** validation errors are displayed
- **AND** form is not submitted

### Requirement: Artist Data Form Not RF
The system SHALL allow non-Russian artists to submit their data form to Pyrus.

#### Scenario: Submit non-RF form
- **WHEN** artist fills the non-RF data form
- **AND** clicks "Submit"
- **THEN** data is sent to Pyrus (form ID 1101)
- **AND** confirmation is displayed

### Requirement: Catalog Upload Form
The system SHALL allow uploading music catalog via Pyrus form.

#### Scenario: Submit catalog
- **WHEN** user fills catalog upload form
- **AND** attaches files
- **AND** clicks "Submit"
- **THEN** data is sent to Pyrus (form ID 1117)

### Requirement: Release Upload Form
The system SHALL allow uploading releases via Pyrus form.

#### Scenario: Submit release
- **WHEN** user fills release upload form
- **AND** attaches files (audio, cover)
- **AND** clicks "Submit"
- **THEN** data is sent to Pyrus (form ID 1116)

### Requirement: Form Selection Page
The system SHALL display a page with all available forms and descriptions.

#### Scenario: View available forms
- **WHEN** user opens forms page
- **THEN** all available forms are displayed
- **AND** brief description for each

## Technical Details

### Components
- `app/forms/page.tsx` — form selection page
- `app/forms/dataRF/page.tsx` — RF data form
- `app/forms/dataNotRF/page.tsx` — non-RF data form
- `app/forms/catalogUPLOAD/page.tsx` — catalog upload
- `app/forms/releaseUPLOAD/page.tsx` — release upload

### API
- `POST /api/submit-pyrus-data-rf` — submit RF form
- `POST /api/submit-pyrus-data-not-rf` — submit non-RF form
- `POST /api/submit-pyrus-catalog-upload` — catalog upload
- `POST /api/submit-pyrus-release-upload` — release upload
- `POST /api/submit-pyrus-distribution` — distribution

### Pyrus Integration
- Auth via `PYRUS_LOGIN` and `PYRUS_SECRET_KEY`
- Forms:
  - ID 1100 — Artist data (RF)
  - ID 1101 — Artist data (non-RF)
  - ID 1115 — Distribution
  - ID 1116 — Release upload
  - ID 1117 — Catalog upload
