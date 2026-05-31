import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import AdminPaymentsClient from "./admin-payments-client"

export const revalidate = 600

export default async function AdminPaymentsPage() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") redirect("/dashboard")

  return (
    <AdminPaymentsClient />
    )
}
