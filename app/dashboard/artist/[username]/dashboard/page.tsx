import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import {
  getCachedArtistDashboard,
  getCachedStreamAnalytics,
  getCachedActivitiesForFeed,
} from "@/lib/cached-dashboard"
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

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)
  const startStr = start.toISOString().split("T")[0]
  const endStr = end.toISOString().split("T")[0]

  const [analytics, activities] = await Promise.all([
    getCachedStreamAnalytics({
      artistId: data.artist.id,
      startDate: startStr,
      endDate: endStr,
    }),
    getCachedActivitiesForFeed(data.artist.id, "artist", 5),
  ])

  return (
    <ArtistDashboardClient
      username={params.username}
      artist={data.artist}
      releaseCount={data.releaseCount}
      playlistCount={data.playlistCount}
      reports={data.reports}
      initialStreamsByDay={analytics.streamsByDay}
      initialActivities={activities}
    />
  )
}
