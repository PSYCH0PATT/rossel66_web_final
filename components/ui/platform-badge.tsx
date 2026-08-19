import * as React from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { platformBadgeColors } from "@/lib/platform-colors"

/**
 * Бейдж площадки — C-15, позиция #25 инвентаризации (docs/ui-audit.md).
 *
 * Брендовые цвета площадок нельзя выразить классом Tailwind, поэтому они
 * задаются inline-стилем; чтобы это не расползалось по страницам (и не спорило
 * с ESLint-правилом C-04 на inline-цвета в `app/dashboard/**`), стиль живёт
 * здесь, а значения приходят из `lib/platform-colors.ts`.
 *
 * До этого одни и те же хексы были выписаны руками в трёх местах
 * `app/dashboard/admin/playlists/page.tsx`: в заголовках секций площадок,
 * в бейджах карточки артиста и в точке на карточке плейлиста.
 */

export interface PlatformBadgeProps extends Omit<BadgeProps, "variant"> {
  /** Название площадки в любом написании: «VK Музыка», «вк», «Yandex Music». */
  platform: string | null | undefined
}

/** Счётчик/подпись в фирменных цветах площадки. */
function PlatformBadge({ platform, className, style, ...props }: PlatformBadgeProps) {
  const colors = platformBadgeColors(platform)
  return (
    <Badge
      className={cn("border-0", className)}
      style={{ backgroundColor: colors.bg, color: colors.color, ...style }}
      {...props}
    />
  )
}

export interface PlatformDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  platform: string | null | undefined
}

/** Точка площадки — та же палитра для чипа на карточке плейлиста. */
const PlatformDot = React.forwardRef<HTMLSpanElement, PlatformDotProps>(
  ({ platform, className, style, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: platformBadgeColors(platform).bg, ...style }}
      {...props}
    />
  )
)
PlatformDot.displayName = "PlatformDot"

export { PlatformBadge, PlatformDot }
