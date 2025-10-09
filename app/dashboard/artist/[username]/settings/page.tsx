"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { User, Lock, Mail, Check, AlertCircle, Music, LinkIcon } from "lucide-react"
import { users } from "@/lib/data"
import { notFound } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SettingsPage({ params }: { params: { username: string } }) {
  const [artistId, setArtistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState<any>(null)

  // Состояния для формы
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [vkMusicUrl, setVkMusicUrl] = useState("")
  const [yandexMusicUrl, setYandexMusicUrl] = useState("")
  const [spotifyUrl, setSpotifyUrl] = useState("")

  // Состояния для уведомлений
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [newReleaseNotifications, setNewReleaseNotifications] = useState(true)
  const [newReportNotifications, setNewReportNotifications] = useState(true)
  const [newPaymentNotifications, setNewPaymentNotifications] = useState(true)

  // Состояния для сообщений
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Находим артиста по username из URL
    const staticArtist = users.find((user) => user.username === params.username && user.role === "artist")

    // Проверяем динамически добавленных артистов
    if (!staticArtist) {
      const dynamicUsersStr = localStorage.getItem("dynamicUsers")
      const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []
      const dynamicArtist = dynamicUsers.find(
        (user: any) => user.username === params.username && user.role === "artist",
      )

      if (dynamicArtist) {
        setArtistId(dynamicArtist.id)
        setArtist(dynamicArtist)
        setName(dynamicArtist.name || "")
        setEmail(dynamicArtist.email || "")
        setVkMusicUrl(dynamicArtist.vkMusicUrl || "")
        setYandexMusicUrl(dynamicArtist.yandexMusicUrl || "")
        setSpotifyUrl(dynamicArtist.spotifyUrl || "")
      }
    } else {
      setArtistId(staticArtist.id)
      setArtist(staticArtist)
      setName(staticArtist.name || "")
      setEmail(staticArtist.email || "")
      setVkMusicUrl(staticArtist.vkMusicUrl || "")
      setYandexMusicUrl(staticArtist.yandexMusicUrl || "")
      setSpotifyUrl(staticArtist.spotifyUrl || "")
    }

    setLoading(false)
  }, [params.username])

  // Если артист не найден
  if (!loading && !artistId) {
    notFound()
  }

  // Если еще загружается
  if (loading || !artistId || !artist) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess("")
    setError("")

    // Валидация URL-адресов
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/

    if (vkMusicUrl && !urlPattern.test(vkMusicUrl)) {
      setError("Некорректный URL для ВК Музыки")
      setIsSubmitting(false)
      return
    }

    if (yandexMusicUrl && !urlPattern.test(yandexMusicUrl)) {
      setError("Некорректный URL для Яндекс Музыки")
      setIsSubmitting(false)
      return
    }

    if (spotifyUrl && !urlPattern.test(spotifyUrl)) {
      setError("Некорректный URL для Spotify")
      setIsSubmitting(false)
      return
    }

    try {
      // В реальном приложении здесь был бы API-запрос
      // Имитация задержки API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Обновляем данные в localStorage для динамических пользователей
      if (artist && !users.some((u) => u.id === artist.id)) {
        const dynamicUsersStr = localStorage.getItem("dynamicUsers")
        const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []

        const updatedUsers = dynamicUsers.map((user: any) => {
          if (user.id === artist.id) {
            return {
              ...user,
              name,
              email,
              vkMusicUrl,
              yandexMusicUrl,
              spotifyUrl,
            }
          }
          return user
        })

        localStorage.setItem("dynamicUsers", JSON.stringify(updatedUsers))
      }

      setSuccess("Личная информация успешно обновлена")
    } catch (err) {
      setError("Произошла ошибка при обновлении информации")
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

      // В реальном приложении здесь был бы API-запрос
      // Имитация задержки API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Обновляем пароль в localStorage для динамических пользователей
      if (artist && !users.some((u) => u.id === artist.id)) {
        const dynamicUsersStr = localStorage.getItem("dynamicUsers")
        const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []

        const updatedUsers = dynamicUsers.map((user: any) => {
          if (user.id === artist.id) {
            return {
              ...user,
              password: newPassword,
            }
          }
          return user
        })

        localStorage.setItem("dynamicUsers", JSON.stringify(updatedUsers))
      }

      setSuccess("Пароль успешно обновлен")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError("Произошла ошибка при обновлении пароля")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess("")
    setError("")

    try {
      // В реальном приложении здесь был бы API-запрос
      // Имитация задержки API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setSuccess("Настройки уведомлений успешно обновлены")
    } catch (err) {
      setError("Произошла ошибка при обновлении настроек")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Настройки</h1>

        {success && (
          <Alert className="bg-emerald/20 border-emerald/50 text-white">
            <Check className="h-4 w-4 text-emerald" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border text-card-foreground rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-category-blue" />
                Личная информация
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePersonalInfoSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="name">Имя</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vkMusicUrl" className="flex items-center gap-1">
                    <Music className="h-4 w-4 text-blue-400" />
                    ВК Музыка
                  </Label>
                  <div className="relative">
                    <Input
                      id="vkMusicUrl"
                      type="url"
                      value={vkMusicUrl}
                      onChange={(e) => setVkMusicUrl(e.target.value)}
                      className="bg-accent/50 border-gray-700 text-white pl-9"
                      placeholder="https://vk.com/music/artist/..."
                    />
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yandexMusicUrl" className="flex items-center gap-1">
                    <Music className="h-4 w-4 text-yellow-400" />
                    Яндекс Музыка
                  </Label>
                  <div className="relative">
                    <Input
                      id="yandexMusicUrl"
                      type="url"
                      value={yandexMusicUrl}
                      onChange={(e) => setYandexMusicUrl(e.target.value)}
                      className="bg-accent/50 border-gray-700 text-white pl-9"
                      placeholder="https://music.yandex.ru/artist/..."
                    />
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spotifyUrl" className="flex items-center gap-1">
                    <Music className="h-4 w-4 text-green-400" />
                    Spotify
                  </Label>
                  <div className="relative">
                    <Input
                      id="spotifyUrl"
                      type="url"
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      className="bg-accent/50 border-gray-700 text-white pl-9"
                      placeholder="https://open.spotify.com/artist/..."
                    />
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-category-blue hover:bg-category-blue/80 text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-category-blue" />
                Изменить пароль
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Текущий пароль</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Новый пароль</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-category-blue hover:bg-category-blue/80 text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Обновление..." : "Обновить пароль"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-category-blue" />
                Уведомления
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleNotificationsSubmit}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications" className="flex-1">
                    Email уведомления
                  </Label>
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-accent/50 text-category-blue focus:ring-category-blue"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-release" className="flex-1">
                    Новые релизы
                  </Label>
                  <input
                    type="checkbox"
                    id="new-release"
                    checked={newReleaseNotifications}
                    onChange={(e) => setNewReleaseNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-accent/50 text-category-blue focus:ring-category-blue"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-report" className="flex-1">
                    Новые отчеты
                  </Label>
                  <input
                    type="checkbox"
                    id="new-report"
                    checked={newReportNotifications}
                    onChange={(e) => setNewReportNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-accent/50 text-category-blue focus:ring-category-blue"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-payment" className="flex-1">
                    Новые выплаты
                  </Label>
                  <input
                    type="checkbox"
                    id="new-payment"
                    checked={newPaymentNotifications}
                    onChange={(e) => setNewPaymentNotifications(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-accent/50 text-category-blue focus:ring-category-blue"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-category-blue hover:bg-category-blue/80 text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Сохранение..." : "Сохранить настройки"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5 text-category-blue" />
                Профили в музыкальных сервисах
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Добавьте ссылки на свои профили в музыкальных сервисах, чтобы ваши слушатели могли легко найти вашу
                  музыку.
                </p>

                <div className="space-y-3 p-4 bg-accent/30 rounded-lg">
                  <h3 className="text-sm font-medium">Ваши профили:</h3>

                  {vkMusicUrl && (
                    <a
                      href={vkMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                    >
                      <Music className="h-4 w-4" />
                      ВК Музыка
                    </a>
                  )}

                  {yandexMusicUrl && (
                    <a
                      href={yandexMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300"
                    >
                      <Music className="h-4 w-4" />
                      Яндекс Музыка
                    </a>
                  )}

                  {spotifyUrl && (
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300"
                    >
                      <Music className="h-4 w-4" />
                      Spotify
                    </a>
                  )}

                  {!vkMusicUrl && !yandexMusicUrl && !spotifyUrl && (
                    <p className="text-xs text-gray-400">Нет добавленных профилей</p>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Эти ссылки будут отображаться на вашей странице артиста и помогут слушателям найти вашу музыку на
                  разных платформах.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
