import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Пустое состояние списков и графиков — C-14 (docs/ui-audit.md).
 * Иконка + читаемый заголовок + ОДНО действие: не дублировать CTA ссылкой и
 * кнопкой одновременно (F-25), не оставлять экран без действия, если оно
 * есть (F-41). Текст — gray-400, а не «призрачный» gray-600 (F-58).
 */

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Имя иконки material-symbols (library_music, bar_chart, …). */
  icon?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Ровно одно действие: кнопка ИЛИ ссылка. */
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-16 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <span
          className="material-symbols-outlined mb-1 block text-5xl text-gray-600"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="font-mono text-sm uppercase tracking-wider text-gray-400">
        {title}
      </p>
      {description && (
        <p className="max-w-xs text-xs text-gray-500">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
