import { NextRequest, NextResponse } from 'next/server'
import { loadBackupsMetadata, getBackupFilePath } from '@/lib/backup'
import { requireAdmin } from '@/lib/server-auth'
import { attachmentContentDisposition } from '@/lib/content-disposition'
import fs from 'fs'

export const dynamic = 'force-dynamic'

/**
 * F-SEC-1: роут отдавал zip со всей БД (включая users.json с паролями) БЕЗ
 * авторизации, а id бэкапа = Date.now() и перебираем. Требуем админа.
 */
export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

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
        'Content-Disposition': attachmentContentDisposition(backup.filename),
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

