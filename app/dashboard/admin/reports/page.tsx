import AdminReportsClient, { type ReportsView } from "./admin-reports-client"

/**
 * Адреса объединённого экрана (решение 0-а, вопросы №1 и №3):
 * /payments → ?filter=unpaid, /unregistered-reports → ?tab=unregistered,
 * /reports-generator → ?tab=generator. Редиректы ведут сюда, поэтому вид
 * выбирается по query, а не сбрасывается на «Все».
 */
function viewFromQuery(params: { tab?: string; filter?: string }): ReportsView {
  const raw = params.tab ?? params.filter
  switch (raw) {
    case "unpaid":
      return "unpaid"
    case "pending":
    case "pending-signature":
      return "pending"
    case "unregistered":
      return "unregistered"
    case "generator":
      return "generator"
    default:
      return "all"
  }
}

export default function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string; filter?: string }
}) {
  return <AdminReportsClient initialView={viewFromQuery(searchParams)} />
}
