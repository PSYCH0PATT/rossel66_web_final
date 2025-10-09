"use client"

import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Music, FileText, DollarSign, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setCurrentUser(user)
      } catch (error) {
        console.error('Error parsing user:', error)
      }
    }

    const load = async () => {
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

        if (uData?.success) setUsers(uData.users)
        if (rlsData?.success) setReleases(rlsData.releases)
        if (payData?.success) setPayments(payData.payments)

        // Загружаем отчеты по кварталам, чтобы получить количество
        if (qData?.quarters?.length) {
          const allReports: any[] = []
          for (const q of qData.quarters) {
            const rq = await fetch(`/api/reports/list/${q}`)
            const rqData = await rq.json()
            if (rqData?.reports) allReports.push(...rqData.reports)
          }
          setReports(allReports)
        }
      } catch (e) {
        console.error('Ошибка загрузки данных для дашборда админа:', e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

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
              <p className="text-xs text-slate-400 mt-1">{metrics.pendingReleases} ожидают обработки</p>
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
            {currentUser && <ActivityFeed userId={currentUser.id} role="admin" limit={5} />}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/admin/artists"
                className="flex items-center justify-center gap-2 p-2 text-sm bg-slate-800/50 hover:bg-slate-700/60 rounded-xl transition-colors"
              >
                <Users className="h-4 w-4" />
                <span>Управление артистами</span>
              </Link>

              <Link
                href="/admin/reports"
                className="flex items-center justify-center gap-2 p-2 text-sm bg-slate-800/50 hover:bg-slate-700/60 rounded-xl transition-colors"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Загрузить отчеты</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
