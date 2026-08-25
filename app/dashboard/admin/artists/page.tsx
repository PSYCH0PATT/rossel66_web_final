import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import AdminArtistsClient from "./admin-artists-client"
import { dashboardHomeHref } from "@/lib/dashboard-home"

export const revalidate = 600

export default async function AdminArtistsPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") redirect(dashboardHomeHref(session))

  return (
    <AdminArtistsClient />
    )
}
