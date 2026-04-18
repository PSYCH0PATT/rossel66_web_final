import { NextRequest, NextResponse } from 'next/server'
import { 
  loadBackupsMetadata, 
  createBackup, 
  deleteBackup,
  getBackupFilePath
} from '@/lib/backup'
import fs from 'fs'
import { requireAdmin } from '@/lib/server-auth'

// GET - Get list of backups
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const backups = loadBackupsMetadata()
    return NextResponse.json({ success: true, backups })
  } catch (error) {
    console.error('Error fetching backups:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backups' },
      { status: 500 }
    )
  }
}

// POST - Create new backup
export async function POST(request: NextRequest) {
  try {
    const { type = 'manual' } = await request.json()
    const backup = await createBackup(type)
    
    return NextResponse.json({ 
      success: true, 
      backup,
      message: 'Резервная копия успешно создана'
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create backup' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a backup
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const backupId = searchParams.get('id')
    
    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'Backup ID required' },
        { status: 400 }
      )
    }

    const success = deleteBackup(backupId)
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Резервная копия удалена'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error deleting backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete backup' },
      { status: 500 }
    )
  }
}

