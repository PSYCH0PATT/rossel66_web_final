import type { ReactNode } from "react"
import { Inter } from "next/font/google"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

/**
 * Каркас экрана логина — единственное исключение из правила «ширину и поля
 * задаёт DashboardShell» (группа G в docs/ui-inventory.md).
 *
 * Логин живёт вне кабинета: `app/dashboard/layout.tsx` не оборачивает его в
 * DashboardShell, и центрированная колонка с формой — это его смысл, а не
 * самодеятельность страницы. Чтобы `pnpm check:page-shell` не пришлось
 * глушить комментарием, рамка вынесена сюда: у самой страницы корень чистый.
 */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 font-sans`}
      style={{ zIndex: 10, fontFamily: "var(--font-inter)" }}
    >
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}
