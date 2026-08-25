"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Баннер-уведомление с закрытием — C-15 (docs/ui-audit.md). Кнопка закрытия
 * была дословно скопирована в трёх файлах (инвентаризация #16) — теперь
 * это onClose. Стили — существующие баннеры settings/playlists, значения
 * цветов через токены.
 */

const bannerVariants = cva(
  "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-white/15 bg-white/5 text-gray-300",
        success: "border-brand/30 bg-brand/10 text-emerald-200",
        warning: "border-status-warning/30 bg-status-warning/10 text-amber-200",
        danger: "border-status-danger/30 bg-status-danger/10 text-red-200",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const BANNER_ICONS: Record<string, string> = {
  info: "info",
  success: "check_circle",
  warning: "warning",
  danger: "error",
}

export interface BannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bannerVariants> {
  /** Переопределить иконку material-symbols; null — убрать. */
  icon?: string | null
  onClose?: () => void
}

const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  ({ variant = "info", icon, onClose, className, children, ...props }, ref) => {
    const iconName = icon === null ? null : icon ?? BANNER_ICONS[variant ?? "info"]
    return (
      <div
        ref={ref}
        role={variant === "danger" ? "alert" : "status"}
        className={cn(bannerVariants({ variant }), className)}
        {...props}
      >
        {iconName && (
          <span className="material-symbols-outlined flex-shrink-0" aria-hidden>
            {iconName}
          </span>
        )}
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            // Тач-таргет 44px без роста баннера — отрицательные отступы.
            className="-my-2 -mr-2 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Закрыть"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              close
            </span>
          </button>
        )}
      </div>
    )
  }
)
Banner.displayName = "Banner"

export { Banner, bannerVariants }
