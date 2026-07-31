## ADDED Requirements

### Requirement: Field ownership between Postgres and Buildin
The system SHALL treat Postgres as source of truth for domain fields and Buildin as source of truth for manual ops fields.

#### Scenario: Forward sync update preserves ops fields
- **WHEN** an artist or release is updated in Postgres
- **THEN** Buildin receives only mirror-owned fields
- **AND** Buildin ops fields (`Ops Status`, `Assignee`, `Notes`, `Deadline`, `Tags`) are not overwritten by defaults

### Requirement: Live mirror coverage
The system SHALL enqueue Buildin sync for create and update of artists, releases, tracks, reports, and playlists, and archive sync on deletes where applicable.

#### Scenario: Release update syncs auto status and tracks
- **WHEN** a release is updated in Postgres
- **THEN** a `sync_release` outbox event is enqueued
- **AND** track rows are synced with stable local IDs

#### Scenario: Report payment flag sync
- **WHEN** a report `isPaid` or `isSigned` flag changes
- **THEN** a `sync_report` outbox event is enqueued

### Requirement: Optional mirrors disabled by default
The system SHALL NOT enqueue new Activity or PlaylistHistory mirrors to Buildin.

#### Scenario: New activity stays Postgres-only
- **WHEN** a dashboard activity row is created
- **THEN** no `sync_activity` outbox event is created

### Requirement: Mirror reconciliation
The system SHALL expose reconciliation that compares Postgres entities, BuildinExternalId mappings, outbox health, and sample Buildin accessibility for active databases.

#### Scenario: Admin checks sync health
- **WHEN** an admin calls Buildin reconciliation
- **THEN** the response includes per-entity mapping counts, pending/dead outbox, and cutover readiness that remains false while Pyrus write is still required or sync gaps remain

### Requirement: Playlist placements are one row per track
The system SHALL mirror playlist placements to Buildin as one active row per playlist URL + track identity, with only artist name, track title, playlist name, playlist URL, and first-observed date.

#### Scenario: Multi-track playlist fans out
- **WHEN** a playlist snapshot contains multiple tracks for an artist
- **THEN** Buildin receives one page per track placement
- **AND** each page exposes only `Артист`, `Трек`, `Плейлист`, `URL`, and `Впервые обнаружен`

#### Scenario: First-seen date is stable across disappear and return
- **WHEN** a previously observed track placement disappears from a snapshot and later returns
- **THEN** Postgres keeps the original `firstSeenDate`
- **AND** Buildin is updated without resetting `Впервые обнаружен`

#### Scenario: First-seen uses earliest available observation signal
- **WHEN** a placement is created or updated and CSV `parsed_date`, parent `Playlist.firstSeenDate`, history, or a legacy title-key date is available
- **THEN** `firstSeenDate` is the earliest valid calendar day among those signals and today
- **AND** `firstSeenDate` never moves forward on later imports
- **AND** when an ISRC key replaces a title-based key, the earlier `firstSeenDate` is preserved

#### Scenario: Reconciliation counts active placements
- **WHEN** an admin runs playlist mirror reconciliation
- **THEN** Postgres count is the number of active track placements
- **AND** mappings use entity type `playlist_placement`
