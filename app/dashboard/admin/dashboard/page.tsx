import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import {
  getCachedAdminDashboard,
  getCachedStreamAnalytics,
  getCachedActivitiesForFeed,
} from "@/lib/cached-dashboard"
import AdminDashboardClient from "./admin-dashboard-client"

export const revalidate = 600

export default async function AdminDashboardPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") notFound()

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)
  const startStr = start.toISOString().split("T")[0]
  const endStr = end.toISOString().split("T")[0]

  const [payload, analytics, activities] = await Promise.all([
    getCachedAdminDashboard(),
    getCachedStreamAnalytics({
      startDate: startStr,
      endDate: endStr,
    }),
    getCachedActivitiesForFeed(null, "admin", 5),
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
      initialActivities={activities}
    />
  )
}
