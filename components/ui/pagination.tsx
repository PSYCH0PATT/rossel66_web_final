"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { PAGINATION_STRINGS, paginationSummary } from "@/lib/ui-strings"
import type { PluralForms } from "@/lib/plural"

/**
 * Пагинация списков кабинета — C-06 (docs/ui-audit.md).
 *
 * НЕ каноническая shadcn-пагинация (та — набор ссылок): здесь управляемый
 * компонент под существующие списки с fetch по страницам. Не перезаписывать
 * через `npx shadcn add pagination`.
 *
 * Правила из аудита:
 * - счётчик «Показано X–Y из N» живёт в ОДНОМ месте — здесь (F-27);
 * - при одной странице навигация скрывается целиком, остаётся только
 *   счётчик (F-26);
 * - строки русские, из lib/ui-strings (F-11): «Назад/Вперёд», «На странице».
 */

export interface PaginationProps {
  page: number
  /** Всего записей; из него и pageSize считаются страницы и счётчик. */
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** Селектор «На странице»; без onPageSizeChange не рендерится. */
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: readonly number[]
  /** Формы слова для счётчика: ["релиз", "релиза", "релизов"]. */
  itemForms?: PluralForms
  loading?: boolean
  className?: string
}

/** 1 … 4 5 6 … 20 — как в admin-releases-client, единая логика на все списки. */
export function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (page <= 3) return [1, 2, 3, "...", totalPages]
  if (page >= totalPages - 2)
    return [1, "...", totalPages - 2, totalPages - 1, totalPages]
  return [1, "...", page - 1, page, page + 1, "...", totalPages]
}

const pillClass =
  "rounded border px-3 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-md:min-h-11 pointer-coarse:min-h-11"
const pillIdleClass =
  "border-white/5 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
const pillActiveClass = "border-brand/30 bg-brand/20 text-brand"

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      page,
      total,
      pageSize,
      onPageChange,
      onPageSizeChange,
      pageSizeOptions = [20, 50, 100],
      itemForms,
      loading = false,
      className,
    },
    ref
  ) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    return (
      <nav
        ref={ref}
        aria-label="Пагинация"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          className
        )}
      >
        <div className="font-mono text-xs uppercase text-gray-500">
          {loading
            ? PAGINATION_STRINGS.loading
            : paginationSummary(from, to, total, itemForms)}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {onPageSizeChange && (
              <div
                className="mr-2 flex items-center gap-1"
                aria-label={PAGINATION_STRINGS.perPage}
              >
                {pageSizeOptions.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onPageSizeChange(size)}
                    aria-pressed={pageSize === size}
                    className={cn(
                      "rounded border px-2 py-1 font-mono text-xs transition-colors max-md:min-h-11 pointer-coarse:min-h-11",
                      pageSize === size ? pillActiveClass : pillIdleClass
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className={cn(pillClass, pillIdleClass)}
            >
              {PAGINATION_STRINGS.previous}
            </button>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 font-mono text-xs text-gray-600"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    pillClass,
                    p === page ? pillActiveClass : pillIdleClass
                  )}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className={cn(pillClass, pillIdleClass)}
            >
              {PAGINATION_STRINGS.next}
            </button>
          </div>
        )}
      </nav>
    )
  }
)
Pagination.displayName = "Pagination"

export { Pagination }
