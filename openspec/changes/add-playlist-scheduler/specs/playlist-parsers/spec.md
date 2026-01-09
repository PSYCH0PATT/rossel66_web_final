## ADDED Requirements

### Requirement: Automatic Playlist Parsing Schedule
The system SHALL automatically run playlist parsers on a schedule for artists with recent releases.

#### Scenario: First scan after release
- **WHEN** Friday 00:30 Moscow time arrives
- **THEN** system finds artists with releases in the last 7 days
- **AND** runs Bandlink parser for these artists
- **AND** runs VK parser for these artists
- **AND** adds only new playlists to database

#### Scenario: Follow-up scans
- **WHEN** Saturday, Sunday, or Monday 16:00 Moscow time arrives
- **THEN** system runs the same parsing process
- **AND** adds only new playlists that weren't found before

#### Scenario: No recent releases
- **WHEN** scheduled time arrives
- **AND** no artists have releases in the last 7 days
- **THEN** system logs message and skips parsing

#### Scenario: Featured artists included
- **WHEN** artist is featured on a recent release
- **THEN** their playlists are also scanned

## MODIFIED Requirements

### Requirement: Parser Configuration
The system SHALL allow configuring parser settings including cookies, proxy, and scheduling.

#### Scenario: Set parser cookies
- **WHEN** administrator saves cookies
- **THEN** cookies are saved for future runs

#### Scenario: Configure proxy
- **WHEN** administrator configures proxy
- **THEN** settings are applied to parsers

#### Scenario: Scheduler runs automatically
- **WHEN** server starts
- **THEN** scheduler is initialized via instrumentation.ts
- **AND** cron jobs are registered for playlist parsing

