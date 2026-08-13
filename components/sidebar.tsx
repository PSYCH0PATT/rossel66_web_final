"use client"

import type React from "react"

import { useEffect, useMemo, memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { ProfileSwitcher } from "@/components/profile-switcher"
import { dashboardLogout } from "@/lib/dashboard-logout"
interface SidebarProps {
  role: "artist" | "admin"
  username?: string
  mobileMenuOpen: boolean
  onMobileMenuOpenChange: (open: boolean) => void
}

type NavItemConfig = { href: string; label: string }

const SidebarNavItem = memo(function SidebarNavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItemConfig
  pathname: string
  onNavigate: () => void
}) {
  const isActive = pathname === item.href
  let iconName = ""
  switch (item.label) {
    case "Главная":
      iconName = "dashboard"
      break
    case "Релизы":
      iconName = "library_music"
      break
    case "Отчёты":
      iconName = "analytics"
      break
    case "Выплаты":
      iconName = "account_balance_wallet"
      break
    case "Плейлисты":
      iconName = "queue_music"
      break
    case "Артисты":
      iconName = "groups"
      break
    case "Генератор отчётов":
      iconName = "receipt_long"
      break
    case "История плейлистов":
      iconName = "history"
      break
    case "Аналитика":
      iconName = "insights"
      break
    case "Активность":
      iconName = "local_activity"
      break
    default:
      iconName = "circle"
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center p-3 rounded-lg transition-all group ${
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <span
        className={`material-symbols-outlined ${isActive ? "" : "group-hover:text-primary transition-colors"}`}
      >
        {iconName}
      </span>
      <span className="ml-4 font-medium tracking-wide text-sm">{item.label}</span>
    </Link>
  )
})

export default function Sidebar({ role, username, mobileMenuOpen, onMobileMenuOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useDashboardProfile()
  const currentUsername = username || profile?.username || ""

  useEffect(() => {
    onMobileMenuOpenChange(false)
  }, [pathname, onMobileMenuOpenChange])

  function handleNavigation() {
    onMobileMenuOpenChange(false)
  }

  function handleLogout() {
    void dashboardLogout(router)
  }

  // Создаем базовые пути для артиста с учетом username
  const artistBasePath = `/dashboard/artist/${currentUsername}`

  const artistNavItems: NavItemConfig[] = useMemo(
    () => [
      { href: `${artistBasePath}/dashboard`, label: "Главная" },
      { href: `${artistBasePath}/releases`, label: "Релизы" },
      { href: `${artistBasePath}/reports`, label: "Отчёты" },
      { href: `${artistBasePath}/payments`, label: "Выплаты" },
      { href: `${artistBasePath}/playlists`, label: "Плейлисты" },
      { href: `${artistBasePath}/analytics`, label: "Аналитика" },
    ],
    [artistBasePath]
  )

  const adminNavItems: NavItemConfig[] = useMemo(
    () => [
      { href: "/dashboard/admin/dashboard", label: "Главная" },
      { href: "/dashboard/admin/artists", label: "Артисты" },
      { href: "/dashboard/admin/releases", label: "Релизы" },
      { href: "/dashboard/admin/reports", label: "Отчёты" },
      { href: "/dashboard/admin/payments", label: "Выплаты" },
      { href: "/dashboard/admin/reports-generator", label: "Генератор отчётов" },
      { href: "/dashboard/admin/playlists", label: "Плейлисты" },
      { href: "/dashboard/admin/playlists/history", label: "История плейлистов" },
      { href: "/dashboard/admin/analytics", label: "Аналитика" },
      { href: "/dashboard/admin/activity", label: "Активность" },
    ],
    []
  )

  const navItems = role === "artist" ? artistNavItems : adminNavItems

  return (
    <>
      {/* Main Sidebar (Desktop & Mobile when open) */}
      <aside
        className={`fixed inset-y-0 left-0 z-[110] flex h-full w-64 flex-shrink-0 flex-col justify-between border-r border-white/5 bg-black/70 glass-panel backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:z-40 md:translate-x-0 md:bg-black/60 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="max-md:pt-[max(0px,env(safe-area-inset-top,0px))]">
          {/* Logo + close (mobile drawer) */}
          <div className="flex h-16 min-h-16 shrink-0 items-center border-b border-white/5 px-2 lg:px-6">
            <Link
              href={role === "artist" ? `${artistBasePath}/dashboard` : "/dashboard/admin/dashboard"}
              onClick={handleNavigation}
              aria-label="На главную дашборда"
              className="flex h-full min-h-11 min-w-0 flex-1 items-center justify-center px-2"
            >
              <img
                src="/images/logo.png"
                alt=""
                className="h-7 w-auto max-h-7 shrink-0 object-contain"
              />
            </Link>
            <button
              type="button"
              className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 tap-highlight-transparent hover:bg-white/5 hover:text-white [-webkit-tap-highlight-color:transparent]"
              onClick={() => onMobileMenuOpenChange(false)}
              aria-label="Закрыть меню"
            >
              <span className="material-symbols-outlined text-2xl leading-none">close</span>
            </button>
          </div>

          {/* Переключатель профилей (AKA) — только у артиста с привязанными профилями */}
          <div className="mt-6 px-2 lg:px-4">
            <ProfileSwitcher onNavigate={handleNavigation} />
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-2 lg:mt-8 lg:px-4 space-y-1">
            <div className="px-3 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
              {role === "artist" ? "Кабинет артиста" : "Панель управления"}
            </div>
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={handleNavigation}
              />
            ))}
          </nav>
        </div>

        {/* User / Settings Area */}
        <div className="p-6 border-t border-white/5">
          <Link
            href={role === "artist" ? `${artistBasePath}/settings` : "/dashboard/admin/settings"}
            onClick={handleNavigation}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer mb-2"
          >
            <div className="flex items-center overflow-hidden">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 border border-primary/50 text-white font-bold">
                {currentUsername.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{currentUsername || "User"}</p>
                <p className="text-[10px] text-primary uppercase tracking-widest">{role === "artist" ? "Артист" : "Админ"}</p>
              </div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center p-3 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all group"
          >
            <span className="material-symbols-outlined group-hover:text-red-400 transition-colors">logout</span>
            <span className="ml-4 font-medium tracking-wide text-sm">Выйти</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] bg-black/70 backdrop-blur-sm md:hidden top-[calc(4rem+env(safe-area-inset-top,0px))]"
          onClick={() => onMobileMenuOpenChange(false)}
          aria-hidden
        />
      )}
    </>
  )
}
