import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * KPI-карточка дашборда — C-15 (docs/ui-audit.md). Общий знаменатель
 * стат-карточек артиста (4), payments (3) и админки: стекло
 * .stat-card-glass, чип-иконка, подпись font-mono uppercase, крупное
 * display-значение (регистр и типографика значений — F-64), фоновая
 * иконка-вотермарка.
 *
 * Тон задаёт цвет чипа и вотермарки по правилу, а не «на глаз» (F-59):
 * neutral — белый, primary — выручка/успех, azure — аналитика,
 * purple/warning — спец-разделы.
 */

const TONES = {
  neutral: {
    chip: "border-white/10 bg-white/5 text-white",
    watermark: "text-white",
  },
  primary: {
    chip: "border-primary/20 bg-primary/10 text-primary",
    watermark: "text-brand",
  },
  azure: {
    chip: "border-accent-azure/20 bg-accent-azure/10 text-accent-azure",
    watermark: "text-brand-azure",
  },
  purple: {
    chip: "border-brand-purple/20 bg-brand-purple/10 text-brand-purple-fg",
    watermark: "text-brand-purple",
  },
  warning: {
    chip: "border-status-warning/20 bg-status-warning/10 text-status-warning",
    watermark: "text-status-warning",
  },
} as const

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value: React.ReactNode
  /** Имя иконки material-symbols в чипе над подписью. */
  icon?: string
  /** Фоновая иконка-вотермарка у правого края (stat-dash-bg-*). */
  bgIcon?: string
  /**
   * Классы вотермарки поверх тона: модификатор `stat-dash-bg-icon--short`
   * для приземистых глифов (groups) и точечные оттенки.
   */
  bgIconClassName?: string
  tone?: keyof typeof TONES
  /** Дополнительная строка под значением (дельта, подпись периода). */
  footer?: React.ReactNode
  /**
   * Карточка целиком ведёт в свой раздел. На дашборде артиста «Релизы 5» —
   * это вход в релизы, а не подпись: раньше цифру приходилось искать заново
   * в меню (вердикт 3.2).
   */
  href?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { label, value, icon, bgIcon, bgIconClassName, tone = "neutral", footer, href, className, children, ...props },
    ref
  ) => {
    const toneClasses = TONES[tone]
    const card = (
      <div
        ref={ref}
        className={cn(
          "stat-card-glass group relative overflow-hidden rounded-2xl p-4 md:p-6",
          className
        )}
        {...props}
      >
        {bgIcon && (
          <div className="stat-dash-bg-wrap">
            <span
              className={cn(
                "material-symbols-outlined stat-dash-bg-icon",
                toneClasses.watermark,
                bgIconClassName
              )}
              aria-hidden
            >
              {bgIcon}
            </span>
          </div>
        )}
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="mb-4">
            {icon && (
              <span
                className={cn(
                  "mb-3 inline-flex items-center justify-center rounded-lg border p-2",
                  toneClasses.chip
                )}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden>
                  {icon}
                </span>
              </span>
            )}
            <h3 className="font-mono text-xs uppercase tracking-widest text-gray-400">
              {label}
            </h3>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="font-display text-2xl font-bold tabular-nums text-white md:text-3xl xl:text-4xl">
              {value}
            </p>
            {children}
          </div>
          {footer && <div className="mt-2 text-xs text-gray-400">{footer}</div>}
        </div>
      </div>
    )

    if (!href) return card
    // Ссылкой оборачиваем, а не подменяем корень: карточка остаётся div'ом,
    // её ref и типы прежние, а кликом становится вся плитка целиком.
    return (
      <Link
        href={href}
        className="block rounded-2xl outline-none transition-shadow hover:shadow-[0_0_0_1px_rgb(var(--brand)/0.35)] focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {card}
      </Link>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
