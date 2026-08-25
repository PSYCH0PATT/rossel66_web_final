import { redirect } from "next/navigation"

/**
 * Генератор стал видом объединённых «Отчётов» (вопрос №3: «пусть будет в одной
 * вкладке»), пункт сайдбара снят. Роут остаётся редиректом — закладки на
 * квартальную процедуру не ломаются.
 */
export default function ReportsGeneratorPage() {
  redirect("/dashboard/admin/reports?tab=generator")
}
