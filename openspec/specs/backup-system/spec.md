# Backup System

## Purpose
Система резервного копирования данных. Создание ZIP-архивов с данными и отчетами, восстановление из бекапов, автоматическое резервное копирование по cron, управление списком бекапов.

## Requirements

### Requirement: Create Backup
The system SHALL allow creating backup archives of all critical data.

#### Scenario: Manual backup
- **WHEN** administrator clicks "Create backup"
- **THEN** ZIP archive with data is created
- **AND** archive is saved to `backups/`
- **AND** confirmation is displayed

#### Scenario: Automatic backup
- **WHEN** automatic backup is configured
- **THEN** backup is created on schedule (cron)

### Requirement: Backup Contents
The system SHALL include all critical data files in backup archives.

#### Scenario: Include data files
- **WHEN** backup is created
- **THEN** all files from `data/` directory are included

#### Scenario: Include reports
- **WHEN** backup is created
- **THEN** all files from `reports/` directory are included

### Requirement: Restore Backup
The system SHALL allow restoring data from backup archives.

#### Scenario: Restore from backup
- **WHEN** administrator selects backup to restore
- **AND** confirms action
- **THEN** data is restored from archive
- **AND** current data is overwritten

#### Scenario: Restore confirmation
- **WHEN** administrator initiates restore
- **THEN** system requests confirmation
- **AND** warns about data overwrite

### Requirement: Backup List
The system SHALL display a list of available backups.

#### Scenario: View backup list
- **WHEN** administrator opens backups page
- **THEN** list of all backups is displayed
- **AND** creation date, file size are shown

#### Scenario: Download backup
- **WHEN** administrator clicks "Download" on backup
- **THEN** ZIP file is downloaded

## Technical Details

### Storage
- Backups stored in `backups/` directory
- Format: `backup_YYYY-MM-DD_HH-MM-SS.zip`

### Components
- `app/dashboard/admin/settings/page.tsx` — settings page with backups

### Libraries
- `lib/backup.ts` — backup creation and restore functions

### API
- `GET /api/backups` — list backups
- `POST /api/backups` — create backup
- `POST /api/backups/restore` — restore from backup
- `GET /api/cron/backup` — cron endpoint for auto-backup

### Cron Setup
- Script: `scripts/setup-backup-cron.sh`
- Recommended schedule: daily at 3:00 AM
