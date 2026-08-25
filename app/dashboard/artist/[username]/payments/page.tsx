import { redirect } from "next/navigation"

/**
 * Экран «Выплаты» влит в объединённые «Отчёты и выплаты» — решение 0-а и ответ
 * владельца на вопрос №2 (docs/ia-decisions.md): сущность одна, а «История
 * отчётов» на этом экране повторяла /reports карточка-в-карточку. Пункт
 * сайдбара снят, роут остаётся редиректом, чтобы старые закладки вели туда же.
 * Зеркально админскому app/dashboard/admin/payments/page.tsx.
 */
export default function ArtistPaymentsPage({ params }: { params: { username: string } }) {
  redirect(`/dashboard/artist/${params.username}/reports`)
}
