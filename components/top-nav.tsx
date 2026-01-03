"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { usePathname } from "next/navigation"
import { ChevronRight, User } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { UserRole } from "@/lib/data"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

interface TopNavProps {
  role: UserRole
  username?: string // Добавляем параметр username
}

export default function TopNav({ role, username }: TopNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUsername, setCurrentUsername] = useState(username || "")
  const [currentUserName, setCurrentUserName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUsername(user.username)
    }
  }, [username])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Загружаем данные пользователя включая аватарку
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUsername) return
      
      try {
        const response = await fetch('/api/users')
        const result = await response.json()
        
        if (result.success) {
          const user = result.users.find((u: any) => u.username === currentUsername)
          if (user) {
            setCurrentUserName(user.name)
            setAvatarUrl(user.avatarUrl || null)
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error)
      }
    }

    fetchUserData()
  }, [currentUsername])

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

        breadcrumbs.push({ label, href: pathname })
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  function handleLogout() {
    localStorage.removeItem("user")
    router.push("/dashboard/login")
  }

  return (
    <nav className="px-3 sm:px-6 flex items-center justify-between bg-card border-b border-gray-700 h-full relative">
      <div className="font-medium text-sm hidden sm:flex items-center space-x-1 truncate max-w-[300px]">
        {breadcrumbs.map((item, index) => (
          <div key={item.label} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 text-gray-500 mx-1" />}
            {item.href === pathname ? (
              <span className="text-emerald">{item.label}</span>
            ) : (
              <Link href={item.href} className="text-gray-300 hover:text-white transition-colors">
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Логотип по центру (только на мобилке) */}
      {isMobile && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none lg:hidden">
          <Image src="/images/logo.png" alt="ROSSEL 66" width={42} height={42} className="flex-shrink-0" />
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <div className="flex items-center gap-2 p-1.5 hover:bg-accent/50 rounded-xl transition-colors">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-emerald flex items-center justify-center text-black">
                {avatarUrl ? (
                  avatarUrl.startsWith('data:') ? (
                    <img
                      src={avatarUrl}
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={avatarUrl}
                      alt="User avatar"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[200px] border-gray-700 rounded-xl shadow-lg"
          >
            <div className="p-3 border-b border-gray-700">
              <p className="text-sm font-medium text-white">{currentUserName || currentUsername}</p>
              <p className="text-xs text-gray-400">{role === "artist" ? "Артист" : "Администратор"}</p>
            </div>
            <div className="p-2">
              <Link
                href={role === "artist" ? `/dashboard/artist/${currentUsername}/settings` : "/dashboard/admin/settings"}
                className="flex items-center gap-2 p-2 text-sm text-gray-300 hover:text-white hover:bg-accent/50 rounded-lg transition-colors"
              >
                Настройки
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-2 text-sm text-gray-300 hover:text-white hover:bg-accent/50 rounded-lg transition-colors"
              >
                Выйти
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
