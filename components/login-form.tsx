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
    <div className="rounded-xl border border-gray-700 bg-card p-8 shadow-lg">
      {error && (
        <Alert variant="destructive" className="mb-4 rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-white">
            Логин
          </Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="bg-accent/50 border-gray-700 text-white rounded-xl"
            placeholder="Введите ваш логин"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white">
            Пароль
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-accent/50 border-gray-700 text-white rounded-xl"
            placeholder="Введите ваш пароль"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-category-green hover:bg-category-green/90 text-black font-bold rounded-xl"
          disabled={isLoading}
        >
          {isLoading ? "Вход..." : "Войти"}
        </Button>

        <div className="text-center text-xs text-muted-foreground">
          <p>Тестовый аккаунт артиста: plvt / plvt123</p>
          <p>Тестовый аккаунт админа: admin / admin123</p>
        </div>
      </form>
    </div>
  )
}
