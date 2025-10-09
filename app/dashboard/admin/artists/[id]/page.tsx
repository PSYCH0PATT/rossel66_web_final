"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Upload, Check, AlertCircle, ArrowLeft, Eye, EyeOff, Music, LinkIcon, Settings, FileText, DollarSign, Plus, Edit, Trash } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import Link from "next/link"

export default function EditArtistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const artistId = params.id

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
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
  const [showPassword, setShowPassword] = useState(false)
  
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
        const response = await fetch('/api/artists')
        const result = await response.json()
        
        if (result.success) {
          const artist = result.artists.find((a: any) => a.id === artistId)
          
          if (artist) {
            setUsername(artist.username)
            setName(artist.name)
            setEmail(artist.email || "")
            setVkMusicUrl(artist.vkMusicUrl || "")
            setYandexMusicUrl(artist.yandexMusicUrl || "")
            setSpotifyUrl(artist.spotifyUrl || "")
            setAvatarPreview(artist.avatarUrl || null)
            setCurrentPassword(artist.password)
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

      // Если пароль был изменен, обновляем текущий пароль
      if (password) {
        setCurrentPassword(password)
      }

      // Сбрасываем пароль
      setPassword("")
    } catch (err) {
      setError("Произошла ошибка при обновлении артиста")
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  if (artistNotFound) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад к списку артистов</span>
            </Link>
          </div>

          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Артист не найден</AlertDescription>
          </Alert>
        </div>
      </Layout>
    )
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
            <h1 className="text-2xl font-bold text-white">Редактирование: {name}</h1>
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
            <AlertDescription>Данные артиста успешно обновлены!</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Профиль</span>
            </TabsTrigger>
            <TabsTrigger value="releases" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span>Релизы</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Отчеты</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>Выплаты</span>
            </TabsTrigger>
          </TabsList>

          {/* Вкладка Профиль */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-transparent border-slate-600/30 text-white rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-emerald-400" />
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
                      Новый пароль
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-transparent border border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
                      placeholder="Оставьте пустым, чтобы не менять"
                    />
                    <p className="text-xs text-muted-foreground">Оставьте пустым, если не хотите менять пароль</p>
                    <div className="mt-2 p-2 bg-emerald/10 border border-emerald/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-emerald flex items-center">
                          <Check className="h-3 w-3 mr-1" /> Текущий пароль:
                          <span className="font-mono ml-1">{showPassword ? currentPassword : "••••••••"}</span>
                        </p>
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="text-emerald hover:text-emerald/80"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
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

                  {/* Добавляем новые поля для ссылок на музыкальные сервисы */}
                  <div className="space-y-2">
                    <Label htmlFor="vkMusicUrl" className="text-white flex items-center gap-1">
                      <img src="/vk-music-logo.svg" alt="VK Music" className="h-4 w-4" />
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
                    <p className="text-xs text-muted-foreground">Ссылка на профиль артиста в ВК Музыке</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yandexMusicUrl" className="text-white flex items-center gap-1">
                      <img src="/yandex-music-logo.svg" alt="Yandex Music" className="h-4 w-4" />
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
                        className="bg-accent/50 border-gray-700 text-white pl-9"
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
                  {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
                </Button>
              </div>
            </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Вкладка Релизы */}
          <TabsContent value="releases" className="space-y-4">
            <Card className="bg-transparent border-slate-600/30 text-white rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-purple-400" />
                  Управление релизами
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Здесь вы можете управлять релизами артиста</p>
                    <Button className="bg-purple-500 hover:bg-purple-600 text-white border-2 border-transparent hover:border-purple-300 transition-all duration-200">
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить релиз
                    </Button>
                  </div>
                  
                  <div className="p-8 text-center border-2 border-dashed border-slate-600/30 rounded-xl bg-transparent">
                    <Music className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Нет релизов</h3>
                    <p className="text-slate-400 mb-4">У этого артиста пока нет добавленных релизов</p>
                    <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                      Создать первый релиз
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Вкладка Отчеты */}
          <TabsContent value="reports" className="space-y-4">
            <Card className="bg-transparent border-slate-600/30 text-white rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-400" />
                  Отчеты и аналитика
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Отчеты по прослушиваниям и доходам ({reports.length})</p>
                    <Button 
                      onClick={fetchReports}
                      disabled={isLoadingReports}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-transparent hover:border-emerald-300 transition-all duration-200"
                    >
                      {isLoadingReports ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Обновить отчеты
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {isLoadingReports ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-4"></div>
                      <p className="text-slate-400">Загрузка отчетов...</p>
                    </div>
                  ) : reports.length > 0 ? (
                    <div className="space-y-3">
                      {reports.map((report: any) => (
                        <div key={report.id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{report.quarter} {report.year}</h4>
                              <p className="text-sm text-slate-400">{report.fileName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-emerald-400">
                                {report.totalAmount?.toLocaleString('ru-RU')} ₽
                              </p>
                              <p className="text-sm text-slate-400">
                                {report.totalPlays?.toLocaleString('ru-RU')} прослушиваний
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${report.isSigned ? 'bg-emerald-400' : 'bg-slate-500'}`}></div>
                              <span className="text-sm text-slate-400">
                                {report.isSigned ? 'Подписан' : 'Не подписан'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${report.isPaid ? 'bg-emerald-400' : 'bg-slate-500'}`}></div>
                              <span className="text-sm text-slate-400">
                                {report.isPaid ? 'Выплачен' : 'Не выплачен'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 ml-auto">
                              {new Date(report.uploadDate).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-600/30 rounded-xl bg-transparent">
                      <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">Нет отчетов</h3>
                      <p className="text-slate-400 mb-4">У этого артиста пока нет загруженных отчетов</p>
                      <Button 
                        variant="outline" 
                        className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                        onClick={() => window.open('/admin/reports', '_blank')}
                      >
                        Перейти к загрузке отчетов
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Вкладка Выплаты */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="bg-transparent border-slate-600/30 text-white rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  История выплат
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">Управление выплатами и финансами</p>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-transparent hover:border-emerald-300 transition-all duration-200">
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить выплату
                    </Button>
                  </div>
                  
                  <div className="p-8 text-center border-2 border-dashed border-slate-600/30 rounded-xl bg-transparent">
                    <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Нет выплат</h3>
                    <p className="text-slate-400 mb-4">История выплат артисту будет отображаться здесь</p>
                    <Button variant="outline" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20">
                      Создать выплату
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
