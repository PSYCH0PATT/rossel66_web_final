"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
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

    try {
      // Получаем всех пользователей через API (включая админов и артистов)
      const response = await fetch('/api/users')
      const result = await response.json()
      
      if (!result.success) {
        setError("Ошибка при проверке данных")
        setIsLoading(false)
        return
      }

      const user = result.users.find((user: any) => user.username === username && user.password === password)

      if (user) {
        // Сохраняем данные пользователя
        localStorage.setItem(
          "user",
          JSON.stringify({
            username: user.username,
            role: user.role,
            id: user.id,
            name: user.name,
          }),
        )

        if (user.role === "admin") {
          router.push("/dashboard/admin/dashboard")
        } else {
          router.push(`/dashboard/artist/${user.username}/dashboard`)
        }
      } else {
        setError("Неверный логин или пароль")
      }
    } catch (error) {
      console.error('Ошибка при входе:', error)
      setError("Ошибка при входе в систему")
    }

    setIsLoading(false)
  }

  return (
    <div className="rounded-2xl border border-gray-700/50 p-8 sm:p-10 shadow-2xl" style={{ backgroundColor: 'rgba(26, 29, 36, 0.7)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(4px)' }}>
      {error && (
        <Alert variant="destructive" className="mb-6 rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
            className="bg-white/5 border-white/10 text-white rounded-xl h-12 px-4 focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2 transition-all"
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
            className="bg-white/5 border-white/10 text-white rounded-xl h-12 px-4 focus:border-emerald-500 focus:ring-emerald-500/20 focus:ring-2 transition-all"
            placeholder="Введите ваш пароль"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl h-12 text-base transition-all hover:shadow-lg hover:shadow-emerald-500/20"
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
