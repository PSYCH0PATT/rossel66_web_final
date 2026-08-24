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
 * 7 вариантах; этот компонент — их общий знаменатель.
 *
 * Размер H1 один на весь кабинет и задаётся здесь — снаружи его передать
 * нечем. Проп `size` был удалён намеренно: волны 1–4 пересадили страницы на
 * компонент, но `size="md"` на 11 экранах против `lg` на 18 оставил заголовки
 * трёх разных размеров. Нужен другой размер — правится эта строка, а не
 * страница.
 *
 * Ширину и поля страницы задаёт DashboardShell (`mx-auto max-w-7xl p-6
 * md:p-10`), поэтому вертикальный отступ шапки (`pb-8`) тоже живёт здесь:
 * `className` идёт через twMerge и внешний `pb-6` молча перебивал канон.
 *
 * Правило: H1 = имя сущности («МЕЛАНХОЛИЯ»), а не действие
 * («РЕДАКТИРОВАНИЕ») — действие живёт в subtitle или кнопке (F-24).
 * Слот actions держит primary-кнопку в одном месте на всех экранах (F-32).
 * Возврат на уровень выше — `backHref`/`breadcrumbs` внутри шапки, а не
 * отдельной кнопкой над ней.
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
      className,
      ...props
    },
    ref
  ) => (
    <header
      ref={ref}
      className={cn(
        "border-b border-white/5",
        className,
        // Вертикальный ритм идёт ПОСЛЕ className намеренно: cn() это twMerge,
        // побеждает последний класс. Внешние `pb-6`/`mb-8` больше не сдвигают
        // шапку — отступ до контента задаёт `space-y-8` корня страницы.
        "mb-0 pb-8"
      )}
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
            // Здесь намеренно голая строка, а НЕ cn(): tailwind-merge считает
            // `text-balance` и `text-4xl` одной группой `text-*` и выкидывает
            // первый как перебитый. Пока размер приходил вторым аргументом
            // cn(), `text-balance` не доезжал до разметки вовсе — то есть
            // фикс F-83 («РЕДАКТИРОВАНИ / Е» на 390) в бою не работал.
            // Проверить: twMerge("text-balance …", "text-4xl") вернёт строку
            // без text-balance.
            //
            // Размер на узких экранах дополнительно ужимает dashboard.css
            // (медиазапросы на `.dashboard-theme h1`).
            className="text-balance font-display text-4xl font-bold uppercase tracking-tight text-white md:text-5xl"
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
