import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/**
 * Единая шапка страницы кабинета — C-01 (docs/ui-audit.md).
 *
 * Паттерн «h1 + subtitle + border-b + actions» скопипащен в ~34 экранах в
 * 7 вариантах; этот компонент — их общий знаменатель:
 * - `size="md"` — админ-стандарт, h1 text-3xl/4xl (группа A);
 * - `size="lg"` — крупные экраны админки и весь артист-ЛК, text-4xl/5xl
 *   (группы B, E) — дефолт, таких экранов больше.
 *
 * Правило: H1 = имя сущности («МЕЛАНХОЛИЯ»), а не действие
 * («РЕДАКТИРОВАНИЕ») — действие живёт в subtitle или кнопке (F-24).
 * Слот actions держит primary-кнопку в одном месте на всех экранах (F-32).
 * Экран логина (группа G) остаётся автономным исключением — без PageHeader.
 */

export interface PageHeaderCrumb {
  label: React.ReactNode
  /** Без href крошка считается текущей страницей. */
  href?: string
}

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Короткая крошка-возврат «← К списку». Взаимоисключима с breadcrumbs. */
  backHref?: string
  backLabel?: React.ReactNode
  /** Полные крошки; последняя без href рендерится текущей страницей (F-51: крошка = H1). */
  breadcrumbs?: PageHeaderCrumb[]
  /** Слот действий справа от заголовка (primary — здесь, не внизу экрана). */
  actions?: React.ReactNode
  /**
   * Слот под заголовком: подписи и служебные действия, привязанные к H1
   * (ряд «Синхронизировать / Загрузить CSV / Сопоставить» в аналитике).
   */
  meta?: React.ReactNode
  /** Классы ряда «заголовок ↔ действия»: другая точка слома или выравнивание. */
  rowClassName?: string
  /** Классы слота действий: например, фильтры на всю ширину мобильного экрана. */
  actionsClassName?: string
  size?: "md" | "lg"
}

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      title,
      subtitle,
      backHref,
      backLabel = "К списку",
      breadcrumbs,
      actions,
      meta,
      rowClassName,
      actionsClassName,
      size = "lg",
      className,
      ...props
    },
    ref
  ) => (
    <header
      ref={ref}
      className={cn("border-b border-white/5 pb-8", className)}
      {...props}
    >
      {backHref && !breadcrumbs && (
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-primary md:min-h-0"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            arrow_back
          </span>
          {backLabel}
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div
        className={cn(
          "flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
          rowClassName
        )}
      >
        <div className="min-w-0">
          <h1
            className={cn(
              // text-balance против переноса «РЕДАКТИРОВАНИ / Е» на 390 (F-83);
              // размер на узких экранах дополнительно ужимает dashboard.css.
              "text-balance font-display font-bold uppercase tracking-tight text-white",
              size === "lg" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-md text-sm font-light text-gray-400">
              {subtitle}
            </p>
          )}
          {meta}
        </div>
        {actions && (
          <div className={cn("flex shrink-0 flex-wrap items-center gap-3", actionsClassName)}>
            {actions}
          </div>
        )}
      </div>
    </header>
  )
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
