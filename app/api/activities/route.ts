import { NextRequest, NextResponse } from 'next/server'
import { addActivity, getActivitiesFiltered, type ActivityType } from '@/lib/storage'

const ACTIVITY_TYPES: ActivityType[] = [
  'release_added',
  'playlist_found',
  'report_received',
  'payment_sent',
  'user_data_updated',
  'reports_generated',
  'artist_added',
  'artist_removed',
  'release_status_updated'
]

// GET /api/activities?userId=xxx&role=admin&type=release_added&type=playlist_found&dateFrom=...&dateTo=...&limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || undefined
    const role = (searchParams.get('role') as 'artist' | 'admin') || undefined
    const typeParam = searchParams.getAll('type').filter(Boolean)
    const types: ActivityType[] = typeParam.length
      ? typeParam.filter((t): t is ActivityType => ACTIVITY_TYPES.includes(t as ActivityType))
      : undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 500)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

    const filters = {
      ...(userId && { userId }),
      ...(role && { role }),
      ...(types?.length && { types }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo })
    }

    const { activities, total } = await getActivitiesFiltered(filters, limit, offset)
    return NextResponse.json({ success: true, activities, total })
  } catch (error) {
    console.error('Error getting activities:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get activities' },
      { status: 500 }
    )
  }
}

// POST /api/activities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, userId, userRole, title, description, metadata } = body

    if (!type || !userId || !userRole || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const activity = await addActivity({
      type,
      userId,
      userRole,
      title,
      description,
      metadata: metadata || {}
    })

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}

