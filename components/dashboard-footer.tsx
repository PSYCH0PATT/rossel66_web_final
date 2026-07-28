import type { ReactNode } from "react"

/**
 * DS8 + DS14: единый футер кабинета.
 *
 * Раньше в десяти страницах лежала копия одного и того же блока с английским
 * «System Operational» и дев-подписью «ROSSEL LABEL ENGINE V2.4 | ADMIN»
 * (выдуманная версия движка, наружу её показывать незачем).
 */
export function DashboardFooter({
  role = "admin",
  children,
}: {
  /** Подпись справа: панель администратора или кабинет артиста */
  role?: "admin" | "artist"
  /** Необязательный блок посередине — например, счётчик найденного */
  children?: ReactNode
}) {
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs font-mono text-gray-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Система работает
      </div>

      {children}

      <span className="uppercase tracking-widest text-gray-400 sm:text-right">
        ROSSEL 66 MUSIC · {role === "admin" ? "Панель администратора" : "Кабинет артиста"}
      </span>
    </footer>
  )
}
