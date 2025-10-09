"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Music, FileText, DollarSign, ListMusic, TrendingUp, Settings, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { users as staticUsers } from "@/lib/data"
import { ActivityFeed } from "@/components/activity-feed"

export default function ArtistDashboard({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchArtistData = async () => {
    try {
      console.log('Загружаем данные артиста...')
      // Получаем всех пользователей через API
      const usersResponse = await fetch('/api/users')
      const usersResult = await usersResponse.json()
      
      if (usersResult.success) {
        const foundArtist = usersResult.users.find(
          (a: any) => a.username === params.username && a.role === "artist"
        )
        
        if (foundArtist) {
          setArtist(foundArtist)
          
          // Формируем набор допустимых идентификаторов для этого артиста (на случай старых данных)
          const validArtistIds = new Set<string>()
          validArtistIds.add(foundArtist.id)

          // Из localStorage (динамически добавленные пользователи ранее)
          try {
            const raw = localStorage.getItem('dynamicUsers')
            if (raw) {
              const dyn = JSON.parse(raw)
              const dynUser = Array.isArray(dyn) ? dyn.find((u: any) => u.username === params.username && u.role === 'artist') : null
              if (dynUser?.id) validArtistIds.add(String(dynUser.id))
            }
          } catch {}

          // Из статичных данных (на случай старых id вида "artist...")
          try {
            const sUser = staticUsers.find((u: any) => u.username === params.username && u.role === 'artist')
            if (sUser?.id) validArtistIds.add(String(sUser.id))
          } catch {}
          
          // Получаем отчеты для этого артиста
          const reportsResponse = await fetch('/api/reports/quarters')
          const quartersResult = await reportsResponse.json()
          
          if (quartersResult.quarters) {
            const allReports: any[] = []
            
            for (const quarter of quartersResult.quarters) {
              const quarterReportsResponse = await fetch(`/api/reports/list/${quarter}`)
              const quarterReportsResult = await quarterReportsResponse.json()
              
              if (quarterReportsResult.reports) {
                // Фильтруем отчеты для этого артиста
                const artistReports = quarterReportsResult.reports.filter(
                  (report: any) => report.artistId === foundArtist.id
                )
                allReports.push(...artistReports)
              }
            }
            
            console.log('Загружено отчетов для артиста:', allReports.length)
            console.log('Статусы отчетов:', allReports.map(r => ({ id: r.id, isSigned: r.isSigned, isPaid: r.isPaid })))
            setReports(allReports)
          }
          
          // Загружаем релизы для этого артиста из базы данных
          const releasesResponse = await fetch('/api/releases')
          const releasesResult = await releasesResponse.json()
          
          console.log('Ответ API релизов:', releasesResult)
          console.log('ID найденного артиста:', foundArtist.id)
          
          if (releasesResult?.success && Array.isArray(releasesResult.releases)) {
            console.log('Все релизы из API:', releasesResult.releases)
            const artistReleases = releasesResult.releases.filter((release: any) => {
              // Совпадение по одному из известных id
              if (validArtistIds.has(String(release.artistId))) return true
              // Дополнительные варианты преобразования префиксов
              const alt1 = String(release.artistId).replace('artist', 'user_')
              const alt2 = String(release.artistId).replace('user_', 'artist')
              if (validArtistIds.has(alt1) || validArtistIds.has(alt2)) return true
              // Фиты на уровне треков
              if (Array.isArray(release.tracks)) {
                for (const t of release.tracks) {
                  if (Array.isArray(t?.featuredArtistIds)) {
                    for (const id of t.featuredArtistIds) {
                      if (validArtistIds.has(String(id))) return true
                    }
                  }
                }
              }
              return false
            })
            console.log('Отфильтрованные релизы для артиста:', artistReleases)
            console.log('Количество найденных релизов:', artistReleases.length)
            setReleases(artistReleases)
          } else {
            console.log('Релизы не загружены или неправильный формат ответа')
            setReleases([])
          }
          
          // Загружаем плейлисты
          try {
            const [vkResponse, bandlinkResponse] = await Promise.all([
              fetch('/api/parsers/vk'),
              fetch('/api/parsers/bandlink')
            ])
            
            const [vkData, bandlinkData] = await Promise.all([
              vkResponse.json(),
              bandlinkResponse.json()
            ])
            
            const allPlaylists = []
            
            // Фильтруем VK плейлисты по имени артиста
            if (vkData.results && Array.isArray(vkData.results)) {
              const vkPlaylists = vkData.results.filter((p: any) => p.artist_name === foundArtist.name)
              allPlaylists.push(...vkPlaylists)
            }
            
            // Фильтруем Bandlink плейлисты по имени артиста
            if (bandlinkData.results && Array.isArray(bandlinkData.results)) {
              const bandlinkPlaylists = bandlinkData.results.filter((p: any) => p.artist_name === foundArtist.name)
              allPlaylists.push(...bandlinkPlaylists)
            }
            
            setPlaylists(allPlaylists)
            console.log('Загружено плейлистов для артиста:', allPlaylists.length)
          } catch (error) {
            console.error('Ошибка загрузки плейлистов:', error)
            setPlaylists([])
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных артиста:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArtistData()
    
    // Обновляем данные каждые 30 секунд
    const interval = setInterval(() => {
      fetchArtistData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [params.username])

  // Если артист не найден
  if (!loading && !artist) {
    notFound()
  }

  // Если еще загружается
  if (loading || !artist) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  // Временные данные (пока нет API для платежей)
  const payments: any[] = []
  const totalEarnings = reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0)

  console.log('Текущее состояние releases:', releases)
  console.log('Длина массива releases:', releases.length)
  
  const releasedCount = releases.filter((r) => r.status === "released").length
  const pendingCount = releases.filter((r) => r.status !== "released").length
  
  console.log('Количество выпущенных релизов:', releasedCount)
  console.log('Количество релизов в процессе:', pendingCount)
  const latestReport =
    reports.length > 0
      ? reports.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0]
      : null

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Главная</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border border-category-blue/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium whitespace-nowrap flex-shrink-0">Всего релизов</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-blue/10 flex-shrink-0">
                <Music className="h-4 w-4 text-category-blue flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{releases.length}</div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                {releasedCount} выпущено, {pendingCount} в процессе
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-purple/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium whitespace-nowrap flex-shrink-0">Отчеты</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-purple/10 flex-shrink-0">
                <FileText className="h-4 w-4 text-category-purple flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reports.length}</div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                {latestReport ? `Последний: ${latestReport.quarter} ${latestReport.year}` : "Нет отчетов"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-amber/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium whitespace-nowrap flex-shrink-0">Заработок</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-amber/10 flex-shrink-0">
                <DollarSign className="h-4 w-4 text-category-amber flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold whitespace-nowrap">{Math.round(totalEarnings).toLocaleString()} ₽</div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">За все время</p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-red/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium whitespace-nowrap flex-shrink-0">Плейлисты</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-red/10 flex-shrink-0">
                <ListMusic className="h-4 w-4 text-category-red flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{playlists.length}</div>
              <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">Промо-плейлисты</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card border-border text-card-foreground rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Последняя активность</CardTitle>
          </CardHeader>
          <CardContent>
            {artist && <ActivityFeed userId={artist.id} role="artist" limit={5} />}

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Link
                href={`/artist/${params.username}/releases`}
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors"
              >
                <Music className="h-4 w-4 text-category-blue" />
                <span>Релизы</span>
              </Link>

              <Link
                href={`/artist/${params.username}/reports`}
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors"
              >
                <FileText className="h-4 w-4 text-green-400" />
                <span>Отчеты</span>
              </Link>

              <Link
                href={`/artist/${params.username}/payments`}
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors"
              >
                <TrendingUp className="h-4 w-4 text-category-amber" />
                <span>Выплаты</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {!artist && (
          <Card className="bg-card border-border text-card-foreground rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Добро пожаловать в личный кабинет</h2>
            <p className="text-muted-foreground mb-4">
              Здесь будет отображаться информация о ваших релизах, отчетах, выплатах и плейлистах.
            </p>
            <div className="flex justify-center">
              <Link
                href={`/artist/${params.username}/settings`}
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors px-4"
              >
                <Settings className="h-4 w-4" />
                <span>Настройки профиля</span>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}
