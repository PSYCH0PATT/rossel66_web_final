import { redirect } from "next/navigation"

/**
 * Экран «Выплаты» влит в объединённые «Отчёты» — решение 0-а и ответ владельца
 * на вопрос №2 (docs/ia-decisions.md): сущность одна, статусы дублировались на
 * трёх экранах. Пункт сайдбара снят, роут остаётся редиректом, чтобы старые
 * закладки вели на нужный вид.
 */
export default function AdminPaymentsPage() {
  redirect("/dashboard/admin/reports?filter=unpaid")
}
