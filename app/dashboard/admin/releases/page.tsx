import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import AdminReleasesClient from "./admin-releases-client"

export default async function AdminReleasesPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") redirect("/dashboard")

  return (
    <AdminReleasesClient />
    )
}
