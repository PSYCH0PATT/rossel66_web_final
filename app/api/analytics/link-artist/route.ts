import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { linkTrackArtistToProfile } from '@/lib/analytics-artist-match'
import { CACHE_TAG_STREAM_ANALYTICS } from '@/lib/dashboard-cache-tags'
import { requireAdmin } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/analytics/link-artist
 * Body: { trackArtist: string, artistId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const body = await request.json()
    const trackArtist = typeof body.trackArtist === 'string' ? body.trackArtist.trim() : ''
    const artistId = typeof body.artistId === 'string' ? body.artistId.trim() : ''

    if (!trackArtist || !artistId) {
      return NextResponse.json(
        { success: false, error: 'trackArtist и artistId обязательны' },
        { status: 400 }
      )
    }

    const result = await linkTrackArtistToProfile(trackArtist, artistId)
    revalidateTag(CACHE_TAG_STREAM_ANALYTICS)

    return NextResponse.json({
      success: true,
      rowsUpdated: result.rowsUpdated,
    })
  } catch (error) {
    console.error('❌ link-artist:', error)
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
