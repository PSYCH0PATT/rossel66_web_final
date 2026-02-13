"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Music, FileText, DollarSign, ListMusic, TrendingUp } from "lucide-react"
import Link from "next/link"
import { ActivityFeed } from "@/components/activity-feed"
import {
  getArtistReleases,
  getArtistPayments,
  getTotalEarnings,
} from "@/lib/data"

export default function ArtistDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [playlistCount, setPlaylistCount] = useState<number>(0)
  const [reports, setReports] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
        if (user.role === "artist") {
          // router.push(`/artist/${user.username}/dashboard`)
        } else {
          router.push("/dashboard/admin/dashboard")
        }
      } catch (error) {
        router.push("/dashboard/login")
      }
    } else {
      router.push("/dashboard/login")
    }
  }, [router])

  useEffect(() => {
    if (!currentUser?.id) return
    let cancelled = false
    
    const loadData = async () => {
      try {
        // Загружаем плейлисты
        const playlistsRes = await fetch(`/api/playlists/sftp?artistId=${encodeURIComponent(currentUser.id)}`)
        const playlistsData = await playlistsRes.json()
        if (!cancelled && playlistsData.success && Array.isArray(playlistsData.results)) {
          setPlaylistCount(playlistsData.results.length)
        }

        // Загружаем отчёты через API
        const quartersRes = await fetch('/api/reports/quarters')
        const quartersData = await quartersRes.json()
        
        if (!cancelled && quartersData.quarters) {
          const allReports: any[] = []
          for (const quarter of quartersData.quarters) {
            const reportsRes = await fetch(`/api/reports/list/${quarter}`)
            const reportsData = await reportsRes.json()
            if (reportsData.reports) {
              const artistReports = reportsData.reports.filter(
                (report: any) => report.artistId === currentUser.id
              )
              allReports.push(...artistReports)
            }
          }
          if (!cancelled) {
            setReports(allReports)
          }
        }

        // Загружаем релизы через API
        const releasesRes = await fetch('/api/releases')
        const releasesData = await releasesRes.json()
        if (!cancelled && releasesData?.success && Array.isArray(releasesData.releases)) {
          const artistReleases = releasesData.releases.filter(
            (release: any) => release.artistId === currentUser.id
          )
          setReleases(artistReleases)
        }

        setLoading(false)
      } catch (error) {
        console.error('Ошибка загрузки данных:', error)
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [currentUser?.id])

  const artistId = currentUser?.id || "1"
  const payments = getArtistPayments(artistId)
  const totalEarnings = getTotalEarnings(artistId)

  const releasedCount = releases.filter((r) => r.status === "released").length
  const pendingCount = releases.filter((r) => r.status !== "released").length
  const latestReport = reports.length > 0 
    ? reports.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0]
    : null
  const latestRelease = releases.length > 0
    ? [...releases].sort((a, b) => new Date(b.createdAt || b.releaseDate).getTime() - new Date(a.createdAt || a.releaseDate).getTime())[0]
    : null

  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Главная</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border border-category-blue/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего релизов</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-blue/10">
                <Music className="h-4 w-4 text-category-blue" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{releases.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingCount > 0
                  ? `${releasedCount} выпущено, ${pendingCount} в процессе`
                  : latestRelease
                    ? `Последний: ${latestRelease.title}`
                    : 'Нет релизов'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-purple/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Отчеты</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-purple/10">
                <FileText className="h-4 w-4 text-category-purple" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reports.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {latestReport ? `Последний: ${latestReport.quarter} ${latestReport.year}` : "Нет отчетов"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-amber/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Заработок</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-amber/10">
                <DollarSign className="h-4 w-4 text-category-amber" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEarnings.toLocaleString()} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">За все время</p>
            </CardContent>
          </Card>

          <Card className="bg-card border border-category-red/30 text-card-foreground rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Плейлисты</CardTitle>
              <div className="p-1.5 rounded-lg bg-category-red/10">
                <ListMusic className="h-4 w-4 text-category-red" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{playlistCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Промо-плейлисты</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card border-border text-card-foreground rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Последняя активность</CardTitle>
          </CardHeader>
          <CardContent>
            {currentUser && <ActivityFeed userId={currentUser.id} role="artist" limit={5} />}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/artist/releases"
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors"
              >
                <Music className="h-4 w-4 text-category-blue" />
                <span>Все релизы</span>
              </Link>

              <Link
                href="/dashboard/artist/payments"
                className="flex items-center justify-center gap-2 p-2 text-sm bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors"
              >
                <TrendingUp className="h-4 w-4 text-category-amber" />
                <span>Статистика</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
