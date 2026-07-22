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

export default function EditArtistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const artistId = params.id

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
  const [artistNotFound, setArtistNotFound] = useState(false)
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

  // Функция загрузки отчетов для артиста
  const fetchReports = async () => {
    setIsLoadingReports(true)
    try {
      console.log(`🔍 Загружаем отчеты для артиста ${artistId}`)
      
      // Загружаем все кварталы
      const quartersResponse = await fetch('/api/reports/quarters')
      const quartersData = await quartersResponse.json()
      
      if (quartersData.quarters && quartersData.quarters.length > 0) {
        const artistReports: any[] = []
        
        // Загружаем отчеты для каждого квартала
        for (const quarter of quartersData.quarters) {
          const reportsResponse = await fetch(`/api/reports/list/${quarter}`)
          const reportsData = await reportsResponse.json()
          
          if (reportsData.reports) {
            // Фильтруем отчеты для текущего артиста
            const quarterReports = reportsData.reports.filter((report: any) => 
              report.artistId === artistId
            )
            artistReports.push(...quarterReports)
          }
        }
        
        console.log(`✅ Найдено ${artistReports.length} отчетов для артиста`)
        setReports(artistReports)
      }
    } catch (error) {
      console.error('Ошибка при загрузке отчетов:', error)
    } finally {
      setIsLoadingReports(false)
    }
  }

  // Загружаем отчеты при монтировании компонента
  useEffect(() => {
    if (artistId) {
      fetchReports()
    }
  }, [artistId])

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
          avatarUrl: avatarPreview || undefined,
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

  if (artistNotFound) {
    return (
      <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Назад к списку артистов</span>
            </Link>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2" role="alert">
            <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
            Артист не найден
          </div>
        </div>
      )
  }

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary cursor-pointer transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/artists" className="hover:text-primary cursor-pointer transition-colors">
              Артисты
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white truncate max-w-[180px]">{name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-8">
            <div className="min-w-0">
              <Link
                href="/dashboard/admin/artists"
                className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest mb-3"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                К списку
              </Link>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">
                Редактирование
              </h1>
              <p className="text-sm text-gray-400 font-light mt-2">{name}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">person</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2" role="alert">
            <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-start gap-2" role="status">
            <span className="material-symbols-outlined text-emerald-400 flex-shrink-0">check_circle</span>
            Данные артиста успешно обновлены!
          </div>
        )}

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
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                Информация об артисте
              </h2>
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

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">
                      Новый пароль
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      <img src="https://cdn.simpleicons.org/vk/0077FF" alt="VK Music" className="h-4 w-4" />
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
                      <img src="https://cdn.simpleicons.org/yandexmusic/FFCC00" alt="Yandex Music" className="h-4 w-4" />
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
                      <img src="/spotify-logo.png" alt="Spotify" className="h-4 w-4" />
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
                      <label
                        htmlFor="avatar-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-lg">upload</span>
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
          </TabsContent>

          {/* Вкладка Релизы */}
          <TabsContent value="releases" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                Управление релизами
              </h2>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-gray-400 text-sm">Здесь вы можете управлять релизами артиста</p>
                    <Button className="bg-primary text-black hover:bg-primary/90 rounded-lg font-semibold inline-flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">add</span>
                      Добавить релиз
                    </Button>
                  </div>
                  
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                    <span className="material-symbols-outlined text-5xl text-gray-500 mx-auto mb-4 block">library_music</span>
                    <h3 className="text-lg font-medium text-white mb-2">Нет релизов</h3>
                    <p className="text-gray-400 mb-4 text-sm">У этого артиста пока нет добавленных релизов</p>
                    <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-lg">
                      Создать первый релиз
                    </Button>
                  </div>
                </div>
            </div>
          </TabsContent>

          {/* Вкладка Отчеты */}
          <TabsContent value="reports" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                Отчёты и аналитика
              </h2>
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
                          <span className="inline-block size-4 border-2 border-black/30 border-t-black rounded-full motion-safe:animate-spin" aria-hidden />
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
                      <span className="inline-block size-8 border-2 border-primary/30 border-t-primary rounded-full motion-safe:animate-spin mx-auto mb-4" aria-hidden />
                      <p className="text-gray-400 text-sm">Загрузка отчётов...</p>
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
                              <p className="text-sm text-gray-400">
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
                    <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                      <span className="material-symbols-outlined text-5xl text-gray-500 mx-auto mb-4 block">description</span>
                      <h3 className="text-lg font-medium text-white mb-2">Нет отчётов</h3>
                      <p className="text-gray-400 mb-4 text-sm">У этого артиста пока нет загруженных отчётов</p>
                      <Button 
                        variant="outline" 
                        className="border-primary/40 text-primary hover:bg-primary/10 rounded-lg"
                        onClick={() => window.open('/admin/reports', '_blank')}
                      >
                        Перейти к загрузке отчётов
                      </Button>
                    </div>
                  )}
                </div>
            </div>
          </TabsContent>

          {/* Вкладка Выплаты */}
          <TabsContent value="payments" className="space-y-4">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                История выплат
              </h2>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-gray-400 text-sm">Управление выплатами и финансами</p>
                    <Button className="bg-primary text-black hover:bg-primary/90 rounded-lg font-semibold inline-flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">add</span>
                      Добавить выплату
                    </Button>
                  </div>
                  
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                    <span className="material-symbols-outlined text-5xl text-gray-500 mx-auto mb-4 block">payments</span>
                    <h3 className="text-lg font-medium text-white mb-2">Нет выплат</h3>
                    <p className="text-gray-400 mb-4 text-sm">История выплат артисту будет отображаться здесь</p>
                    <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-lg">
                      Создать выплату
                    </Button>
                  </div>
                </div>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>
    )
}
