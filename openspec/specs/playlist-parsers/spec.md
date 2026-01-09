# Playlist Parsers

## Purpose
Система парсинга плейлистов с Bandlink и VK Music. Python-парсеры с Selenium для сбора данных о плейлистах, сохранение в SQLite, интеграция с Bright Data и 2captcha, планирование автоматического парсинга.

## Requirements

### Requirement: Bandlink Parser
The system SHALL parse playlists from Bandlink using Selenium automation.

#### Scenario: Parse artist playlists
- **WHEN** administrator runs parser for an artist
- **THEN** parser collects all playlists from Bandlink
- **AND** saves data to SQLite database

#### Scenario: Handle captcha
- **WHEN** captcha is encountered
- **THEN** 2captcha service is used to solve it

#### Scenario: Use proxy
- **WHEN** parser runs with proxy enabled
- **THEN** Bright Data proxy is used

### Requirement: VK Music Parser
The system SHALL parse playlists from VK Music using Selenium automation.

#### Scenario: Parse artist playlists
- **WHEN** administrator runs VK parser
- **THEN** parser collects playlists from VK Music
- **AND** saves data to SQLite database

#### Scenario: Authentication
- **WHEN** parser requires VK authorization
- **THEN** saved credentials are used

### Requirement: Parser Configuration
The system SHALL allow configuring parser settings including cookies and proxy.

#### Scenario: Set parser cookies
- **WHEN** administrator saves cookies
- **THEN** cookies are saved for future runs

#### Scenario: Configure proxy
- **WHEN** administrator configures proxy
- **THEN** settings are applied to parsers

### Requirement: Playlist Display
The system SHALL display parsed playlists for artists.

#### Scenario: Admin view playlists
- **WHEN** administrator opens playlists page
- **THEN** playlist list is displayed
- **AND** filters by platform and artist are available

#### Scenario: Artist view own playlists
- **WHEN** artist opens "Playlists" page
- **THEN** only playlists with their tracks are shown

## Technical Details

### Storage
- Bandlink: `bandlink_playlists.db` (SQLite)
- VK Music: `vk_playlists.db` (SQLite)

### Python Parsers
- `parsers/bandlink_parser_production_linux.py` — Bandlink for Linux
- `parsers/bandlink_parser_production_mac.py` — Bandlink for macOS
- `parsers/vk_parser_linux.py` — VK Music for Linux

### Components
- `app/dashboard/admin/playlists/parsers/page.tsx` — parser management
- `app/dashboard/artist/[username]/playlists/page.tsx` — artist playlists

### Libraries
- `lib/playlist-crawler.ts` — TypeScript wrapper for parsers
- `lib/vk-parser.ts` — VK parser in TypeScript
- `lib/scheduler.ts` — task scheduler

### API
- `POST /api/parsers/bandlink` — run Bandlink parser
- `POST /api/parsers/vk` — run VK parser
- `GET /api/bandlink/cookies` — get cookies
- `POST /api/bandlink/cookies` — save cookies
