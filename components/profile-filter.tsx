"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/**
 * Фильтр по профилю внутри группы связанных профилей (AKA).
 *
 * У группы один кабинет, и все вкладки по умолчанию показывают данные всех её
 * профилей. Этот селект позволяет сузить их до одного. Если профиль один
 * (обычный артист без привязок) — не рендерится вовсе.
 *
 * Волна 4.2: нативный `<select>` заменён на ui/select (C-17) — выпадашку рисует
 * не ОС, а тёмный SelectContent на токенах; хекс `focus:border-[#10b981]` уехал
 * на `brand` (C-04). Стрелку теперь рисует сам триггер, отдельная иконка
 * `unfold_more` не нужна.
 */
export function ProfileFilter({
  value,
  onChange,
  className = "",
}: {
  /** id профиля или "all" */
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const profile = useDashboardProfile()
  const profiles = profile?.profiles ?? []
  if (profiles.length < 2) return null

  return (
    <div className={cn("relative", className)}>
      <Label htmlFor="profile-filter" className="sr-only">
        Профиль
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id="profile-filter"
          className="h-11 w-full rounded-lg border-white/10 bg-black/40 pl-10 pr-3 font-mono text-sm text-white transition-all hover:border-white/20 focus:border-brand"
        >
          <SelectValue placeholder="Все профили" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все профили</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
              {p.isMain ? " · основной" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span
        className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] leading-none text-gray-600"
        aria-hidden
      >
        group
      </span>
    </div>
  )
}

/**
 * Вариант для серверных страниц: состояние живёт в query-параметре `?profile=`,
 * страница читает его на сервере и фильтрует до рендера.
 */
export function ProfileFilterUrl({ value, className }: { value: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <ProfileFilter
      value={value}
      className={className}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "")
        if (next === "all") params.delete("profile")
        else params.set("profile", next)
        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname ?? "")
      }}
    />
  )
}
