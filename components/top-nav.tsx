"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import type { UserRole } from "@/lib/storage"
import { useRouter } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { dashboardLogout } from "@/lib/dashboard-logout"

interface TopNavProps {
  role: UserRole
  username?: string
  mobileMenuOpen: boolean
  onMobileMenuToggle: () => void
}

export default function TopNav({ role, username, mobileMenuOpen, onMobileMenuToggle }: TopNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useDashboardProfile()
  const navUsername = username || profile?.username || ""
  const currentUserName = profile?.name || navUsername
  const avatarUrl = profile?.avatarUrl ?? null
  const currentUsername = navUsername

  // Генерация хлебных крошек на основе текущего пути
  const generateBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)

    const breadcrumbs = [
      {
        label: role === "artist" ? "Артист" : "Админ",
        href: role === "artist" ? `/dashboard/artist/${currentUsername}/dashboard` : "/dashboard/admin/dashboard",
      },
    ]

    if (paths.length > 1) {
      // Для артистов пропускаем username в хлебных крошках
      const startIndex = role === "artist" ? 2 : 1
      if (paths.length > startIndex) {
        const lastPath = paths[paths.length - 1]
        let label = lastPath.charAt(0).toUpperCase() + lastPath.slice(1)

        // Перевод пути на русский
        if (lastPath === "dashboard") label = "Главная"
        if (lastPath === "releases") label = "Релизы"
        if (lastPath === "reports") label = "Отчеты"
        if (lastPath === "payments") label = "Выплаты"
        if (lastPath === "playlists") label = "Плейлисты"
        if (lastPath === "artists") label = "Артисты"
        if (lastPath === "settings") label = "Настройки"
        if (lastPath === "upload") label = "Загрузка"
        if (lastPath === "analytics") label = "Аналитика"

        breadcrumbs.push({ label, href: pathname })
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  function handleLogout() {
    void dashboardLogout(router)
  }

  return (
    <header className="relative z-[105] grid shrink-0 min-h-[calc(4rem+env(safe-area-inset-top,0px))] grid-cols-[minmax(3rem,3.5rem)_1fr_minmax(3rem,3.5rem)] items-center border-b border-white/10 bg-black/80 px-1 pt-[max(0px,env(safe-area-inset-top,0px))] glass-panel backdrop-blur-lg md:hidden">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center self-center text-gray-300 tap-highlight-transparent [-webkit-tap-highlight-color:transparent]"
        onClick={onMobileMenuToggle}
        aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
      >
        <span
          className={`material-symbols-outlined text-3xl leading-none transition-transform duration-300 ${mobileMenuOpen ? "rotate-90" : "rotate-0"}`}
        >
          {mobileMenuOpen ? "close" : "menu"}
        </span>
      </button>

      <div className="flex min-w-0 items-center justify-center">
        <img src="/images/logo.png" alt="" className="h-7 w-auto max-w-[min(200px,55vw)] shrink-0 object-contain object-center" />
      </div>

      <div
        className={`flex shrink-0 items-center justify-end pr-1 transition-[filter,opacity] duration-200 ${
          mobileMenuOpen ? "pointer-events-none blur-[3px] opacity-50" : ""
        }`}
      >
        <DropdownMenu>
          {/* A11y-3: сам аватар остаётся 32px, но зона нажатия — 44px (было 32×32) */}
          <DropdownMenuTrigger
            aria-label="Меню профиля"
            className="flex h-11 w-11 items-center justify-center rounded-full focus:outline-none"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-800 border border-primary/50 text-white text-sm font-bold">
              {avatarUrl ? (
                avatarUrl.startsWith('data:') ? (
                  <img src={avatarUrl} alt="User avatar" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <Image src={avatarUrl} alt="User avatar" width={32} height={32} className="w-full h-full object-cover rounded-full" />
                )
              ) : (
                currentUsername ? currentUsername.charAt(0).toUpperCase() : 'U'
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[200px] bg-black/90 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl">
            <div className="p-3 border-b border-white/10">
              <p className="text-sm font-bold text-white">{currentUserName || currentUsername}</p>
              <p className="text-xs text-primary uppercase tracking-widest mt-1">{role === "artist" ? "Артист" : "Админ"}</p>
            </div>
            <div className="p-2 space-y-1">
              <Link href={role === "artist" ? `/dashboard/artist/${currentUsername}/settings` : "/dashboard/admin/settings"} className="flex items-center gap-3 p-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors group">
                <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">settings</span>
                <span className="mt-0.5">Настройки</span>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors group">
                <span className="material-symbols-outlined text-[18px] group-hover:text-red-400 transition-colors">logout</span>
                <span className="mt-0.5">Выйти</span>
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
