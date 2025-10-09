import { NextRequest, NextResponse } from 'next/server'
import { addActivity, getActivitiesByUserId, getActivitiesByRole, getAllActivities, Activity } from '@/lib/storage'

// GET /api/activities?userId=xxx&role=artist&limit=10
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const role = searchParams.get('role') as 'artist' | 'admin' | null
    const limit = parseInt(searchParams.get('limit') || '10')

    let activities: Activity[]

    if (userId) {
      activities = getActivitiesByUserId(userId, limit)
    } else if (role) {
      activities = getActivitiesByRole(role, limit)
    } else {
      activities = getAllActivities(limit)
    }

    return NextResponse.json({ success: true, activities })
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

    const activity = addActivity({
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

