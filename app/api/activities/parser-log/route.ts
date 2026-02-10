import { NextResponse } from "next/server"
import { addActivity } from "@/lib/storage"
import type { ActivityType } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, title, description, metadata, userId, userRole } = body

    // Validate required fields
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, description" },
        { status: 400 }
      )
    }

    // Validate activity type
    const validTypes: ActivityType[] = [
      'parser_started',
      'parser_completed',
      'parser_error',
      'parser_release_found',
      'parser_release_updated',
      'parser_playlist_found'
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Add activity
    const activity = await addActivity({
      type,
      userId: userId || 'system',
      userRole: userRole || 'admin',
      title,
      description,
      metadata: metadata || {}
    })

    return NextResponse.json({
      success: true,
      activity
    })
  } catch (error) {
    console.error('Error logging parser activity:', error)
    return NextResponse.json(
      { error: "Failed to log parser activity" },
      { status: 500 }
    )
  }
}
