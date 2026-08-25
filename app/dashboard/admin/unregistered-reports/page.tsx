import { redirect } from "next/navigation"

/**
 * Роут-сирота: экран был достижим только по прямому URL, а его «Назначить» и
 * диалог назначения переехали во вкладку «Без кабинета» объединённых «Отчётов»
 * (вопрос №1, ответ владельца — вариант «а»).
 */
export default function UnregisteredReportsPage() {
  redirect("/dashboard/admin/reports?tab=unregistered")
}
