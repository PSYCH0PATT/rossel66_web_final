import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import {
  getCachedAdminDashboard,
  getCachedStreamAnalytics,
  getCachedActivitiesForFeed,
} from "@/lib/cached-dashboard"
import { dashboardStreamWindow, STREAM_WINDOW_DAYS } from "@/lib/stream-window"
import AdminDashboardClient from "./admin-dashboard-client"

export const revalidate = 600

export default async function AdminDashboardPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") notFound()

  // F-18: то же окно, что у страницы аналитики (МСК, не UTC).
  const window = dashboardStreamWindow(STREAM_WINDOW_DAYS)

  const [payload, analytics, activities] = await Promise.all([
    getCachedAdminDashboard(),
    getCachedStreamAnalytics(window),
    // 0-б: лента дашборда — те же три типа событий владельца, что и журнал.
    getCachedActivitiesForFeed(null, "admin", 5, "main"),
  ])

  return (
    <AdminDashboardClient
      artistCount={payload.artistCount}
      releaseCount={payload.releaseCount}
      pendingReleases={payload.pendingReleases}
      reportCount={payload.reportCount}
      payments={payload.payments}
      reports={payload.reports}
      initialStreamsByDay={analytics.streamsByDay}
      streamWindowDays={STREAM_WINDOW_DAYS}
      initialActivities={activities}
    />
  )
}
