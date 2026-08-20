import { NextRequest, NextResponse } from 'next/server'
import { addActivity, getActivitiesFiltered, type ActivityType } from '@/lib/storage'
import { getSessionUser, requireAuth, requireAdmin } from '@/lib/server-auth'

// GET /api/activities?userId=xxx&role=admin&type=release_added&type=playlist_found&dateFrom=...&dateTo=...&limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const session = getSessionUser()
    const searchParams = request.nextUrl.searchParams
    let userId = searchParams.get('userId') || undefined
    const role = (searchParams.get('role') as 'artist' | 'admin') || undefined

    // F-04: лента кабинета собирается по группе связанных профилей и по
    // metadata.artistId — события про релизы и отчёты пишет система, и артист
    // указан в них только метаданными. Артист всегда видит только свою группу;
    // админ, открывший кабинет артиста, видит ровно ту же ленту.
    // `cabinet=1` ставит только лента кабинета (components/activity-feed.tsx):
    // журнал админа на /activity остаётся строгим фильтром «кто сделал».
    const cabinetMode = searchParams.get('cabinet') === '1'
    let artistGroupIds: string[] | undefined
    const cabinetOwnerId =
      session?.role === 'artist' ? session.id : cabinetMode ? userId : undefined
    if (cabinetOwnerId) {
      const { getArtistGroupIds } = await import('@/lib/artist-links')
      artistGroupIds = await getArtistGroupIds(cabinetOwnerId)
      userId = undefined
    }
    // H5: не фильтруем по неполному хардкод-вайтлисту (иначе валидный, но не
    // перечисленный тип отбрасывался → фильтр не применялся → возвращались ВСЕ).
    // Запрос параметризован; несуществующие типы просто не дадут совпадений.
    const typeParam = searchParams.getAll('type').filter(Boolean)
    const types: ActivityType[] | undefined = typeParam.length
      ? (typeParam as ActivityType[])
      : undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 500)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

    const filters = {
      ...(artistGroupIds?.length && { artistGroupIds }),
      ...(userId && { userId }),
      ...(!artistGroupIds && role && { role }),
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
  const denied = await requireAdmin(request)
  if (denied) return denied

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

