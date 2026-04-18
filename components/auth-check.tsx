"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/storage"

interface AuthCheckProps {
  children: React.ReactNode
  requiredRole?: UserRole
  username?: string // Добавляем параметр username для проверки
}

export default function AuthCheck({ children, requiredRole, username }: AuthCheckProps) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userStr = localStorage.getItem("user")

    if (!userStr) {
      router.push("/dashboard/login")
      return
    }

    try {
      const user = JSON.parse(userStr)

      // Проверка роли
      if (requiredRole && user.role !== requiredRole) {
        if (user.role === "admin") {
          router.push("/dashboard/admin/dashboard")
        } else {
          router.push(`/dashboard/artist/${user.username}/dashboard`)
        }
        return
      }

      // Проверка username для артистов
      if (requiredRole === "artist" && username && user.username !== username) {
        router.push(`/dashboard/artist/${user.username}/dashboard`)
        return
      }

      setIsLoading(false)
    } catch (error) {
      localStorage.removeItem("user")
      router.push("/dashboard/login")
    }
  }, [router, requiredRole, username])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-azure"></div>
      </div>
    )
  }

  return <>{children}</>
}
