"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Calendar, CheckCircle, Clock, Plus, Edit, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

type UiPayment = {
  id: string
  quarter: string
  year: number
  amount: number
  date: string
  status: "completed" | "pending"
}

export default function ArtistPaymentsPage({ params }: { params: { id: string } }) {
  const artistId = params.id
  const [artist, setArtist] = useState<{ id: string; name: string; username: string } | null>(null)
  const [artistPayments, setArtistPayments] = useState<UiPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const uRes = await fetch(`/api/users?id=${encodeURIComponent(artistId)}`, { credentials: "include" })
        const uJson = await uRes.json().catch(() => ({}))
        if (!uRes.ok || !uJson.users?.[0]) {
          if (!cancelled) setError("Артист не найден")
          return
        }
        const u = uJson.users[0]
        if (u.role !== "artist") {
          if (!cancelled) setError("Артист не найден")
          return
        }
        setArtist({ id: u.id, name: u.name, username: u.username })

        const pRes = await fetch(
          `/api/payments?artistId=${encodeURIComponent(artistId)}&pageSize=100&page=1`,
          { credentials: "include" }
        )
        const pJson = await pRes.json().catch(() => ({}))
        if (!pRes.ok) {
          if (!cancelled) setError(pJson.error || "Не удалось загрузить выплаты")
          return
        }
        const raw = (pJson.payments || []) as Array<{
          id: string
          quarter: string
          year: number
          amount: number | null
          date: string | null
          isPaid: boolean | null
        }>
        const mapped: UiPayment[] = raw.map((p) => ({
          id: p.id,
          quarter: p.quarter,
          year: p.year,
          amount: p.amount ?? 0,
          date: p.date || "",
          status: p.isPaid ? "completed" : "pending",
        }))
        if (!cancelled) setArtistPayments(mapped)
      } catch {
        if (!cancelled) setError("Ошибка загрузки")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [artistId])

  const paymentsByYear = artistPayments.reduce(
    (acc, payment) => {
      if (!acc[payment.year]) {
        acc[payment.year] = []
      }
      acc[payment.year].push(payment)
      return acc
    },
    {} as Record<number, UiPayment[]>
  )

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
                      const quarterA = Number.parseInt(a.quarter.substring(1), 10)
                      const quarterB = Number.parseInt(b.quarter.substring(1), 10)
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
                                  <span>
                                    {payment.date
                                      ? new Date(payment.date).toLocaleDateString()
                                      : "—"}
                                  </span>
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
