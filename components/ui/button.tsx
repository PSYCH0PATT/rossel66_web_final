import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /**
         * C-02: варианты вместо 36 «диких» написаний raw-кнопок.
         *
         * `cta` — главный CTA с glow (инвентаризация #4: bg-#10b981 + тень
         * 0 0 20px). Единый disabled: базовый opacity-50 всех вариантов, а у
         * cta дополнительно гаснут glow и насыщенность — полупрозрачный ярко-
         * зелёный иначе читается как активная кнопка (F-28).
         *
         * `*-outline` — сервисные/деструктивные действия вторым планом
         * (#8, #20, #26). Цвет рамки и заливки — токены статусов, текст —
         * читаемый светлый оттенок палитры (у токенов нет «-400»-градаций).
         */
        cta: "bg-brand font-bold text-black shadow-[0_0_20px_rgb(var(--brand)/0.25)] hover:bg-emerald-400 disabled:shadow-none disabled:saturate-50",
        "destructive-outline":
          "border border-status-danger/50 bg-transparent text-red-400 hover:border-status-danger/70 hover:bg-status-danger/10",
        "success-outline":
          "border border-status-success/50 bg-transparent text-emerald-400 hover:border-status-success/70 hover:bg-status-success/10",
        "warning-outline":
          "border border-status-warning/30 bg-transparent text-amber-200 hover:border-status-warning/60 hover:bg-status-warning/10",
      },
      /**
       * A11y-3: минимальный тач-таргет 44px.
       * Раньше `sm` давал 36px, `default` — 40px, и на мобильном десятки кнопок
       * были ниже минимума. Поднимаем в двух случаях: узкий экран (max-md —
       * практически всегда телефон) и сенсорный ввод (pointer-coarse — ловит
       * планшеты шире md). На десктопе с мышью размеры прежние, чтобы не менять
       * плотность вёрстки.
       */
      size: {
        default: "h-10 px-4 py-2 max-md:h-11 pointer-coarse:h-11",
        sm: "h-9 rounded-md px-3 max-md:h-11 pointer-coarse:h-11",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
