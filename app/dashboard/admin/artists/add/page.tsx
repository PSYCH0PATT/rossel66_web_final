"use client"

import type React from "react"

import { useState } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Upload, Check, AlertCircle, ArrowLeft, Music, LinkIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AddArtistPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [vkMusicUrl, setVkMusicUrl] = useState("")
  const [yandexMusicUrl, setYandexMusicUrl] = useState("")
  const [spotifyUrl, setSpotifyUrl] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

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

  // Изменим функцию handleSubmit, чтобы она сохраняла нового артиста в localStorage
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    // Validate form
    if (!username || !password || !name) {
      setError("Пожалуйста, заполните все обязательные поля")
      setIsSubmitting(false)
      return
    }

    // Валидация email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Некорректный email адрес")
      setIsSubmitting(false)
      return
    }

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
      // Создаем нового артиста через API
      const response = await fetch('/api/artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          name,
          email: email || undefined,
          vkMusicUrl: vkMusicUrl || undefined,
          yandexMusicUrl: yandexMusicUrl || undefined,
          spotifyUrl: spotifyUrl || undefined,
          avatarUrl: avatarPreview || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Произошла ошибка при создании артиста")
        setIsSubmitting(false)
        return
      }

      // Показываем сообщение об успехе
      setSuccess(true)

      // Перенаправляем после небольшой задержки
      setTimeout(() => {
        router.push("/dashboard/admin/artists")
      }, 2000)
    } catch (err) {
      setError("Произошла ошибка при создании артиста")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/dashboard/admin/artists"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад к списку артистов</span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Добавить артиста</h1>
          </div>
          
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-500/20 border-emerald-500/50 text-white">
            <Check className="h-4 w-4 text-emerald-400" />
            <AlertDescription>Артист успешно создан! Перенаправление...</AlertDescription>
          </Alert>
        )}

        <Card className="bg-transparent border-slate-600/30 text-white rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-400" />
              Информация об артисте
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-white">
                      Логин <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-transparent border border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
                      placeholder="Введите логин"
                    />
                    <p className="text-xs text-muted-foreground">Логин для входа в систему</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">
                      Пароль <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-transparent border border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
                      placeholder="Введите пароль"
                    />
                    <p className="text-xs text-muted-foreground">Минимум 8 символов</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">
                      Имя артиста <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-transparent border border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
                      placeholder="Введите имя артиста"
                    />
                    <p className="text-xs text-muted-foreground">Отображаемое имя артиста</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent border border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
                      placeholder="Введите email"
                    />
                    <p className="text-xs text-muted-foreground">Необязательно</p>
                  </div>

                  {/* Добавляем поля для ссылок на музыкальные сервисы */}
                  <div className="space-y-2">
                    <Label htmlFor="vkMusicUrl" className="text-white flex items-center gap-1">
                      <img src="https://cdn.simpleicons.org/vk/0077FF" alt="VK Music" className="h-4 w-4" />
                      ВК Музыка
                    </Label>
                    <div className="relative">
                      <Input
                        id="vkMusicUrl"
                        type="url"
                        value={vkMusicUrl}
                        onChange={(e) => setVkMusicUrl(e.target.value)}
                        className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors pl-9"
                        placeholder="https://vk.com/music/artist/..."
                      />
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в ВК Музыке</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yandexMusicUrl" className="text-white flex items-center gap-1">
                      <img src="https://cdn.simpleicons.org/yandexmusic/FFCC00" alt="Yandex Music" className="h-4 w-4" />
                      Яндекс Музыка
                    </Label>
                    <div className="relative">
                      <Input
                        id="yandexMusicUrl"
                        type="url"
                        value={yandexMusicUrl}
                        onChange={(e) => setYandexMusicUrl(e.target.value)}
                        className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors pl-9"
                        placeholder="https://music.yandex.ru/artist/..."
                      />
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в Яндекс Музыке</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spotifyUrl" className="text-white flex items-center gap-1">
                      <img src="/spotify-logo.png" alt="Spotify" className="h-4 w-4" />
                      Spotify
                    </Label>
                    <div className="relative">
                      <Input
                        id="spotifyUrl"
                        type="url"
                        value={spotifyUrl}
                        onChange={(e) => setSpotifyUrl(e.target.value)}
                        className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors pl-9"
                        placeholder="https://open.spotify.com/artist/..."
                      />
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в Spotify</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avatar" className="text-white">
                      Аватар
                    </Label>
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-600/30 rounded-xl bg-transparent hover:border-slate-500/60 transition-colors">
                      {avatarPreview ? (
                        <div className="relative w-32 h-32 mb-4 rounded-full border-2 border-emerald-500/60 hover:border-emerald-400 transition-colors overflow-hidden">
                          <Image
                            src={avatarPreview || "/placeholder.svg"}
                            alt="Avatar preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-32 mb-4 rounded-full bg-transparent border-2 border-slate-600/40 hover:border-slate-500/70 transition-colors flex items-center justify-center">
                          <User className="h-16 w-16 text-slate-400" />
                        </div>
                      )}
                      <label
                        htmlFor="avatar-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 border-2 border-transparent hover:border-emerald-300 transition-all duration-200 cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Загрузить аватар</span>
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground mt-2">Рекомендуемый размер: 256x256 пикселей</p>
                    </div>
                  </div>

                  <div className="p-4 bg-transparent border border-slate-600/20 rounded-xl hover:border-slate-500/40 transition-colors">
                    <h3 className="text-sm font-medium mb-2">Что будет создано:</h3>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Аккаунт артиста с доступом в личный кабинет</li>
                      <li>Папка для хранения обложек релизов и плейлистов</li>
                      <li>Excel-таблица для отслеживания релизов и треков</li>
                      <li>Структура данных для отчетов и выплат</li>
                      <li>Профили в музыкальных сервисах (если указаны)</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-transparent border border-slate-600/20 rounded-xl hover:border-slate-500/40 transition-colors">
                    <h3 className="text-sm font-medium mb-2">Профили в музыкальных сервисах:</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Добавьте ссылки на профили артиста в музыкальных сервисах для отображения на странице артиста.
                    </p>
                    <div className="space-y-2">
                      {vkMusicUrl && (
                        <a
                          href={vkMusicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
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
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/admin/artists")}
                  className="border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-transparent hover:border-emerald-300 transition-all duration-200"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Создание..." : "Создать артиста"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
