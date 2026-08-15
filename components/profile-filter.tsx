"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"

/**
 * Фильтр по профилю внутри группы связанных профилей (AKA).
 *
 * У группы один кабинет, и все вкладки по умолчанию показывают данные всех её
 * профилей. Этот селект позволяет сузить их до одного. Если профиль один
 * (обычный артист без привязок) — не рендерится вовсе.
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
    <div className={`relative ${className}`}>
      <label htmlFor="profile-filter" className="sr-only">
        Профиль
      </label>
      <select
        id="profile-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-white/10 bg-black/40 pl-10 pr-9 font-mono text-sm text-white outline-none transition-all focus:border-[#10b981] hover:border-white/20"
      >
        <option value="all" className="bg-black">
          Все профили
        </option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id} className="bg-black">
            {p.name}
            {p.isMain ? " · основной" : ""}
          </option>
        ))}
      </select>
      <span
        className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-gray-600"
        style={{ fontSize: 18 }}
        aria-hidden
      >
        group
      </span>
      <span
        className="material-symbols-outlined pointer-events-none absolute right-2 top-2.5 text-gray-400"
        style={{ fontSize: 18 }}
        aria-hidden
      >
        unfold_more
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
