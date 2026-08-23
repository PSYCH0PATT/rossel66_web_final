import { redirect } from "next/navigation"

/**
 * Визитка артиста удалена — вопрос №6 (docs/ia-decisions.md): экран был
 * orphan'ом, из навигации недостижимым, владелец о его существовании не знал.
 * Главный экран кабинета — /dashboard, туда и ведёт адрес.
 */
export default function ArtistProfilePage({ params }: { params: { username: string } }) {
  redirect(`/dashboard/artist/${params.username}/dashboard`)
}
