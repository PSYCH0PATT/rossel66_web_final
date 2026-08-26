import type { Metadata } from "next"

import { requireDevPages } from "@/lib/dev-pages"

// Тёмная тема кабинета: переменные shadcn и классы .dashboard-theme /
// card-glass / stat-card-glass живут в dashboard.css, который подключён
// только в layout'е кабинета. Витрина рендерит компоненты в тех же пикселях.
import "@/app/dashboard/dashboard.css"

export const metadata: Metadata = {
  title: "UI-кит кабинета — /dev/ui",
  robots: { index: false, follow: false },
}

/**
 * Проверка окружения обязана происходить на запросе, а не при сборке: иначе
 * `ENABLE_DEV_PAGES`, выставленная в панели рантайма, ничего не изменит —
 * страница уже будет запечена как 404. Для двух внутренних витрин это ничего
 * не стоит.
 */
export const dynamic = "force-dynamic"

export default function DevUiLayout({ children }: { children: React.ReactNode }) {
  requireDevPages()

  // Скролл — внутри <main>, как в шелле кабинета (.dashboard-theme main в
  // dashboard.css): лендинговый globals.css держит html/body в overflow:hidden,
  // и страница без собственного скролл-контейнера не прокручивается вовсе.
  return (
    <div className="dashboard-theme flex h-screen flex-col">
      <main>{children}</main>
    </div>
  )
}
