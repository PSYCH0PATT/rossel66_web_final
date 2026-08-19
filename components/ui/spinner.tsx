import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Единый спиннер загрузки — C-14 (docs/ui-audit.md). Заменяет три исполнения
 * (кольцо border-t-primary, Loader2, border-b-2 white) одним: кольцо
 * primary/30 с бегущим сектором primary — стиль streaming-chart. Для чисел
 * и карточек во время загрузки — скелетоны (skeleton-presets), не «0».
 */

const spinnerVariants = cva(
  "inline-block animate-spin rounded-full border-primary/30 border-t-primary",
  {
    variants: {
      size: {
        sm: "h-4 w-4 border-2",
        md: "h-8 w-8 border-2",
        lg: "h-12 w-12 border-[3px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  /** Подпись под спиннером; для скринридера есть и без неё. */
  label?: React.ReactNode
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size, label, className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      className={cn("inline-flex flex-col items-center gap-3", className)}
      {...props}
    >
      <span className={spinnerVariants({ size })} aria-hidden />
      {label ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {label}
        </span>
      ) : (
        <span className="sr-only">Загрузка</span>
      )}
    </div>
  )
)
Spinner.displayName = "Spinner"

export { Spinner, spinnerVariants }
