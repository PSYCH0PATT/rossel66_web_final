"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { FileInput } from "@/components/ui/file-input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { DashboardFooter } from "@/components/dashboard-footer"
import { PLATFORM_ICONS } from "@/lib/platform-icon"

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

const urlInputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

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
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл больше 5 МБ")
      return
    }
    setError("")
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    if (!username || !password || !name) {
      setError("Пожалуйста, заполните все обязательные поля")
      setIsSubmitting(false)
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Некорректный email адрес")
      setIsSubmitting(false)
      return
    }

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
      // F-UI-10: грузим аватар файлом в Storage → короткий URL (не base64,
      // который не проходил avatarUrl.max(2000))
      let uploadedAvatarUrl: string | undefined
      if (avatarFile) {
        const fd = new FormData()
        fd.append("file", avatarFile)
        const up = await fetch("/api/uploads/avatars", { method: "POST", body: fd })
        const upJson = await up.json()
        if (!up.ok || !upJson.success) {
          setError(upJson.error || "Не удалось загрузить аватар")
          setIsSubmitting(false)
          return
        }
        uploadedAvatarUrl = upJson.url
      }

      const response = await fetch("/api/artists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          name,
          email: email || undefined,
          vkMusicUrl: vkMusicUrl || undefined,
          yandexMusicUrl: yandexMusicUrl || undefined,
          spotifyUrl: spotifyUrl || undefined,
          avatarUrl: uploadedAvatarUrl,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Произошла ошибка при создании артиста")
        setIsSubmitting(false)
        return
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/dashboard/admin/artists")
      }, 2000)
    } catch {
      setError("Произошла ошибка при создании артиста")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
        <PageHeader
          className="mb-6"
          size="md"
          rowClassName="sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:items-center"
          backHref="/dashboard/admin/artists"
          title="Добавить артиста"
          subtitle="Создание аккаунта и профиля в системе"
          actions={
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>person_add</span>
            </div>
          }
        />

        {error && <Banner variant="danger">{error}</Banner>}

        {success && (
          <Banner variant="success">Артист успешно создан! Перенаправление...</Banner>
        )}

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <SectionHeader className="mb-6" size="sm" title="Информация об артисте" />
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-mono uppercase text-gray-400">
                    Логин <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    placeholder="Введите логин..."
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <p className="text-xs text-gray-500">Логин для входа в систему</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-mono uppercase text-gray-400">
                    Пароль <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Введите пароль..."
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-gray-500">Минимум 8 символов</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-mono uppercase text-gray-400">
                    Имя артиста <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Введите имя артиста..."
                  />
                  <p className="text-xs text-gray-500">Отображаемое имя артиста</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-mono uppercase text-gray-400">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="Введите email..."
                    autoComplete="email"
                    spellCheck={false}
                  />
                  <p className="text-xs text-gray-500">Необязательно</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vkMusicUrl" className="text-white flex items-center gap-1 text-sm">
                    <img src={PLATFORM_ICONS.vk} alt="" className="h-4 w-4" />
                    ВК Музыка
                  </Label>
                  <div className="relative">
                    <Input
                      id="vkMusicUrl"
                      type="url"
                      value={vkMusicUrl}
                      onChange={(e) => setVkMusicUrl(e.target.value)}
                      className={urlInputClass}
                      placeholder="https://vk.com/music/artist/..."
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">
                      link
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Ссылка на профиль артиста в ВК Музыке</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yandexMusicUrl" className="text-white flex items-center gap-1 text-sm">
                    <img src={PLATFORM_ICONS.yandex} alt="" className="h-4 w-4" />
                    Яндекс Музыка
                  </Label>
                  <div className="relative">
                    <Input
                      id="yandexMusicUrl"
                      type="url"
                      value={yandexMusicUrl}
                      onChange={(e) => setYandexMusicUrl(e.target.value)}
                      className={urlInputClass}
                      placeholder="https://music.yandex.ru/artist/..."
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">
                      link
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Ссылка на профиль артиста в Яндекс Музыке</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spotifyUrl" className="text-white flex items-center gap-1 text-sm">
                    <img src={PLATFORM_ICONS.spotify} alt="" className="h-4 w-4" />
                    Spotify
                  </Label>
                  <div className="relative">
                    <Input
                      id="spotifyUrl"
                      type="url"
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      className={urlInputClass}
                      placeholder="https://open.spotify.com/artist/..."
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">
                      link
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Ссылка на профиль артиста в Spotify</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar-upload" className="text-xs font-mono uppercase text-gray-400">
                    Аватар
                  </Label>
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-xl bg-white/[0.02] hover:border-primary/30 motion-safe:transition-colors">
                    {avatarPreview ? (
                      <div className="relative w-32 h-32 mb-4 rounded-full border border-primary/50 overflow-hidden">
                        <Image src={avatarPreview || "/placeholder.svg"} alt="" fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-gray-500">person</span>
                      </div>
                    )}
                    <FileInput
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      icon="upload"
                      buttonLabel="Загрузить аватар"
                      buttonClassName="gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-black hover:bg-primary/90"
                      showFileName={false}
                    />
                    <p className="text-xs text-gray-500 mt-2">Рекомендуемый размер: 256×256 px</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-medium text-white mb-2">Что будет создано</h3>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                    <li>Аккаунт артиста с доступом в личный кабинет</li>
                    <li>Папка для хранения обложек релизов и плейлистов</li>
                    <li>Excel-таблица для отслеживания релизов и треков</li>
                    <li>Структура данных для отчётов и выплат</li>
                    <li>Профили в музыкальных сервисах (если указаны)</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-medium text-white mb-2">Профили в сервисах</h3>
                  <p className="text-xs text-gray-500 mb-3">Ссылки отображаются на странице артиста.</p>
                  <div className="space-y-2">
                    {vkMusicUrl && (
                      <a
                        href={vkMusicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <span className="material-symbols-outlined text-base">library_music</span>
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
                        <span className="material-symbols-outlined text-base">library_music</span>
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
                        <span className="material-symbols-outlined text-base">library_music</span>
                        Spotify
                      </a>
                    )}
                    {!vkMusicUrl && !yandexMusicUrl && !spotifyUrl && (
                      <p className="text-xs text-gray-500 font-mono">Нет добавленных профилей</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/artists")}
                className="rounded-lg border-white/20 text-gray-300 hover:bg-white/5 hover:text-white"
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                variant="cta"
                className="rounded-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Создание..." : "Создать артиста"}
              </Button>
            </div>
          </form>
        </div>

        <DashboardFooter />
      </div>
    )
}
