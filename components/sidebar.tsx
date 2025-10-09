"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  Home,
  Music,
  FileText,
  DollarSign,
  ListMusic,
  Users,
  Settings,
  LogOut,
  Upload,
  BarChart,
  Search,
} from "lucide-react"

interface SidebarProps {
  role: "artist" | "admin"
  username?: string // Добавляем параметр username
}

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

  function NavItem({
    href,
    icon: Icon,
    children,
    color = "emerald",
  }: {
    href: string
    icon: any
    children: React.ReactNode
    color?: string
  }) {
    const isActive = pathname === href
    const colorClasses = {
      emerald: "text-category-green",
      blue: "text-category-blue",
      purple: "text-category-purple",
      red: "text-category-red",
      amber: "text-category-amber",
    }

    const iconColorClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.emerald

    return (
      <Link
        href={href}
        onClick={handleNavigation}
        className={`flex items-center px-3 py-2 text-sm rounded-xl transition-colors 
          ${isActive ? "bg-accent text-white font-medium" : "text-gray-300 hover:text-white hover:bg-accent/50"}`}
      >
        <Icon className={`h-4 w-4 mr-3 flex-shrink-0 ${isActive ? "text-white" : iconColorClass}`} />
        {children}
      </Link>
    )
  }

  // Создаем базовые пути для артиста с учетом username
  const artistBasePath = `/dashboard/artist/${currentUsername}`

  const artistNavItems = [
    { href: `${artistBasePath}/dashboard`, icon: Home, label: "Главная", color: "emerald" },
    { href: `${artistBasePath}/releases`, icon: Music, label: "Релизы", color: "blue" },
    { href: `${artistBasePath}/reports`, icon: FileText, label: "Отчеты", color: "purple" },
    { href: `${artistBasePath}/payments`, icon: DollarSign, label: "Выплаты", color: "amber" },
    { href: `/dashboard/artist/playlists`, icon: ListMusic, label: "Плейлисты", color: "red" },
  ]

  const adminNavItems = [
    { href: "/dashboard/admin/dashboard", icon: Home, label: "Главная", color: "emerald" },
    { href: "/dashboard/admin/artists", icon: Users, label: "Артисты", color: "blue" },
    { href: "/dashboard/admin/releases", icon: Music, label: "Релизы", color: "purple" },
    { href: "/dashboard/admin/reports", icon: FileText, label: "Отчеты", color: "amber" },
    { href: "/dashboard/admin/payments", icon: DollarSign, label: "Выплаты", color: "red" },
    // Добавляем новый пункт меню для генератора отчетов
    { href: "/dashboard/admin/reports-generator", icon: BarChart, label: "Генератор отчетов", color: "purple" },
    // Объединенная страница плейлистов с парсерами
    { href: "/dashboard/admin/playlists", icon: Search, label: "Плейлисты", color: "blue" },
  ]

  const navItems = role === "artist" ? artistNavItems : adminNavItems

  return (
    <>
      {/* Статичная анимированная кнопка-гамбургер */}
      <button
        type="button"
        className="lg:hidden"
        style={{
          position: 'fixed',
          top: '20px',
          left: '24px', // совпадает с padding контента (p-6 = 24px)
          zIndex: 99999, // максимальный z-index
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto', // гарантируем кликабельность
        }}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <div 
          style={{ 
            width: '24px', 
            height: '18px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            transition: 'transform 0.3s ease',
            transform: isMobileMenuOpen ? 'rotate(90deg)' : 'rotate(0)',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '24px',
              height: '2px',
              backgroundColor: '#ffffff',
              borderRadius: '2px',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '24px',
              height: '2px',
              backgroundColor: '#ffffff',
              borderRadius: '2px',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '24px',
              height: '2px',
              backgroundColor: '#ffffff',
              borderRadius: '2px',
            }}
          />
        </div>
      </button>
      
      <nav
        className={`
          fixed inset-y-0 left-0 z-[70] w-64 bg-sidebar-background transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:w-64 border-r border-sidebar-border
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col">
          <Link
            href={role === "artist" ? `${artistBasePath}/dashboard` : "/dashboard/admin/dashboard"}
            onClick={handleNavigation}
            className="h-16 border-b border-sidebar-border flex items-center"
          >
            {/* Десктоп/планшет: логотип + текст слева, px-6 */}
            <div className="desktopSidebarBrand hidden md:flex items-center gap-3 w-full px-6">
              <Image src="/images/logo.png" alt="ROSSEL 66" width={32} height={32} className="flex-shrink-0" />
              <span className="text-lg font-semibold text-white">ROSSEL 66</span>
            </div>
            
            {/* Мобилка: только логотип по центру */}
            <div className="mobileSidebarLogo flex md:hidden items-center justify-center w-full">
              <Image src="/images/logo.png" alt="ROSSEL 66" width={40} height={40} className="flex-shrink-0" />
            </div>
          </Link>

          <div className="flex-1 overflow-y-auto py-4 px-4">
            <div className="space-y-6">
              <div>
                <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {role === "artist" ? "Личный кабинет" : "Панель управления"}
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <NavItem key={item.href} href={item.href} icon={item.icon} color={item.color}>
                      {item.label}
                    </NavItem>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 border-t border-sidebar-border">
            <div className="px-3 mb-2 text-xs font-semibold text-gray-400">{currentUsername}</div>
            <div className="space-y-1">
              <NavItem
                href={role === "artist" ? `${artistBasePath}/settings` : "/dashboard/admin/settings"}
                icon={Settings}
                color="purple"
              >
                Настройки
              </NavItem>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm rounded-xl transition-colors text-gray-300 hover:text-white hover:bg-accent/50"
              >
                <LogOut className="h-4 w-4 mr-3 flex-shrink-0 text-category-red" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[65] lg:hidden"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)', // для Safari
            pointerEvents: 'auto',
            animation: 'fadeInBlur 200ms ease-in-out',
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <style jsx>{`
        @keyframes fadeInBlur {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
        }
        @media (min-width: 768px) {
          .mobileSidebarLogo { display: none !important; }
        }
        @media (max-width: 767px) {
          .desktopSidebarBrand { display: none !important; }
        }
      `}</style>
    </>
  )
}
