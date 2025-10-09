import { NextRequest, NextResponse } from 'next/server'
import { restoreFromBackup } from '@/lib/backup'

export async function POST(request: NextRequest) {
  try {
    const { backupId } = await request.json()
    
    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'Backup ID required' },
        { status: 400 }
      )
    }

    const success = await restoreFromBackup(backupId)
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Данные успешно восстановлены из резервной копии'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to restore backup' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to restore backup' },
      { status: 500 }
    )
  }
}

