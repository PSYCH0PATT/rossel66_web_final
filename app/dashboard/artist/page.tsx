import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"

export default function ArtistRedirect() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role === "admin") redirect("/dashboard/admin/dashboard")
  redirect(`/dashboard/artist/${session.username}/dashboard`)
}
