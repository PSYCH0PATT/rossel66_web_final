"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Banner } from "@/components/ui/banner"
// Removed import of users from lib/data

export default function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Валидация полей
    if (!username.trim()) {
      setError("Введите логин")
      setIsLoading(false)
      return
    }

    if (!password.trim()) {
      setError("Введите пароль")
      setIsLoading(false)
      return
    }

    try {
      // Отладка: замер времени ответа сервера (сеть + обработка на сервере)
      const fetchStart = performance.now()
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })
      const fetchMs = Math.round(performance.now() - fetchStart)
      if (typeof window !== 'undefined') {
        console.log('[LOGIN_DEBUG] client: fetch + response', fetchMs, 'ms')
      }
      const result = await response.json()
      
      if (!result.success) {
        setError(result.error || "Неверный логин или пароль")
        setIsLoading(false)
        return
      }

      const user = result.user

      // Сессия только в httpOnly cookie (см. /api/auth/login)

      if (user.role === "admin") {
        router.push("/dashboard/admin/dashboard")
      } else {
        router.push(`/dashboard/artist/${user.username}/dashboard`)
      }
    } catch (error) {
      console.error('Ошибка при входе:', error)
      setError("Ошибка при входе в систему")
    }

    setIsLoading(false)
  }

  return (
    /* C-04/C-05: фон формы был inline-стилем rgba(26,29,36,.7) — это ровно
       токен --surface-field, а размытие стояло двумя разными значениями. */
    <div className="rounded-2xl border border-gray-700/50 bg-surface-field/70 p-8 sm:p-10 shadow-2xl backdrop-blur-xs">
      {error && (
        <Banner variant="danger" className="mb-6 rounded-xl">
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-white text-sm font-medium">
            Логин
          </Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="bg-white/5 border-white/10 text-white rounded-xl h-12 px-4 focus:border-primary focus:ring-primary/20 focus:ring-2 transition-all"
            placeholder="Введите ваш логин"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white text-sm font-medium">
            Пароль
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-white/5 border-white/10 text-white rounded-xl h-12 px-4 focus:border-primary focus:ring-primary/20 focus:ring-2 transition-all"
            placeholder="Введите ваш пароль"
          />
        </div>

        {/* C-02, кнопка #5: тот же #10b981, но вариантом кита — с честным
            disabled (F-28), который здесь реально включается на время входа. */}
        <Button
          type="submit"
          variant="cta"
          className="w-full rounded-xl h-12 text-base transition-all"
          disabled={isLoading}
        >
          {isLoading ? "Вход..." : "Войти"}
        </Button>
        
        <p className="text-center text-xs sm:text-sm text-gray-400 mt-4">
          Доступ к личному кабинету есть только у артистов лейбла
        </p>
      </form>
    </div>
  )
}
