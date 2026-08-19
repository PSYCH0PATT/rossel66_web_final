"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Фильтр-чип списков («Все отчёты», «Неподписанные», …) — C-07
 * (docs/ui-audit.md). Заменяет чипы reports-list с цветами через
 * style={{}} (#3b82f6/#ef4444/#f97316/#f59e0b — F-22): те же цвета, но
 * токенами и палитрой. Неактивный чип у всех тонов одинаковый — прозрачный
 * с рамкой slate; активный заливается цветом тона.
 */

const filterChipVariants = cva(
  "inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-md:h-11 pointer-coarse:h-11 sm:text-sm [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        /** #3b82f6, blue-500 — в токенах нет, палитра остаётся классом. */
        info: "data-[active=true]:border-blue-500 data-[active=true]:bg-blue-500 data-[active=true]:text-white",
        success:
          "data-[active=true]:border-brand data-[active=true]:bg-brand data-[active=true]:text-white",
        warning:
          "data-[active=true]:border-status-warning data-[active=true]:bg-status-warning data-[active=true]:text-white",
        /** #f97316, orange-500 — тоже палитра («невыплаченные»). */
        orange:
          "data-[active=true]:border-orange-500 data-[active=true]:bg-orange-500 data-[active=true]:text-white",
        danger:
          "data-[active=true]:border-status-danger data-[active=true]:bg-status-danger data-[active=true]:text-white",
        neutral:
          "data-[active=true]:border-white/20 data-[active=true]:bg-white/10 data-[active=true]:text-white",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  }
)

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof filterChipVariants> {
  active?: boolean
}

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, tone, active = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-active={active}
      aria-pressed={active}
      className={cn(
        // Неактивное состояние: рамка slate-500 (#64748b), текст slate-300 (#cbd5e1).
        "border-slate-500 bg-transparent text-slate-300 hover:bg-white/5",
        filterChipVariants({ tone }),
        className
      )}
      {...props}
    />
  )
)
FilterChip.displayName = "FilterChip"

export { FilterChip, filterChipVariants }
