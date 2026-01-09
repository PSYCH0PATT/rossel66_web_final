# Koala Music Parser

## Purpose
Автоматический парсер релизов с агрегатора Koala Music (portal.koala-music.com). Система авторизуется на портале, собирает информацию о релизах артистов, пропускает черновики, извлекает UPC коды для доставленных релизов и автоматически добавляет/обновляет релизы в системе.

## Requirements

### Requirement: Authentication
The system SHALL authenticate on Koala Music portal using credentials from configuration.

#### Scenario: Successful authentication
- **WHEN** parser starts with valid credentials
- **THEN** system logs into portal.koala-music.com
- **AND** receives authenticated session

#### Scenario: Invalid credentials
- **WHEN** parser starts with invalid credentials
- **THEN** authentication fails
- **AND** error is logged

### Requirement: Release Collection
The system SHALL collect all releases from Koala Music excluding drafts.

#### Scenario: Collect releases
- **WHEN** parser accesses releases page
- **THEN** all release cards are parsed
- **AND** releases with status "Черновик" are skipped

#### Scenario: Parse release metadata
- **WHEN** processing each release card
- **THEN** extract title, artist, status, and release date
- **AND** store koala_id from URL

### Requirement: Release Details Extraction
The system SHALL extract detailed information for each release.

#### Scenario: Extract delivered release details
- **WHEN** release has status "Доставлен"
- **THEN** extract UPC code
- **AND** extract BandLink URL
- **AND** extract cover image URL
- **AND** extract ISRC codes from tracklist

#### Scenario: Extract non-delivered release details
- **WHEN** release has status other than "Доставлен"
- **THEN** extract BandLink URL (if available)
- **AND** extract cover image URL (if available)
- **AND** do NOT attempt to extract UPC code

### Requirement: Status Filtering
The system SHALL skip releases with draft status.

#### Scenario: Skip draft releases
- **WHEN** release status is "Черновик"
- **THEN** release is not processed
- **AND** not added to results

#### Scenario: Process non-draft releases
- **WHEN** release status is any of: "На модерации", "Одобрен", "Отклонён", "В доставке", "Доставлен", "Снят"
- **THEN** release is processed
- **AND** details are extracted

### Requirement: Release Synchronization
The system SHALL synchronize parsed releases with internal database.

#### Scenario: Add new release
- **WHEN** release with koalaId does not exist in system
- **AND** artist exists in system (matched by name)
- **THEN** create new release record
- **AND** set koalaId, status, bandlinkUrl, coverUrl
- **AND** add UPC if status is "Доставлен"
- **AND** create activity log

#### Scenario: Update existing release
- **WHEN** release with koalaId already exists
- **THEN** update status to current value
- **AND** add UPC if status is "Доставлен" and UPC is available
- **AND** update bandlinkUrl if available
- **AND** update timestamp

#### Scenario: Skip release without artist
- **WHEN** release artist name does not match any artist in system
- **THEN** release is skipped
- **AND** not added to database

### Requirement: Scheduled Execution
The system SHALL run parser automatically twice per day.

#### Scenario: Scheduled run at noon
- **WHEN** time is 12:00 Moscow time
- **THEN** parser is triggered automatically
- **AND** results are logged

#### Scenario: Scheduled run at evening
- **WHEN** time is 20:00 Moscow time
- **THEN** parser is triggered automatically
- **AND** results are logged

### Requirement: Manual Execution
The system SHALL allow manual parser execution via admin UI.

#### Scenario: Manual trigger from UI
- **WHEN** administrator clicks "Запустить парсинг" button
- **THEN** parser starts immediately
- **AND** progress is shown in UI
- **AND** results are displayed when complete

### Requirement: Monitoring Dashboard
The system SHALL provide monitoring interface for parser status and results.

#### Scenario: View parser status
- **WHEN** administrator opens Koala Parser page
- **THEN** last run timestamp is displayed
- **AND** success/failure status is shown
- **AND** statistics (added/updated/skipped) are shown

#### Scenario: View parsed releases
- **WHEN** parser completes successfully
- **THEN** last parsed releases are displayed in table
- **AND** shows title, artist, status, UPC, BandLink

### Requirement: Error Handling
The system SHALL log errors and continue processing remaining releases.

#### Scenario: Handle parsing error
- **WHEN** error occurs during single release processing
- **THEN** error is logged
- **AND** processing continues with next release

#### Scenario: Handle authentication failure
- **WHEN** authentication fails
- **THEN** parser stops execution
- **AND** error is logged with details

## Technical Details

### Components
- `parsers/koala_releases_parser.py` — Python парсер (Selenium)
- `parsers/koala_config.json` — конфигурация (логин/пароль)
- `lib/scheduler.ts` — планировщик (node-cron)
- `instrumentation.ts` — автозапуск планировщика при старте
- `app/api/koala-parser/route.ts` — API endpoint
- `app/api/cron/koala/route.ts` — cron endpoint
- `app/dashboard/admin/releases/koala-parser/page.tsx` — UI мониторинга

### Configuration
```json
{
  "login": "email@example.com",
  "password": "password",
  "base_url": "https://portal.koala-music.com",
  "headless": true
}
```

### Environment Variables
- `CRON_SECRET` — секрет для защиты cron endpoint
- `NEXT_PUBLIC_BASE_URL` — базовый URL приложения

### API Endpoints
- `POST /api/koala-parser` — запуск парсинга
- `GET /api/koala-parser` — получить статус последнего запуска
- `GET /api/cron/koala?secret=xxx` — cron endpoint для автозапуска

### Schedule
- **12:00 MSK** — первый ежедневный запуск
- **20:00 MSK** — второй ежедневный запуск
- Используется `node-cron` с timezone `Europe/Moscow`

### Data Flow
```
1. Scheduler triggers parser (12:00/20:00)
2. Python parser authenticates on Koala Music
3. Parser collects release list (skip drafts)
4. For each release: extract details (UPC for delivered)
5. Save results to koala_output.json
6. API processes results:
   - Find artists by name
   - Create/update releases in data/releases.json
   - Add activity logs
7. Return statistics (added/updated/skipped)
```

### Status Mapping
| Koala Music Status | Действие |
|--------------------|----------|
| Черновик | Пропустить |
| На модерации | Добавить (без UPC) |
| Одобрен | Добавить (без UPC) |
| Отклонён | Добавить (без UPC) |
| В доставке | Добавить (без UPC) |
| Доставлен | Добавить с UPC кодом |
| Снят | Добавить (без UPC) |

### Selectors (for maintenance)
- **Release cards**: `role="link"` в `role="section"`
- **Release details page**: `/releases/{koala_id}`
- **UPC field**: текст после "UPC"
- **BandLink**: `a[href*="band.link"]`
- **ISRC codes**: паттерн `ISRC\s*[\n:]*\s*([A-Z]{2}[A-Z0-9]{3}\d{7})`

