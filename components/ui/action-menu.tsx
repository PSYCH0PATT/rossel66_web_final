"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Overflow-меню сервисных действий — решение 0-в (docs/ia-decisions.md).
 *
 * Правило владельца: парсеры, синк, CSV, сопоставление, привязка, добавление и
 * bulk-добавление нужны «когда ломается», а не каждый день, — поэтому на
 * поверхности экрана таких кнопок нет ни одной, все они пункты одного меню:
 * «Сервис» — починка данных, «Ещё» — редкие нейтральные действия.
 *
 * Ничего не удаляется: это demote, а не kill. Операции с очередью показывают
 * счётчик бейджем на самом триггере («Сопоставить (3)» на аналитике), иначе
 * число непривязанных исчезло бы вместе с кнопкой (0-в п.2).
 *
 * Триггер намеренно outline-серый: filled на списочном экране остаётся ровно
 * там, где живёт настоящее primary-действие (0-г, C-03).
 */

export type ActionMenuKind = "service" | "more"

const KIND: Record<ActionMenuKind, { label: string; icon: string }> = {
  service: { label: "Сервис", icon: "build" },
  more: { label: "Ещё", icon: "more_horiz" },
}

export interface ActionMenuProps {
  /** «Сервис» — аварийные операции, «Ещё» — редкие нейтральные (0-в п.1). */
  kind?: ActionMenuKind
  /** Подпись триггера, если каноничная не подходит. */
  label?: string
  /** Счётчик очереди бейджем на триггере: 0 и undefined не рисуются. */
  count?: number
  /** Что счётчик означает — для скринридера. */
  countLabel?: string
  disabled?: boolean
  align?: "start" | "end"
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

const ActionMenu = React.forwardRef<HTMLButtonElement, ActionMenuProps>(
  (
    {
      kind = "service",
      label,
      count,
      countLabel,
      disabled,
      align = "end",
      className,
      contentClassName,
      children,
    },
    ref
  ) => {
    const preset = KIND[kind]
    const showCount = typeof count === "number" && count > 0

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "relative h-11 gap-1 rounded-lg border-white/10 bg-transparent px-3 font-mono text-xs uppercase tracking-widest text-gray-400 hover:text-white",
              className
            )}
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              {preset.icon}
            </span>
            {label ?? preset.label}
            {showCount && (
              <>
                <span
                  aria-hidden
                  className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-status-warning/20 px-1.5 text-[10px] font-bold text-amber-300"
                >
                  {count}
                </span>
                <span className="sr-only">
                  {countLabel ? `${countLabel}: ${count}` : `в очереди: ${count}`}
                </span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className={cn("w-64 border border-white/10 bg-black/90 backdrop-blur-xl", contentClassName)}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)
ActionMenu.displayName = "ActionMenu"

export interface ActionMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuItem> {
  /** Иконка material-symbols слева от подписи. */
  icon?: string
  /** Пояснение второй строкой: зачем это трогают. */
  description?: React.ReactNode
}

/**
 * Пункт меню. С `asChild` пункт становится ссылкой (`<Link>`): иконка и
 * пояснение переезжают внутрь неё, иначе Radix-слот получил бы двух детей и
 * упал на `React.Children.only`.
 */
const ActionMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  ActionMenuItemProps
>(({ icon, description, className, asChild, children, ...props }, ref) => {
  const body = (label: React.ReactNode) => (
    <>
      {icon && (
        <span className="material-symbols-outlined mt-0.5 text-base text-gray-400" aria-hidden>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm text-white">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
        )}
      </span>
    </>
  )
  const itemClassName = cn("min-h-11 cursor-pointer items-start gap-3 px-3 py-2", className)

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ children?: React.ReactNode }>
    return (
      <DropdownMenuItem ref={ref} asChild className={itemClassName} {...props}>
        {React.cloneElement(child, undefined, body(child.props.children))}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem ref={ref} className={itemClassName} {...props}>
      {body(children)}
    </DropdownMenuItem>
  )
})
ActionMenuItem.displayName = "ActionMenuItem"

export { ActionMenu, ActionMenuItem }
