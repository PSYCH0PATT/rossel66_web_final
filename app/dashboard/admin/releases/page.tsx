import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import Layout from "@/components/layout"
import AdminReleasesClient from "./admin-releases-client"

export default async function AdminReleasesPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") redirect("/dashboard")

  return (
    <Layout role="admin" requiredRole="admin">
      <AdminReleasesClient />
    </Layout>
  )
}
