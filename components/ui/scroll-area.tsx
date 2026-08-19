"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Скролл-зона с видимым скроллбаром и градиентом-фейдом — C-11, C-12
 * (docs/ui-audit.md). Внутренние скроллы кабинета шли без аффорданса:
 * список «просто обрезался», и страница переставала скроллиться под
 * курсором (F-38, F-39, F-75).
 *
 * Сознательно НЕ @radix-ui/react-scroll-area (его нет в зависимостях, а
 * этап 2.2 добавляет только файлы): нативный overflow-y-auto + тонкий
 * постоянный скроллбар + фейды у краёв, пока туда можно скроллить. Аудит
 * это допускает («или min: overflow-y-auto + safe-area»). Если позже
 * появится radix-версия — экспортная поверхность (ScrollArea) совместима.
 *
 * `fadeColor` подгоняет фейд под фон подложки (по умолчанию — surface-page,
 * фон кабинета и sheet'а).
 */

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Класс скроллящегося вьюпорта (например, max-h-*). */
  viewportClassName?: string
  /** Tailwind-классы градиентов: пара from-* для верхнего и нижнего фейда. */
  fadeClassName?: string
  /** Выключить фейды (только скроллбар). */
  fade?: boolean
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, fadeClassName = "from-surface-page", fade = true, children, ...props }, ref) => {
    const viewportRef = React.useRef<HTMLDivElement | null>(null)
    const [edges, setEdges] = React.useState({ top: false, bottom: false })

    const update = React.useCallback(() => {
      const el = viewportRef.current
      if (!el) return
      const top = el.scrollTop > 2
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2
      setEdges((prev) =>
        prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
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
      <div ref={ref} className={cn("relative min-h-0", className)} {...props}>
        <div
          ref={viewportRef}
          onScroll={update}
          className={cn(
            // Токен скроллбара не заведён утилитой в tailwind.config — arbitrary.
            // scrollbar-color обязателен: при scrollbar-width Chrome игнорирует
            // ::-webkit-scrollbar-* и рисует дефолтный светлый тумб.
            "h-full overflow-y-auto overscroll-contain [scrollbar-color:rgb(var(--surface-scrollbar-thumb))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--surface-scrollbar-thumb))]",
            viewportClassName
          )}
        >
          {children}
        </div>
        {fade && (
          <>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b to-transparent transition-opacity duration-200",
                fadeClassName,
                edges.top ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t to-transparent transition-opacity duration-200",
                fadeClassName,
                edges.bottom ? "opacity-100" : "opacity-0"
              )}
            />
          </>
        )}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
