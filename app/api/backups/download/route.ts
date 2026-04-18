import { NextRequest, NextResponse } from 'next/server'
import { loadBackupsMetadata, getBackupFilePath } from '@/lib/backup'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const backupId = searchParams.get('id')
    
    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'Backup ID required' },
        { status: 400 }
      )
    }

    const backups = loadBackupsMetadata()
    const backup = backups.find(b => b.id === backupId)
    
    if (!backup) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }

    const filepath = getBackupFilePath(backup.filename)
    
    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { success: false, error: 'Backup file not found' },
        { status: 404 }
      )
    }

    const fileBuffer = fs.readFileSync(filepath)
    
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Length': backup.size.toString()
      }
    })
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download backup' },
      { status: 500 }
    )
  }
}

