import { NextRequest, NextResponse } from 'next/server'
import { createBackup } from '@/lib/backup'

// This endpoint will be called by a cron job every 3 days at 3:00 AM
export async function GET(request: NextRequest) {
  try {
    // Simple authentication check (you should use a proper secret key)
    const authHeader = request.headers.get('authorization')
    const expectedAuth = process.env.CRON_SECRET || 'your-secret-key-here'
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[CRON] Starting automatic backup...')
    const backup = await createBackup('auto')
    console.log('[CRON] Backup created:', backup.filename)
    
    return NextResponse.json({ 
      success: true, 
      backup,
      message: 'Automatic backup created successfully'
    })
  } catch (error) {
    console.error('[CRON] Error creating automatic backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create automatic backup' },
      { status: 500 }
    )
  }
}

