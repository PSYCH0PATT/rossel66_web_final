"use client"

import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Music, FileText, DollarSign, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityFeed } from "@/components/activity-feed"

interface Release {
  id: string
  artistId: string
  title: string
  coverUrl: string
  upc: string
  releaseDate: string
  status: 'released' | 'moderation' | 'delivery' | 'scheduled'
  tracks: any[]
  createdAt: string
}

interface Payment {
  id: string
  artistId: string
  artistName: string
  amount: number
  date: string
  isPaid: boolean
}

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
      setError(null)
      try {
        const [uRes, rlsRes, payRes, qRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/releases'),
          fetch('/api/payments'),
          fetch('/api/reports/quarters')
        ])

        const [uData, rlsData, payData, qData] = await Promise.all([
          uRes.json(), rlsRes.json(), payRes.json(), qRes.json()
        ])

        if (uData?.success) setUsers(uData.users ?? [])
        else if (uRes.ok === false) setError(prev => prev || 'Не удалось загрузить артистов. Обновите страницу.')

        if (rlsData?.success) setReleases(rlsData.releases ?? [])
        else if (rlsRes.ok === false) setError(prev => prev || 'Не удалось загрузить релизы. Обновите страницу.')

        if (payData?.success) setPayments(payData.payments ?? [])
        else if (payRes.ok === false) setError(prev => prev || 'Не удалось загрузить выплаты. Обновите страницу.')

        // Загружаем отчеты по кварталам, чтобы получить количество
        if (qData?.quarters?.length) {
          const allReports: any[] = []
          for (const q of qData.quarters) {
            const rq = await fetch(`/api/reports/list/${q}`)
            const rqData = await rq.json()
            if (rqData?.reports) allReports.push(...rqData.reports)
          }
          setReports(allReports)
        } else if (qRes.ok === false) {
          setError(prev => prev || 'Не удалось загрузить отчёты. Обновите страницу.')
        }
      } catch (e) {
        console.error('Ошибка загрузки данных для дашборда админа:', e)
        setError('Не удалось загрузить данные. Проверьте подключение и обновите страницу.')
      } finally {
        setIsLoading(false)
      }
    }, [])

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
      } catch (error) {
        console.error('Error parsing user:', error)
      }
    }
    load()
  }, [load])

  const metrics = useMemo(() => {
    const artistCount = users.filter(u => u.role === 'artist').length
    const releaseCount = releases.length
    const reportCount = reports.length
    const pendingReleases = releases.filter(r => r.status !== 'released').length
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const pendingPayments = payments.filter(p => !p.isPaid).length

    // Последние события
    const latestRelease = [...releases].sort((a,b) => new Date(b.createdAt || b.releaseDate).getTime() - new Date(a.createdAt || a.releaseDate).getTime())[0]
    const latestPayment = [...payments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    return { artistCount, releaseCount, reportCount, pendingReleases, totalPayments, pendingPayments, latestRelease, latestPayment }
  }, [users, releases, payments, reports])

  if (isLoading) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center py-12 text-slate-300">Загрузка...</div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Главная</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => { setIsLoading(true); load() }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Артисты</CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.artistCount}</div>
              <p className="text-xs text-slate-400 mt-1">Активных артистов</p>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Релизы</CardTitle>
              <Music className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.releaseCount}</div>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.pendingReleases > 0 
                  ? `${metrics.pendingReleases} ожидают обработки` 
                  : metrics.latestRelease 
                    ? `Последний: ${metrics.latestRelease.title}` 
                    : 'Нет релизов'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Отчеты</CardTitle>
              <FileText className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.reportCount}</div>
              <p className="text-xs text-slate-400 mt-1">Загружено отчетов</p>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Выплаты</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.totalPayments.toLocaleString()} ₽</div>
              <p className="text-xs text-slate-400 mt-1">{metrics.pendingPayments} ожидают обработки</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Последние действия</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed role="admin" limit={10} />

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/dashboard/admin/artists"
                className="flex items-center justify-center gap-2 p-3 text-sm bg-slate-800/50 hover:bg-slate-700/60 rounded-xl transition-colors flex-1 whitespace-nowrap"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Управление артистами</span>
              </Link>

              <Link
                href="/dashboard/admin/reports"
                className="flex items-center justify-center gap-2 p-3 text-sm bg-slate-800/50 hover:bg-slate-700/60 rounded-xl transition-colors flex-1 whitespace-nowrap"
              >
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Загрузить отчеты</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
