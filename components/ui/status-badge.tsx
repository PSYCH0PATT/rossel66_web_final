import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Статус-бейдж — C-15 (docs/ui-audit.md). Один компонент вместо дубля
 * ReleaseStatusBadge на ~100 строк в двух файлах и CSS-классов
 * .release-status-badge--* в globals.css: те же пиксели, но токенами
 * статусов, и один стиль на статус (F-23).
 */

const statusBadgeVariants = cva(
  // База = .release-status-badge: капс 0.65rem, пилюля, зазор 4px.
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-[0.6rem] py-1 text-[0.65rem] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        /** «В эфире»: зелёный + свечение + пульс-точка. */
        live: "border-status-success/20 bg-status-success/10 text-status-success shadow-[0_0_10px_rgb(var(--status-success)/0.1)]",
        /** «Доставлен»: лазурный. */
        delivered: "border-status-info/20 bg-status-info/10 text-status-info",
        /** «Модерируется»: жёлтый модерации (не warning!). */
        moderation:
          "border-status-moderation/20 bg-status-moderation/10 text-status-moderation",
        /** «Отклонён»: красный. */
        rejected: "border-status-danger/20 bg-status-danger/10 text-status-danger",
        /** «Черновик» / нет данных: серый. */
        draft: "border-gray-600/50 bg-surface-hover/80 text-status-neutral",
        /** Предупреждение (не статус модерации — другой жёлтый). */
        warning:
          "border-status-warning/20 bg-status-warning/10 text-status-warning",
      },
    },
    defaultVariants: {
      variant: "draft",
    },
  }
)

/** Иконка статуса — как в текущих бейджах релизов. */
const STATUS_ICONS: Record<string, React.ReactNode> = {
  live: (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
      aria-hidden
    />
  ),
  delivered: (
    <span className="material-symbols-outlined text-[10px] leading-none" aria-hidden>
      check
    </span>
  ),
  moderation: (
    <span
      className="material-symbols-outlined animate-spin text-[10px] leading-none"
      aria-hidden
    >
      sync
    </span>
  ),
  rejected: (
    <span className="material-symbols-outlined text-[10px] leading-none" aria-hidden>
      block
    </span>
  ),
  draft: (
    <span className="material-symbols-outlined text-[10px] leading-none" aria-hidden>
      edit
    </span>
  ),
  warning: (
    <span className="material-symbols-outlined text-[10px] leading-none" aria-hidden>
      warning
    </span>
  ),
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Убрать иконку/точку слева. */
  withIcon?: boolean
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ variant = "draft", withIcon = true, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {withIcon && STATUS_ICONS[variant ?? "draft"]}
      {children}
    </span>
  )
)
StatusBadge.displayName = "StatusBadge"

export type ReleaseStatusVariant =
  | "live"
  | "delivered"
  | "moderation"
  | "rejected"
  | "draft"

/**
 * Маппинг сырых статусов релиза (русские и английские написания из данных)
 * на вариант бейджа — бывший дубль getStatusVariant в двух клиентах.
 */
export function releaseStatusVariant(status?: string): ReleaseStatusVariant {
  switch (status) {
    case "Доставлен":
    case "released":
    case "Одобрен":
      return "live"
    case "В доставке":
    case "delivery":
      return "delivered"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "moderation"
    case "Отклонен":
    case "Отклонён":
    case "Снят":
      return "rejected"
    default:
      return "draft"
  }
}

/** Единая русская подпись статуса — бывший дубль getStatusLabel. */
export function releaseStatusLabel(status?: string): string {
  switch (releaseStatusVariant(status)) {
    case "live":
      return "Доставлен"
    case "delivered":
      return "В доставке"
    case "moderation":
      return "Модерируется"
    case "rejected":
      return "Отклонен"
    default:
      return status || "Драфт"
  }
}

export interface ReleaseStatusBadgeProps
  extends Omit<StatusBadgeProps, "variant" | "children"> {
  status?: string
}

/** Бейдж статуса релиза по сырому значению из данных. */
const ReleaseStatusBadge = React.forwardRef<HTMLSpanElement, ReleaseStatusBadgeProps>(
  ({ status, ...props }, ref) => (
    <StatusBadge ref={ref} variant={releaseStatusVariant(status)} {...props}>
      {releaseStatusLabel(status)}
    </StatusBadge>
  )
)
ReleaseStatusBadge.displayName = "ReleaseStatusBadge"

export { StatusBadge, ReleaseStatusBadge, statusBadgeVariants }
