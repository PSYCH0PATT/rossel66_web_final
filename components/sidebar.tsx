"use client"

import type React from "react"

import { useState, useEffect, useMemo, memo, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
interface SidebarProps {
  role: "artist" | "admin"
  username?: string // Добавляем параметр username
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
    case "Отчеты":
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
    case "Генератор отчетов":
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

export default function Sidebar({ role, username }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [currentUsername, setCurrentUsername] = useState(username || "")

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUsername(user.username)
    }
  }, [username])

  function handleNavigation() {
    setIsMobileMenuOpen(false)
  }

  function handleLogout() {
    localStorage.removeItem("user")
    router.push("/dashboard/login")
  }

  // Создаем базовые пути для артиста с учетом username
  const artistBasePath = `/dashboard/artist/${currentUsername}`

  const artistNavItems: NavItemConfig[] = useMemo(
    () => [
      { href: `${artistBasePath}/dashboard`, label: "Главная" },
      { href: `${artistBasePath}/releases`, label: "Релизы" },
      { href: `${artistBasePath}/reports`, label: "Отчеты" },
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
      { href: "/dashboard/admin/reports", label: "Отчеты" },
      { href: "/dashboard/admin/payments", label: "Выплаты" },
      { href: "/dashboard/admin/reports-generator", label: "Генератор отчетов" },
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
      <button
        type="button"
        className="md:hidden fixed top-4 left-4 z-50 text-gray-300"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <div className={`transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
          <span className="material-symbols-outlined text-3xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
        </div>
      </button>

      {/* Main Sidebar (Desktop & Mobile when open) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 bg-black/60 glass-panel border-r border-white/5 flex flex-col justify-between h-full backdrop-blur-xl transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div>
          {/* Logo Area */}
          <Link
            href={role === "artist" ? `${artistBasePath}/dashboard` : "/dashboard/admin/dashboard"}
            onClick={handleNavigation}
            className="h-24 flex items-center justify-center lg:justify-start lg:px-8 border-b border-white/5"
          >
            <span className="material-symbols-outlined text-3xl text-primary lg:mr-3">graphic_eq</span>
            <span className="font-display font-bold text-xl tracking-[0.2em] hidden lg:block text-white">
              ROSSEL
            </span>
            <span className="font-display font-bold text-xl tracking-[0.2em] lg:hidden text-white ml-2">
              R66
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="mt-10 px-2 lg:px-4 space-y-1">
            <div className="px-3 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
              {role === "artist" ? "Artist Panel" : "Control Panel"}
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
                <p className="text-[10px] text-primary uppercase tracking-widest">{role}</p>
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
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
