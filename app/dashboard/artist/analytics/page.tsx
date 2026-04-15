import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"

/** Старый URL без username — редирект на маршрут кабинета артиста. */
export default function LegacyArtistAnalyticsRedirect() {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role === "admin") redirect("/dashboard/admin/analytics")
  redirect(`/dashboard/artist/${session.username}/analytics`)
}
