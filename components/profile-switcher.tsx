"use client"

import { usePathname, useRouter } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"

/**
 * Переключатель между профилями одного артиста (AKA).
 *
 * Появляется только когда профилей больше одного — то есть у главного, к которому
 * админ привязал другие карточки. Переключение сохраняет текущую страницу: с
 * «Аналитики» одного профиля попадаешь на «Аналитику» другого.
 */
export function ProfileSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const profile = useDashboardProfile()
  const pathname = usePathname()
  const router = useRouter()

  const profiles = profile?.profiles ?? []
  if (profile?.role !== "artist" || profiles.length < 2) return null

  const currentUsername =
    profiles.find((p) => p.id === profile.viewedArtistId)?.username ?? profile.username

  const handleChange = (nextUsername: string) => {
    if (nextUsername === currentUsername) return
    // /dashboard/artist/<username>/<...> — меняем только сегмент имени.
    const segments = (pathname ?? "").split("/")
    if (segments[1] === "dashboard" && segments[2] === "artist" && segments[3]) {
      segments[3] = nextUsername
      onNavigate?.()
      router.push(segments.join("/"))
    }
  }

  return (
    <div className="px-3">
      <label
        htmlFor="profile-switcher"
        className="mb-1.5 block text-[10px] font-mono uppercase tracking-widest text-gray-500"
      >
        Профиль
      </label>
      <div className="relative">
        <select
          id="profile-switcher"
          value={currentUsername}
          onChange={(e) => handleChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 pr-9 text-sm text-white focus:border-primary/40 focus:outline-none"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.username} className="bg-black text-white">
              {p.name}
              {p.isMain ? " · основной" : ""}
            </option>
          ))}
        </select>
        <span
          className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-lg text-gray-400"
          aria-hidden
        >
          unfold_more
        </span>
      </div>
    </div>
  )
}
