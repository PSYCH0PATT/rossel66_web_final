import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Скелетоны под формы кабинета — C-14 (docs/ui-audit.md). Во время загрузки
 * экраны показывали ложный «0 стримов» (F-54) или пустоту — вместо этого
 * заглушка формы будущего контента. Фон — white/5, как у ручного скелетона
 * streaming-chart, а не bg-muted стока.
 */

const pulseClass = "bg-white/5"

/** Строка текста; ширину задавайте классом (w-32, w-full…). */
function SkeletonLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-4", pulseClass, className)} {...props} />
}

/** Крупное значение стат-карточки или KPI (замена ложному «0»). */
function SkeletonValue({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-9 w-32 rounded", pulseClass, className)} {...props} />
}

/** Каркас стат-карточки целиком. */
function SkeletonStatCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-surface-raised/60 p-4 md:p-6",
        className
      )}
      {...props}
    >
      <Skeleton className={cn("mb-3 h-9 w-9 rounded-lg", pulseClass)} />
      <Skeleton className={cn("mb-4 h-3 w-24", pulseClass)} />
      <Skeleton className={cn("h-8 w-20", pulseClass)} />
    </div>
  )
}

export interface SkeletonRowsProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number
}

/** Строки таблицы или списка на время загрузки страницы данных. */
function SkeletonRows({ rows = 5, className, ...props }: SkeletonRowsProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className={cn("h-10 w-10 shrink-0 rounded-lg", pulseClass)} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3.5 w-1/3", pulseClass)} />
            <Skeleton className={cn("h-3 w-1/5", pulseClass)} />
          </div>
          <Skeleton className={cn("h-5 w-16 shrink-0 rounded-full", pulseClass)} />
        </div>
      ))}
    </div>
  )
}

/** Заглушка области графика. */
function SkeletonChart({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <SkeletonValue />
      <Skeleton className={cn("h-[200px] w-full rounded-lg", pulseClass)} />
    </div>
  )
}

export { SkeletonLine, SkeletonValue, SkeletonStatCard, SkeletonRows, SkeletonChart }
