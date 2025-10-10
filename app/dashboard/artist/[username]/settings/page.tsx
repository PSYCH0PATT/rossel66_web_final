"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { User, Lock, Upload, Check, AlertCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

export default function SettingsPage({ params }: { params: { username: string } }) {
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState<any>(null)

  // Состояния для смены пароля
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Состояния для аватарки
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  // Состояния для сообщений
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        const usersResponse = await fetch('/api/users')
        const usersResult = await usersResponse.json()
        
        if (usersResult.success) {
          const foundArtist = usersResult.users.find(
            (a: any) => a.username === params.username && a.role === "artist"
          )
          
          if (foundArtist) {
            setArtist(foundArtist)
            if (foundArtist.avatarUrl) {
              setAvatarPreview(foundArtist.avatarUrl)
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtistData()
  }, [params.username])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess("")
    setError("")

    try {
      if (!avatarPreview) {
        setError("Пожалуйста, выберите изображение")
        setIsSubmitting(false)
        return
      }

      // Обновляем аватарку через API
      const response = await fetch(`/api/artists`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: artist.id,
          avatarUrl: avatarPreview,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess("Аватарка успешно обновлена")
        // Обновляем локальные данные
        setArtist({ ...artist, avatarUrl: avatarPreview })
      } else {
        setError("Ошибка при обновлении аватарки")
      }
    } catch (err) {
      setError("Произошла ошибка при обновлении аватарки")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess("")
    setError("")

    try {
      // Проверка текущего пароля
      if (currentPassword !== artist.password) {
        setError("Неверный текущий пароль")
        setIsSubmitting(false)
        return
      }

      // Проверка совпадения паролей
      if (newPassword !== confirmPassword) {
        setError("Новые пароли не совпадают")
        setIsSubmitting(false)
        return
      }

      // Проверка минимальной длины пароля
      if (newPassword.length < 6) {
        setError("Пароль должен содержать минимум 6 символов")
        setIsSubmitting(false)
        return
      }

      // Обновляем пароль через API
      const response = await fetch(`/api/artists`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: artist.id,
          password: newPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess("Пароль успешно обновлен")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        // Обновляем локальные данные
        setArtist({ ...artist, password: newPassword })
      } else {
        setError("Ошибка при обновлении пароля")
      }
    } catch (err) {
      setError("Произошла ошибка при обновлении пароля")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  if (!artist) {
    notFound()
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Настройки профиля</h1>

        {/* Информация профиля (только для чтения) */}
        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Информация профиля
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-400">Имя артиста</Label>
              <p className="text-lg text-white mt-1">{artist.name}</p>
              <p className="text-xs text-gray-500 mt-1">Имя может изменить только администратор</p>
            </div>
            <div>
              <Label className="text-gray-400">Email</Label>
              <p className="text-lg text-white mt-1">{artist.email || "Не указан"}</p>
              <p className="text-xs text-gray-500 mt-1">Email может изменить только администратор</p>
            </div>
            <div>
              <Label className="text-gray-400">Username</Label>
              <p className="text-lg text-white mt-1">{artist.username}</p>
            </div>
          </CardContent>
        </Card>

        {/* Смена аватарки */}
        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-400" />
              Аватарка профиля
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAvatarSubmit} className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 rounded-full border-4 border-slate-600/30 overflow-hidden">
                  {avatarPreview ? (
                    avatarPreview.startsWith('data:') ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={avatarPreview}
                        alt="Avatar preview"
                        fill
                        className="object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-accent flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {artist.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="avatar" className="text-white cursor-pointer">
                    <div className="border-2 border-dashed border-slate-600/30 rounded-xl p-6 hover:border-slate-500/60 transition-colors text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-300">Нажмите чтобы выбрать изображение</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG до 5MB</p>
                    </div>
                  </Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting || !avatarFile}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Сохранение..." : "Сохранить аватарку"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Смена пароля */}
        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              Смена пароля
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-white">
                  Текущий пароль
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-transparent border-slate-600/30 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">
                  Новый пароль
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-transparent border-slate-600/30 text-white"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500">Минимум 6 символов</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Подтвердите новый пароль
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-transparent border-slate-600/30 text-white"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting ? "Обновление..." : "Обновить пароль"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Сообщения об успехе/ошибке */}
        {success && (
          <Alert className="bg-green-900/20 border-green-700 text-white">
            <Check className="h-4 w-4 text-green-400" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-900/20 border-red-700 text-white">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  )
}
