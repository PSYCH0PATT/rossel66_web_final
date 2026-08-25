import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Тулбар списочных экранов — C-08 (docs/ui-audit.md). Заменяет 15 raw-кнопок
 * admin-releases с цветами через style={{borderColor, color, background}}
 * (24 inline style): те же цвета — токенами и палитрой, по тону на кнопку.
 *
 * Мобильное поведение: кнопки переносятся; primary-кнопке ставьте
 * `mobileFirst` — на узком экране она встаёт первой, а не уезжает в третий
 * ряд (F-09). Что из сервисного уходит в overflow — вердикты C-03 (этап 5).
 */

const Toolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="toolbar"
    className={cn(
      // Токен скроллбара не заведён утилитой в tailwind.config — arbitrary.
      // scrollbar-color обязателен: при scrollbar-width Chrome игнорирует
      // ::-webkit-scrollbar-* и рисует дефолтный светлый тумб.
      "flex min-w-0 flex-wrap items-center gap-2 [scrollbar-color:rgb(var(--surface-scrollbar-thumb))_transparent] [scrollbar-width:thin] sm:flex-nowrap sm:overflow-x-auto sm:pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--surface-scrollbar-thumb))]",
      className
    )}
    {...props}
  />
))
Toolbar.displayName = "Toolbar"

const toolbarButtonVariants = cva(
  // База — toolbarBtnClass из admin-releases-client: h-10, font-mono uppercase.
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 font-mono text-xs uppercase tracking-wider transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 pointer-coarse:h-11 [&_.material-symbols-outlined]:shrink-0 [&_.material-symbols-outlined]:text-base",
  {
    variants: {
      tone: {
        /** «Добавить релиз»: рамка brand/45, текст green-400 (#4ade80). */
        primary: "border-brand/45 bg-brand/[0.08] text-green-400",
        /** «Koala Parser»: рамка brand/35, текст emerald-400 (#34d399). */
        success: "border-brand/35 bg-brand/[0.08] text-emerald-400",
        /** «Zvonko Parser»: blue-500/35 + blue-400 (#60a5fa) — палитра, токена нет. */
        info: "border-blue-500/35 bg-blue-500/[0.08] text-blue-400",
        /** «Привязать релизы»: orange-400 (#fb923c) — палитра. */
        warning: "border-orange-400/35 bg-orange-400/[0.08] text-orange-400",
        /** «Фильтры» в покое: белая рамка 12%, серый текст, фон black/35. */
        neutral: "border-white/[0.12] bg-black/35 text-gray-400",
        /** «Фильтры» с активными фильтрами: зелёная рамка и текст токеном. */
        active: "border-brand/45 bg-brand/[0.08] text-brand",
        /** «Сбросить»: slate-400 (#94a3b8) — палитра. */
        muted: "border-slate-400/35 bg-black/35 text-slate-400",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toolbarButtonVariants> {
  asChild?: boolean
  /** Иконка material-symbols слева от подписи. */
  icon?: string
  /** На <sm кнопка встаёт первой в переносе — место primary-действия. */
  mobileFirst?: boolean
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    { className, tone, asChild = false, icon, mobileFirst = false, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        className={cn(
          toolbarButtonVariants({ tone }),
          mobileFirst && "max-sm:order-first",
          className
        )}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {icon && (
              <span className="material-symbols-outlined" aria-hidden>
                {icon}
              </span>
            )}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
ToolbarButton.displayName = "ToolbarButton"

export { Toolbar, ToolbarButton, toolbarButtonVariants }
