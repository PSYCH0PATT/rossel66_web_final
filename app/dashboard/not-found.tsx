import { getSessionUser } from "@/lib/server-auth"
import { dashboardHomeHref } from "@/lib/dashboard-home"
import { DashboardNotFound } from "@/components/dashboard-not-found"

/**
 * F-95: любой notFound() внутри /dashboard (артист на админском роуте, чужой
 * кабинет, несуществующий адрес) приводит сюда, а не к английской заглушке
 * Next. Дорога обратно — в кабинет самого вошедшего.
 */
export default function DashboardNotFoundPage() {
  return <DashboardNotFound homeHref={dashboardHomeHref(getSessionUser())} />
}
