"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { payments, users } from "@/lib/data"
import { DollarSign, Calendar, CheckCircle, Clock, Plus, Edit, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function ArtistPaymentsPage({ params }: { params: { id: string } }) {
  const artistId = params.id
  const [artist, setArtist] = useState<any>(null)
  const [artistPayments, setArtistPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Загрузка данных артиста и его выплат
  useEffect(() => {
    // Проверяем статичных артистов
    const staticArtist = users.find((user) => user.id === artistId && user.role === "artist")

    if (staticArtist) {
      setArtist(staticArtist)
      // Получаем выплаты артиста из статичных данных
      const artistPayments = payments.filter((payment) => payment.artistId === artistId)
      setArtistPayments(artistPayments)
      setLoading(false)
      return
    }

    // Проверяем динамически добавленных артистов
    const dynamicUsersStr = localStorage.getItem("dynamicUsers")
    const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []
    const dynamicArtist = dynamicUsers.find((user: any) => user.id === artistId && user.role === "artist")

    if (dynamicArtist) {
      setArtist(dynamicArtist)

      // Получаем выплаты артиста из localStorage
      const dynamicPaymentsStr = localStorage.getItem(`payments_${artistId}`)
      const dynamicPayments = dynamicPaymentsStr ? JSON.parse(dynamicPaymentsStr) : []
      setArtistPayments(dynamicPayments)
    } else {
      setError("Артист не найден")
    }

    setLoading(false)
  }, [artistId])

  // Group payments by year
  const paymentsByYear = artistPayments.reduce(
    (acc, payment) => {
      if (!acc[payment.year]) {
        acc[payment.year] = []
      }
      acc[payment.year].push(payment)
      return acc
    },
    {} as Record<number, typeof payments>,
  )

  // Sort years in descending order
  const years = Object.keys(paymentsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  if (loading) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
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
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    )
  }

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

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Выплаты артиста: {artist?.name}</h1>

          <Button className="bg-azure hover:bg-azure-dark text-black">
            <Plus className="h-4 w-4 mr-2" />
            Добавить выплату
          </Button>
        </div>

        {years.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">Нет выплат</h2>
            <p className="text-gray-400 mb-6">Для этого артиста пока нет выплат</p>
            <Button className="bg-azure hover:bg-azure-dark text-black">
              <Plus className="h-4 w-4 mr-2" />
              Добавить первую выплату
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year} className="space-y-4">
                <h2 className="text-xl font-semibold text-white">{year}</h2>

                <div className="space-y-3">
                  {paymentsByYear[year]
                    .sort((a, b) => {
                      // Sort by quarter (Q1, Q2, Q3, Q4)
                      const quarterA = Number.parseInt(a.quarter.substring(1))
                      const quarterB = Number.parseInt(b.quarter.substring(1))
                      return quarterB - quarterA
                    })
                    .map((payment) => (
                      <Card key={payment.id} className="bg-gray-900 border-gray-800 text-white">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {payment.status === "completed" ? (
                                <CheckCircle className="h-5 w-5 text-emerald" />
                              ) : (
                                <Clock className="h-5 w-5 text-amber-500" />
                              )}
                              <div>
                                <h4 className="font-medium">
                                  Выплата за {payment.quarter} {payment.year}
                                </h4>
                                <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(payment.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-bold">{payment.amount.toLocaleString()} ₽</div>
                              <div className="text-xs text-gray-400">
                                {payment.status === "completed" ? "Выплачено" : "В обработке"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 mt-4">
                            <Link href={`/dashboard/admin/payments/${payment.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-azure text-azure hover:bg-azure hover:text-black"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Редактировать
                              </Button>
                            </Link>

                            {payment.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald text-emerald hover:bg-emerald hover:text-black"
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                Подтвердить выплату
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
