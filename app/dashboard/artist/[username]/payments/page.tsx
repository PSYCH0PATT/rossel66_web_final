"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock, AlertCircle, Wallet } from "lucide-react"
import { notFound } from "next/navigation"

interface Artist {
  id: string
  username: string
  name: string
  role: string
}

interface Report {
  id: string
  artistId: string
  artistName: string
  quarter: string
  year: number
  totalAmount: number
  isPaid: boolean
  isSigned: boolean
  uploadDate: string
}

interface Balance {
  artistId: string
  totalBalance: number
  availableForPayout: number
  lastUpdated: string
}

export default function PaymentsPage({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Получаем данные артиста
        const usersResponse = await fetch('/api/users')
        const usersResult = await usersResponse.json()
        
        if (usersResult.success) {
          const foundArtist = usersResult.users.find(
            (a: Artist) => a.username === params.username && a.role === "artist"
          )
          
          if (foundArtist) {
            setArtist(foundArtist)
            
            // Получаем отчеты артиста
            const reportsResponse = await fetch('/api/reports/quarters')
            const quartersResult = await reportsResponse.json()
            
            if (quartersResult.quarters) {
              const allReports: Report[] = []
              
              for (const quarter of quartersResult.quarters) {
                const quarterReportsResponse = await fetch(`/api/reports/list/${quarter}`)
                const quarterReportsResult = await quarterReportsResponse.json()
                
                if (quarterReportsResult.reports) {
                  const artistReports = quarterReportsResult.reports.filter(
                    (report: Report) => report.artistId === foundArtist.id
                  )
                  allReports.push(...artistReports)
                }
              }
              
              setReports(allReports)
            }
            
            // Получаем баланс артиста
            const balanceResponse = await fetch(`/api/balance/${foundArtist.id}`)
            if (balanceResponse.ok) {
              const balanceResult = await balanceResponse.json()
              setBalance(balanceResult.balance)
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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

  // Группируем отчеты по годам и кварталам
  const reportsByYear = reports.reduce((acc, report) => {
    if (!acc[report.year]) {
      acc[report.year] = []
    }
    acc[report.year].push(report)
    return acc
  }, {} as Record<number, Report[]>)

  const years = Object.keys(reportsByYear).map(Number).sort((a, b) => b - a)
  
  const totalEarnings = reports.reduce((sum, report) => sum + report.totalAmount, 0)
  const paidAmount = reports.filter(r => r.isPaid).reduce((sum, report) => sum + report.totalAmount, 0)
  const unpaidAmount = totalEarnings - paidAmount

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Выплаты и баланс</h1>

        {/* Карточка баланса */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-400" />
                Общий баланс
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balance?.totalBalance.toFixed(2) || "0.00"} ₽</div>
              <p className="text-xs text-slate-400 mt-1">Накопленные средства</p>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                Доступно к выплате
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balance?.availableForPayout.toFixed(2) || "0.00"} ₽</div>
              <p className="text-xs text-slate-400 mt-1">Минимум: 3,000 ₽</p>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-400" />
                Выплачено
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paidAmount.toFixed(2)} ₽</div>
              <p className="text-xs text-slate-400 mt-1">За все время</p>
            </CardContent>
          </Card>
        </div>

        {/* Информация о минимальной сумме */}
        {balance && balance.totalBalance > 0 && balance.availableForPayout === 0 && (
          <Card className="bg-transparent border-yellow-500/30 text-white rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Недостаточно средств для выплаты</h4>
                  <p className="text-sm text-slate-400">
                    Минимальная сумма для выплаты составляет 3,000 ₽. 
                    У вас накоплено {balance.totalBalance.toFixed(2)} ₽. 
                    Осталось накопить {(3000 - balance.totalBalance).toFixed(2)} ₽.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* История отчетов и выплат */}
        {reports.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              История отчетов
            </h2>

            {years.map((year) => (
              <div key={year} className="space-y-4">
                <h3 className="text-lg font-medium text-white">{year}</h3>

                <div className="space-y-3">
                  {reportsByYear[year]
                    .sort((a, b) => {
                      const quarterA = parseInt(a.quarter.substring(1))
                      const quarterB = parseInt(b.quarter.substring(1))
                      return quarterB - quarterA
                    })
                    .map((report) => (
                      <Card key={report.id} className="bg-transparent border-slate-600/30 hover:border-slate-500/50 transition-colors rounded-xl">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-slate-700/30">
                                {report.isPaid ? (
                                  <CheckCircle className="h-5 w-5 text-green-400" />
                                ) : (
                                  <Clock className="h-5 w-5 text-yellow-400" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium text-white">
                                  Отчет за {report.quarter} {report.year}
                                </h4>
                                <div className="text-sm text-slate-400 flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>{new Date(report.uploadDate).toLocaleDateString('ru-RU')}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {report.isSigned ? (
                                      <CheckCircle className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-red-400" />
                                    )}
                                    <span>{report.isSigned ? "Подписан" : "Не подписан"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-bold text-white">{report.totalAmount.toFixed(2)} ₽</div>
                              <div className="text-xs text-slate-400">
                                {report.isPaid ? "Выплачено" : "Не выплачено"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="bg-transparent border-slate-600/30 text-white rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">У вас пока нет отчетов</h2>
            <p className="text-slate-400">
              Здесь будут отображаться ваши отчеты и связанные с ними выплаты.
            </p>
          </Card>
        )}
      </div>
    </Layout>
  )
}
