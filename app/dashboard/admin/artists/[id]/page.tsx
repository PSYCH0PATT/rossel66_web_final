"use client"

import type React from "react"
import { formatDateRu } from "@/lib/format-date"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { FileInput } from "@/components/ui/file-input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { DashboardFooter } from "@/components/dashboard-footer"
import { ArtistAdvances } from "@/components/artist-advances"
import { ArtistLinkedProfiles } from "@/components/artist-linked-profiles"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PLATFORM_ICONS } from "@/lib/platform-icon"

export default function EditArtistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const artistId = params.id

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  /** J1: текущий пароль артиста; null — сохранён старым bcrypt-хешем, показать нельзя */
  const [currentPassword, setCurrentPassword] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
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
  const [artistNotFound, setArtistNotFound] = useState(false)
  /** Удаление переехало сюда с карточки в списке: там оно срабатывало по наведению. */
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Новые поля для артиста
  const [fio, setFio] = useState("")
  const [fioShort, setFioShort] = useState("")
  const [contract, setContract] = useState("")
  const [percentage, setPercentage] = useState("")
  
  // Состояния для управления контентом
  const [releases, setReleases] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  
  // Состояния для добавления нового релиза
  const [newRelease, setNewRelease] = useState({
    title: "",
    artist: "",
    releaseDate: "",
    status: "draft"
  })

  // Загрузка данных артиста
  useEffect(() => {
    const fetchArtist = async () => {
      try {
        const response = await fetch(
          `/api/artists?id=${encodeURIComponent(artistId)}`
        )
        const result = await response.json()
        
        if (result.success) {
          const artist = result.artists?.[0]
          
          if (artist) {
            setUsername(artist.username)
            // J1: null, если пароль ещё в старом bcrypt-хеше
            setCurrentPassword(artist.password ?? null)
            setName(artist.name)
            setEmail(artist.email || "")
            setVkMusicUrl(artist.vkMusicUrl || "")
            setYandexMusicUrl(artist.yandexMusicUrl || "")
            setSpotifyUrl(artist.spotifyUrl || "")
            setAvatarPreview(artist.avatarUrl || null)
            
            // Новые поля
            setFio(artist.fio || "")
            setFioShort(artist.fioShort || "")
            setContract(artist.contract || "")
            setPercentage(artist.percentage?.toString() || "")
          } else {
            setArtistNotFound(true)
          }
        } else {
          setArtistNotFound(true)
        }
      } catch (error) {
        console.error('Ошибка при загрузке артиста:', error)
        setArtistNotFound(true)
      }
    }

    fetchArtist()
  }, [artistId])

  // Функция загрузки отчётов для артиста
  const fetchReports = async () => {
    setIsLoadingReports(true)
    try {
      console.log(`🔍 Загружаем отчёты для артиста ${artistId}`)
      
      // Загружаем все кварталы
      const quartersResponse = await fetch('/api/reports/quarters')
      const quartersData = await quartersResponse.json()
      
      if (quartersData.quarters && quartersData.quarters.length > 0) {
        const artistReports: any[] = []
        
        // Загружаем отчёты для каждого квартала
        for (const quarter of quartersData.quarters) {
          const reportsResponse = await fetch(`/api/reports/list/${quarter}`)
          const reportsData = await reportsResponse.json()
          
          if (reportsData.reports) {
            // Фильтруем отчёты для текущего артиста
            const quarterReports = reportsData.reports.filter((report: any) => 
              report.artistId === artistId
            )
            artistReports.push(...quarterReports)
          }
        }
        
        console.log(`✅ Найдено ${artistReports.length} отчётов для артиста`)
        setReports(artistReports)
      }
    } catch (error) {
      console.error('Ошибка при загрузке отчётов:', error)
    } finally {
      setIsLoadingReports(false)
    }
  }

  // Загружаем отчёты при монтировании компонента
  useEffect(() => {
    if (artistId) {
      fetchReports()
    }
  }, [artistId])

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
    setSuccess(false)
    setIsSubmitting(true)

    // Валидация формы
    if (!username || !name) {
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
      // F-UI-10: новый файл — грузим в Storage (короткий URL); иначе оставляем
      // текущий URL. base64 в avatarUrl не проходил (max 2000).
      let finalAvatarUrl =
        avatarPreview && !avatarPreview.startsWith("data:") ? avatarPreview : undefined
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
        finalAvatarUrl = upJson.url
      }

      // Обновляем артиста через API
      const response = await fetch('/api/artists', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: artistId,
          username,
          password: password || undefined, // Отправляем пароль только если он был изменен
          name,
          email: email || undefined,
          vkMusicUrl: vkMusicUrl || undefined,
          yandexMusicUrl: yandexMusicUrl || undefined,
          spotifyUrl: spotifyUrl || undefined,
          avatarUrl: finalAvatarUrl,
          // Новые поля
          fio: fio || undefined,
          fioShort: fioShort || undefined,
          contract: contract || undefined,
          percentage: percentage ? parseInt(percentage) : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Произошла ошибка при обновлении артиста")
        setIsSubmitting(false)
        return
      }

      // Показываем сообщение об успехе
      setSuccess(true)

      // Сбрасываем пароль
      setPassword("")
    } catch (err) {
      setError("Произошла ошибка при обновлении артиста")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteArtist = async () => {
    setIsDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/artists?id=${encodeURIComponent(artistId)}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (result.success) {
        router.push("/dashboard/admin/artists")
        return
      }
      setError(result.error || "Не удалось удалить артиста")
      setDeleteOpen(false)
    } catch {
      setError("Произошла ошибка при удалении артиста")
      setDeleteOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  if (artistNotFound) {
    return (
      <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>arrow_back</span>
              <span>Назад к списку артистов</span>
            </Link>
          </div>

          <Banner variant="danger">Артист не найден</Banner>
        </div>
      )
  }

  return (
    
      <div className="space-y-8">
        <PageHeader
          rowClassName="sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:items-center"
          backHref="/dashboard/admin/artists"
          title="Редактирование"
          subtitle={name}
          actions={
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>person</span>
            </div>
          }
        />

        {error && <Banner variant="danger">{error}</Banner>}

        {success && <Banner variant="success">Данные артиста успешно обновлены!</Banner>}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 h-auto gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <TabsTrigger
              value="profile"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400"
            >
              <span className="material-symbols-outlined text-lg sm:text-base flex-shrink-0">settings</span>
              <span className="hidden sm:inline text-xs font-mono uppercase">Профиль</span>
            </TabsTrigger>
            <TabsTrigger
              value="releases"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400"
            >
              <span className="material-symbols-outlined text-lg sm:text-base flex-shrink-0">library_music</span>
              <span className="hidden sm:inline text-xs font-mono uppercase">Релизы</span>
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400"
            >
              <span className="material-symbols-outlined text-lg sm:text-base flex-shrink-0">description</span>
              <span className="hidden sm:inline text-xs font-mono uppercase">Отчёты</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400"
            >
              <span className="material-symbols-outlined text-lg sm:text-base flex-shrink-0">payments</span>
              <span className="hidden sm:inline text-xs font-mono uppercase">Выплаты</span>
            </TabsTrigger>
          </TabsList>

          {/* Вкладка Профиль */}
          <TabsContent value="profile" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <SectionHeader className="mb-6" size="sm" title="Информация об артисте" />
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
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите логин"
                    />
                    <p className="text-xs text-muted-foreground">Логин для входа в систему</p>
                  </div>

                  {/* J1: пароль артиста доступен админу — чтобы можно было зайти в его профиль */}
                  <div className="space-y-2">
                    <Label className="text-white">Текущий пароль</Label>
                    {currentPassword !== null ? (
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-white"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setShowCurrentPassword((v) => !v)}
                          className="h-11 w-auto shrink-0 rounded-lg border-white/10 bg-transparent px-3 text-gray-400 hover:bg-transparent hover:text-white"
                          title={showCurrentPassword ? "Скрыть пароль" : "Показать пароль"}
                          aria-label={showCurrentPassword ? "Скрыть пароль" : "Показать пароль"}
                        >
                          <span className="material-symbols-outlined text-lg leading-none" aria-hidden>
                            {showCurrentPassword ? "visibility_off" : "visibility"}
                          </span>
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400">
                        Пароль этого артиста сохранён по старой схеме (зашифрован) и показать его
                        нельзя. Задайте новый пароль ниже — после этого он будет виден здесь.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">
                      Новый пароль
                    </Label>
                    <Input
                      id="password"
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Оставьте пустым, чтобы не менять"
                    />
                    <p className="text-xs text-muted-foreground">Оставьте пустым, если не хотите менять пароль</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">
                      Имя артиста <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите email"
                    />
                    <p className="text-xs text-muted-foreground">Необязательно</p>
                  </div>

                  {/* Новые поля для артиста */}
                  <div className="space-y-2">
                    <Label htmlFor="fio" className="text-white">
                      Полное ФИО
                    </Label>
                    <Input
                      id="fio"
                      type="text"
                      value={fio}
                      onChange={(e) => setFio(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите полное ФИО"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fioShort" className="text-white">
                      ФИО кратко
                    </Label>
                    <Input
                      id="fioShort"
                      type="text"
                      value={fioShort}
                      onChange={(e) => setFioShort(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите ФИО кратко (И. О.)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract" className="text-white">
                      Номер договора
                    </Label>
                    <Input
                      id="contract"
                      type="text"
                      value={contract}
                      onChange={(e) => setContract(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите номер договора"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="percentage" className="text-white">
                      Процент
                    </Label>
                    <Input
                      id="percentage"
                      type="number"
                      min="0"
                      max="100"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Введите процент (0-100)"
                    />
                  </div>

                  {/* Добавляем новые поля для ссылок на музыкальные сервисы */}
                  <div className="space-y-2">
                    <Label htmlFor="vkMusicUrl" className="text-white flex items-center gap-1">
                      <img src={PLATFORM_ICONS.vk} alt="VK Music" className="h-4 w-4" />
                      ВК Музыка
                    </Label>
                    <div className="relative">
                      <Input
                        id="vkMusicUrl"
                        type="url"
                        value={vkMusicUrl}
                        onChange={(e) => setVkMusicUrl(e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="https://vk.com/music/artist/..."
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">link</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в ВК Музыке</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yandexMusicUrl" className="text-white flex items-center gap-1">
                      <img src={PLATFORM_ICONS.yandex} alt="Yandex Music" className="h-4 w-4" />
                      Яндекс Музыка
                    </Label>
                    <div className="relative">
                      <Input
                        id="yandexMusicUrl"
                        type="url"
                        value={yandexMusicUrl}
                        onChange={(e) => setYandexMusicUrl(e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="https://music.yandex.ru/artist/..."
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">link</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в Яндекс Музыке</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spotifyUrl" className="text-white flex items-center gap-1">
                      <img src={PLATFORM_ICONS.spotify} alt="Spotify" className="h-4 w-4" />
                      Spotify
                    </Label>
                    <div className="relative">
                      <Input
                        id="spotifyUrl"
                        type="url"
                        value={spotifyUrl}
                        onChange={(e) => setSpotifyUrl(e.target.value)}
                        className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="https://open.spotify.com/artist/..."
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">link</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в Spotify</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avatar" className="text-white">
                      Аватар
                    </Label>
                    <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-xl bg-white/[0.02] hover:border-primary/30 motion-safe:transition-colors">
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
                        <div className="w-32 h-32 mb-4 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 motion-safe:transition-colors flex items-center justify-center">
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
                      <p className="text-xs text-muted-foreground mt-2">Рекомендуемый размер: 256x256 пикселей</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 motion-safe:transition-colors">
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
                  className="rounded-lg border-white/20 text-gray-300 hover:bg-white/5 hover:text-white"
                  disabled={isSubmitting}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
                </Button>
              </div>
            </form>
            </div>

            <ArtistLinkedProfiles artistId={artistId} artistName={name || username} />
          </TabsContent>

          {/* Вкладка Релизы */}
          <TabsContent value="releases" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <SectionHeader className="mb-6" size="sm" title="Управление релизами" />
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-gray-400 text-sm">Здесь вы можете управлять релизами артиста</p>
                    <Button className="bg-primary text-black hover:bg-primary/90 rounded-lg font-semibold inline-flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">add</span>
                      Добавить релиз
                    </Button>
                  </div>
                  
                  <EmptyState
                    className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8"
                    icon="library_music"
                    title="Нет релизов"
                    description="У этого артиста пока нет добавленных релизов"
                    action={
                      <Button variant="outline" className="rounded-lg border-primary/40 text-primary hover:bg-primary/10">
                        Создать первый релиз
                      </Button>
                    }
                  />
                </div>
            </div>
          </TabsContent>

          {/* Вкладка Отчёты */}
          <TabsContent value="reports" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <SectionHeader className="mb-6" size="sm" title="Отчёты и аналитика" />
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-gray-400 text-sm">Отчёты по прослушиваниям и доходам ({reports.length})</p>
                    <Button 
                      onClick={fetchReports}
                      disabled={isLoadingReports}
                      className="bg-primary text-black hover:bg-primary/90 rounded-lg font-semibold inline-flex items-center gap-2"
                    >
                      {isLoadingReports ? (
                        <>
                          <Spinner size="sm" className="[&>span]:border-black/30 [&>span]:border-t-black" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">refresh</span>
                          Обновить отчёты
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {isLoadingReports ? (
                    <div className="p-8 text-center">
                      <Spinner label="Загрузка отчётов..." />
                    </div>
                  ) : reports.length > 0 ? (
                    <div className="space-y-3">
                      {reports.map((report: any) => (
                        <div key={report.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] motion-safe:transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                            <div className="min-w-0">
                              <h4 className="font-medium text-white font-mono text-sm">{report.quarter} {report.year}</h4>
                              <p className="text-sm text-gray-500 truncate">{report.fileName}</p>
                            </div>
                            <div className="text-left sm:text-right shrink-0 [font-variant-numeric:tabular-nums]">
                              <p className="text-lg font-display font-semibold text-primary">
                                {report.totalAmount?.toLocaleString('ru-RU')} ₽
                              </p>
                              {/* C7: у коллабов прослушивания начисляются полностью КАЖДОМУ участнику,
                                  поэтому суммировать это число по артистам нельзя. */}
                              <p
                                className="text-sm text-gray-400"
                                title="Прослушивания по этому отчёту. У совместных треков одно и то же число учитывается у каждого участника — складывать по разным артистам нельзя."
                              >
                                {report.totalPlays?.toLocaleString('ru-RU')} прослушиваний
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono uppercase text-gray-500">
                            <div className="flex items-center gap-2">
                              <div className={`size-2 rounded-full ${report.isAcknowledged ? 'bg-primary' : 'bg-gray-600'}`} aria-hidden />
                              <span className="text-gray-400 normal-case">
                                {report.isAcknowledged ? 'Ознакомлен' : 'Не ознакомлен'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`size-2 rounded-full ${report.isSigned ? 'bg-primary' : 'bg-gray-600'}`} aria-hidden />
                              <span className="text-gray-400 normal-case">
                                {report.isSigned ? 'Подписан' : 'Не подписан'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`size-2 rounded-full ${report.isPaid ? 'bg-primary' : 'bg-gray-600'}`} aria-hidden />
                              <span className="text-gray-400 normal-case">
                                {report.isPaid ? 'Выплачен' : 'Не выплачен'}
                              </span>
                            </div>
                            <div className="ml-auto [font-variant-numeric:tabular-nums]">
                              {formatDateRu(report.uploadDate)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8"
                      icon="description"
                      title="Нет отчётов"
                      description="У этого артиста пока нет загруженных отчётов"
                      action={
                        <Button
                          variant="outline"
                          className="rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => window.open('/admin/reports', '_blank')}
                        >
                          Перейти к загрузке отчётов
                        </Button>
                      }
                    />
                  )}
                </div>
            </div>
          </TabsContent>

          {/* Вкладка Выплаты */}
          <TabsContent value="payments" className="space-y-4">
            <ArtistAdvances artistId={artistId} />
          </TabsContent>
        </Tabs>

        <div className="mt-8 rounded-xl border border-red-500/25 bg-red-500/[0.04] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold uppercase tracking-wide text-red-200">
                Удаление артиста
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Профиль «{name || username}» будет удалён безвозвратно вместе с доступом в кабинет.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 border-red-500/50 text-red-300 hover:bg-red-500/15 hover:text-red-200"
            >
              <span className="material-symbols-outlined mr-1 text-base">delete</span>
              Удалить артиста
            </Button>
          </div>
        </div>

        <Dialog open={deleteOpen} onOpenChange={(open) => !isDeleting && setDeleteOpen(open)}>
          <DialogContent className="max-w-md border border-white/10 text-white sm:rounded-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Удалить артиста?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-400">
              Артист «{name || username}» будет удалён безвозвратно. Это действие нельзя отменить.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setDeleteOpen(false)}
                className="border-white/15 text-gray-300 hover:bg-white/5"
              >
                Отмена
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteArtist}
                variant="destructive"
              >
                {isDeleting ? "Удаление…" : "Удалить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DashboardFooter />
      </div>
    )
}
