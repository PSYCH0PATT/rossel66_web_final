import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

/**
 * Заголовок секции с акцент-полосой — C-15 (docs/ui-audit.md). Один стиль
 * вместо трёх (F-57) и правило для полосы вместо случайных цветов (F-59):
 * по умолчанию полоса primary; другой тон — только если у раздела уже есть
 * свой устоявшийся цвет (плейлисты — azure и т.п.), один на весь раздел.
 */

const ACCENTS = {
  primary: "bg-primary",
  azure: "bg-accent-azure",
  sky: "bg-sky-400",
  orange: "bg-orange-400",
  purple: "bg-brand-purple",
  warning: "bg-status-warning",
} as const

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  accent?: keyof typeof ACCENTS | "none"
  /** md — страницы (text-xl), sm — карточки-секции (text-lg). */
  size?: "md" | "sm"
  as?: "h2" | "h3"
  /** Слот справа: обычно SectionHeaderLink «Все релизы». */
  action?: React.ReactNode
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  (
    { title, accent = "primary", size = "md", as: Heading = "h2", action, className, ...props },
    ref
  ) => (
    <div
      ref={ref}
      className={cn("mb-4 flex items-center justify-between gap-3", className)}
      {...props}
    >
      <Heading
        className={cn(
          "flex items-center gap-2 font-bold tracking-wide text-white",
          size === "md" ? "text-xl" : "text-lg"
        )}
      >
        {accent !== "none" && (
          <span
            className={cn("h-6 w-1.5 shrink-0 rounded-full", ACCENTS[accent])}
            aria-hidden
          />
        )}
        {title}
      </Heading>
      {action}
    </div>
  )
)
SectionHeader.displayName = "SectionHeader"

/**
 * Ссылка секции («Все релизы») — стиль артист-страницы, единый для всех
 * секций. Для next/link: <SectionHeaderLink asChild><Link …/></SectionHeaderLink>.
 */
const SectionHeaderLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"
  return (
    <Comp
      ref={ref}
      className={cn(
        "border-b border-primary/30 pb-0.5 font-mono text-xs uppercase tracking-widest text-primary transition-all hover:border-primary hover:text-emerald-300",
        className
      )}
      {...props}
    />
  )
})
SectionHeaderLink.displayName = "SectionHeaderLink"

export { SectionHeader, SectionHeaderLink }
