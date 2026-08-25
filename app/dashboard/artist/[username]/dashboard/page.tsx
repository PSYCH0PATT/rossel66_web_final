import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import {
  getCachedArtistDashboard,
  getCachedStreamAnalytics,
  getCachedActivitiesForFeed,
} from "@/lib/cached-dashboard"
import { ARTIST_FEED_VIEW } from "@/lib/activity-views"
import { buildArtistDashboardStreamFilters } from "@/lib/analytics-request-filters"
import { STREAM_WINDOW_DAYS } from "@/lib/stream-window"
import ArtistDashboardClient from "./artist-dashboard-client"

export const revalidate = 600

export default async function ArtistDashboardPage({
  params,
}: {
  params: { username: string }
}) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const result = await getCachedArtistDashboard(params.username)
  if (!result.ok) notFound()

  const { data } = result
  if (!canViewArtistCabinet(session, data.artist)) {
    notFound()
  }

  // F-18: окно и источник метрики — общие со страницей аналитики, иначе
  // «всего прослушиваний» на двух экранах кабинета расходится.
  const [analytics, activities] = await Promise.all([
    getCachedStreamAnalytics(await buildArtistDashboardStreamFilters(data.artist)),
    // Б-24: блок «Последняя активность» показывает тот же артистский вид,
    // что и экран «Все события» (решение 0-б).
    getCachedActivitiesForFeed(data.artist.id, "artist", 5, ARTIST_FEED_VIEW),
  ])

  return (
    <ArtistDashboardClient
      username={params.username}
      artist={data.artist}
      releaseCount={data.releaseCount}
      playlistCount={data.playlistCount}
      reports={data.reports}
      initialStreamsByDay={analytics.streamsByDay}
      streamWindowDays={STREAM_WINDOW_DAYS}
      initialActivities={activities}
      generatedAt={new Date().toISOString()}
    />
  )
}
