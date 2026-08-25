import * as React from "react"

import { cn } from "@/lib/utils"
import { CHART_SERIES_COLORS } from "@/lib/chart-colors"

/**
 * Полоса серии — C-04/C-09 (docs/ui-audit.md).
 *
 * Тонкие цветные полосы списков аналитики («Прослушивания по трекам»,
 * «Стримы по источникам») красятся по кругу палитрой серий, то есть цветом из
 * JS-константы, а не классом. Компонент держит этот inline-стиль в
 * `components/**` — вне зоны ESLint-правила C-04 — и убирает копипаст
 * `backgroundColor` + `boxShadow` из `app/dashboard/admin/analytics/page.tsx`.
 *
 * Пиксели прежние: высота 3px, дорожка gray-800/80, свечение 6px в цвет серии.
 */

export interface SeriesBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Заполнение полосы в процентах (0–100). */
  percent: number
  /** Порядковый номер серии — цвет берётся по кругу из CHART_SERIES_COLORS. */
  index: number
}

const SeriesBar = React.forwardRef<HTMLDivElement, SeriesBarProps>(
  ({ percent, index, className, ...props }, ref) => {
    const color = CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-[3px] overflow-hidden rounded-full bg-gray-800/80",
          className
        )}
        {...props}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(percent, 2)}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}50`,
          }}
        />
      </div>
    )
  }
)
SeriesBar.displayName = "SeriesBar"

export { SeriesBar }
