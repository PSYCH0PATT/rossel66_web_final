import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

const BACKUPS_DIR = path.join(process.cwd(), 'backups')
const BACKUPS_METADATA_FILE = path.join(process.cwd(), 'data', 'backups.json')
const MAX_BACKUPS = 10

export interface BackupMetadata {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'auto' | 'manual'
  filesIncluded: string[]
}

// Ensure backups directory exists
export function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true })
  }
}

// Load backups metadata
export function loadBackupsMetadata(): BackupMetadata[] {
  try {
    if (!fs.existsSync(BACKUPS_METADATA_FILE)) {
      return []
    }
    const data = fs.readFileSync(BACKUPS_METADATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading backups metadata:', error)
    return []
  }
}

// Save backups metadata
export function saveBackupsMetadata(backups: BackupMetadata[]) {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(BACKUPS_METADATA_FILE, JSON.stringify(backups, null, 2))
  } catch (error) {
    console.error('Error saving backups metadata:', error)
    throw error
  }
}

// Create a new backup
export async function createBackup(type: 'auto' | 'manual' = 'manual'): Promise<BackupMetadata> {
  ensureBackupsDir()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5)
  const filename = `backup_${timestamp}.zip`
  const filepath = path.join(BACKUPS_DIR, filename)

  // Files to backup from data directory
  const dataDir = path.join(process.cwd(), 'data')
  
  // Create archive
  const output = fs.createWriteStream(filepath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const stats = fs.statSync(filepath)
      const metadata: BackupMetadata = {
        id: Date.now().toString(),
        filename,
        size: stats.size,
        createdAt: new Date().toISOString(),
        type,
        filesIncluded: [
          'users.json (все данные пользователей + пароли)',
          'releases.json',
          'reports.json',
          'activities.json',
          'balances.json',
          'data/artists/* (все личные данные артистов)',
          'data/reports/* (все отчеты XLSX)',
          'bandlink_playlists.db',
          'vk_playlists.db'
        ]
      }

      // Add to metadata
      const backups = loadBackupsMetadata()
      backups.unshift(metadata)

      // Keep only last MAX_BACKUPS
      if (backups.length > MAX_BACKUPS) {
        const oldBackups = backups.splice(MAX_BACKUPS)
        // Delete old backup files
        oldBackups.forEach(backup => {
          const oldFile = path.join(BACKUPS_DIR, backup.filename)
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile)
          }
        })
      }

      saveBackupsMetadata(backups)
      resolve(metadata)
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)

    // Add data directory if present (legacy local files — deprecated; use pnpm db:backup for Supabase)
    if (fs.existsSync(dataDir)) {
      archive.directory(dataDir, 'data')
    }

    // Add database files
    const dbFiles = ['bandlink_playlists.db', 'vk_playlists.db']
    dbFiles.forEach(dbFile => {
      const dbPath = path.join(process.cwd(), dbFile)
      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: dbFile })
      }
    })

    // Legacy Excel contract files removed — contract data lives in Supabase User table

    archive.finalize()
  })
}

// Get backup file path
export function getBackupFilePath(filename: string): string {
  return path.join(BACKUPS_DIR, filename)
}

// Delete a backup
export function deleteBackup(backupId: string): boolean {
  try {
    const backups = loadBackupsMetadata()
    const backupIndex = backups.findIndex(b => b.id === backupId)
    
    if (backupIndex === -1) {
      return false
    }

    const backup = backups[backupIndex]
    const filepath = path.join(BACKUPS_DIR, backup.filename)
    
    // Delete file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }

    // Remove from metadata
    backups.splice(backupIndex, 1)
    saveBackupsMetadata(backups)

    return true
  } catch (error) {
    console.error('Error deleting backup:', error)
    return false
  }
}

// Restore from backup
export async function restoreFromBackup(backupId: string): Promise<boolean> {
  try {
    const backups = loadBackupsMetadata()
    const backup = backups.find(b => b.id === backupId)
    
    if (!backup) {
      return false
    }

    const filepath = path.join(BACKUPS_DIR, backup.filename)
    
    if (!fs.existsSync(filepath)) {
      return false
    }

    // Extract backup (we'll use a simple approach with unzipper)
    const extract = require('extract-zip')
    const dataDir = path.join(process.cwd(), 'data')
    
    await extract(filepath, { dir: process.cwd() })

    return true
  } catch (error) {
    console.error('Error restoring backup:', error)
    return false
  }
}

