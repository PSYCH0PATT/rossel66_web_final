import { prisma } from '@/lib/prisma'
import { buildCabinetStreamAnalyticsWhere } from '@/lib/analytics-artist-match'
import type { StreamFilters } from '@/lib/flash-storage'

type SessionUser = {
  id: string
  role: string
  name?: string
  username?: string
}

/**
 * Строит StreamFilters из query params и роли пользователя.
 */
export async function buildAnalyticsFiltersFromRequest(
  session: SessionUser,
  searchParams: URLSearchParams
): Promise<StreamFilters> {
  const filters: StreamFilters = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    trackName: searchParams.get('trackName') || undefined,
    isrc: searchParams.get('isrc') || undefined,
  }

  if (session.role === 'artist') {
    // Переключатель профилей (AKA): артист может смотреть аналитику своего
    // привязанного профиля отдельно. Чужой id сюда не пройдёт — берём только то,
    // что принадлежит его группе.
    const requestedId = searchParams.get('artistId') || undefined
    const viewedId =
      requestedId && requestedId !== session.id
        ? (
            await prisma.user.findFirst({
              where: { id: requestedId, mainArtistId: session.id },
              select: { id: true },
            })
          )?.id
        : session.id

    const user = await prisma.user.findUnique({
      where: { id: viewedId ?? session.id },
      select: { id: true, name: true, username: true },
    })
    if (user) {
      filters.cabinetWhere = await buildCabinetStreamAnalyticsWhere(
        user.id,
        user.name,
        user.username
      )
    } else {
      filters.artistId = session.id
    }
    return filters
  }

  const artistId = searchParams.get('artistId') || undefined
  const trackArtist = searchParams.get('trackArtist') || undefined

  if (artistId) {
    // B2: админ выбрал ростер-артиста → включаем и его коллаб-стримы (строки без
    // artistId, чьё имя токенизируется на него), как в кабинете. Иначе выбор
    // «Artist» занижает стримы, а фит-стримы видны только под отдельной записью.
    const user = await prisma.user.findUnique({
      where: { id: artistId },
      select: { id: true, name: true, username: true },
    })
    if (user) {
      filters.cabinetWhere = await buildCabinetStreamAnalyticsWhere(
        user.id,
        user.name,
        user.username
      )
    } else {
      filters.artistId = artistId
    }
  } else if (trackArtist) {
    filters.trackArtist = trackArtist
  }

  return filters
}
