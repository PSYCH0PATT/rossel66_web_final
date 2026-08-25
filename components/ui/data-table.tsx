"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Пресет таблиц кабинета на ui/table — C-10 (docs/ui-audit.md).
 *
 * Закрывает то, что 10 raw-таблиц не определяли:
 * - горизонтальный скролл с ВИДИМЫМ индикатором: тонкий скроллбар всегда +
 *   градиентные тени у краёв, пока туда можно скроллить (F-76, F-77);
 * - sticky-первая колонка (`stickyFirstColumn`) — опорная колонка не
 *   уезжает при скролле на 390;
 * - кликабельная строка целиком: DataTableRow с href — одно tap-поведение
 *   вместо «попади в название» (F-31);
 * - канонический thead: font-mono uppercase text-gray-500 border-white/10 —
 *   стиль, дословно повторённый в 6 админ-таблицах.
 *
 * Для карточной раскладки на 390 вместо таблицы — DataTableResponsive со
 * слотами table/cards.
 *
 * Разметку строк собирайте из этих же под-компонентов; DataTable сам рендерит
 * <table>, поэтому ui/Table (у него собственная overflow-обёртка) внутрь
 * класть не нужно.
 */

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Первая колонка прилипает к левому краю при горизонтальном скролле. */
  stickyFirstColumn?: boolean
  tableClassName?: string
}

const DataTable = React.forwardRef<HTMLDivElement, DataTableProps>(
  ({ stickyFirstColumn = false, className, tableClassName, children, ...props }, ref) => {
    const viewportRef = React.useRef<HTMLDivElement | null>(null)
    const [shadows, setShadows] = React.useState({ left: false, right: false })

    const update = React.useCallback(() => {
      const el = viewportRef.current
      if (!el) return
      const left = el.scrollLeft > 2
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      setShadows((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right }
      )
    }, [])

    React.useEffect(() => {
      update()
      const el = viewportRef.current
      if (!el) return
      const observer = new ResizeObserver(update)
      observer.observe(el)
      if (el.firstElementChild) observer.observe(el.firstElementChild)
      return () => observer.disconnect()
    }, [update])

    return (
      <div ref={ref} className={cn("relative w-full", className)} {...props}>
        <div
          ref={viewportRef}
          onScroll={update}
          className={cn(
            // Токен скроллбара не заведён утилитой в tailwind.config — arbitrary.
            // scrollbar-color обязателен: при scrollbar-width Chrome игнорирует
            // ::-webkit-scrollbar-* и рисует дефолтный светлый тумб.
            "w-full overflow-x-auto [scrollbar-color:rgb(var(--surface-scrollbar-thumb))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--surface-scrollbar-thumb))]",
            // Sticky-ячейкам нужен непрозрачный фон — под ними едет контент.
            stickyFirstColumn &&
              "[&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-surface-page [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[1] [&_th:first-child]:bg-surface-page"
          )}
        >
          <table className={cn("w-full caption-bottom text-sm", tableClassName)}>
            {children}
          </table>
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/60 to-transparent transition-opacity duration-200",
            shadows.left ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/60 to-transparent transition-opacity duration-200",
            shadows.right ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    )
  }
)
DataTable.displayName = "DataTable"

/** thead/tbody — те же ui/table, реэкспорт ради одного импорта. */
const DataTableHeader = TableHeader
const DataTableBody = TableBody

const DataTableHeadRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <TableRow
    ref={ref}
    className={cn("border-b border-white/10 hover:bg-transparent", className)}
    {...props}
  />
))
DataTableHeadRow.displayName = "DataTableHeadRow"

const DataTableHeadCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <TableHead
    ref={ref}
    className={cn(
      "h-auto whitespace-nowrap px-4 py-3 text-left font-mono text-xs font-medium uppercase tracking-widest text-gray-500",
      className
    )}
    {...props}
  />
))
DataTableHeadCell.displayName = "DataTableHeadCell"

export interface DataTableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Строка целиком ведёт по ссылке; вложенные кнопки/ссылки не перехватываются. */
  href?: string
}

const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
  ({ href, className, onClick, onKeyDown, ...props }, ref) => {
    const router = useRouter()

    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest("a, button, input, select, textarea, label, [role=button]"))

    return (
      <TableRow
        ref={ref}
        tabIndex={href ? 0 : undefined}
        onClick={(e) => {
          onClick?.(e)
          if (!href || e.defaultPrevented || isInteractiveTarget(e.target)) return
          router.push(href)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (!href || e.defaultPrevented || isInteractiveTarget(e.target)) return
          if (e.key === "Enter") router.push(href)
        }}
        className={cn(
          "border-b border-white/5 transition-colors hover:bg-white/[0.04]",
          href &&
            "cursor-pointer focus-visible:bg-white/[0.06] focus-visible:outline-none",
          className
        )}
        {...props}
      />
    )
  }
)
DataTableRow.displayName = "DataTableRow"

const DataTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <TableCell ref={ref} className={cn("px-4 py-3", className)} {...props} />
))
DataTableCell.displayName = "DataTableCell"

export interface DataTableResponsiveProps {
  /** Таблица — видна с md и выше. */
  table: React.ReactNode
  /** Карточная раскладка тех же данных — видна до md (390). */
  cards: React.ReactNode
  className?: string
}

/** Пара «таблица на десктопе / карточки на 390» — второй режим C-10. */
function DataTableResponsive({ table, cards, className }: DataTableResponsiveProps) {
  return (
    <div className={className}>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{cards}</div>
    </div>
  )
}

export {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableHeadRow,
  DataTableHeadCell,
  DataTableRow,
  DataTableCell,
  DataTableResponsive,
}
