"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { reportUploadedLabel } from "@/lib/report-period"
import { formatMoney } from "@/lib/format-money"

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
      <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      )
  }

  if (error) {
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

          <Banner variant="danger">{error}</Banner>
        </div>
      )
  }

  return (
    
      <div className="space-y-6">
        <PageHeader
          size="md"
          backHref="/dashboard/admin/artists"
          backLabel="Назад к списку артистов"
          title={`Выплаты артиста: ${artist?.name ?? ""}`}
          rowClassName="sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:items-center"
          actions={
            <Button>
              <span className="material-symbols-outlined text-lg mr-2" aria-hidden>add</span>
              Добавить выплату
            </Button>
          }
        />

        {years.length === 0 ? (
          /* F-25: второе действие («Добавить первую выплату») ушло — CTA живёт
             в слоте actions шапки, дублировать её в пустом состоянии нечем. */
          <div className="card-glass rounded-2xl border border-white/5">
            <EmptyState
              icon="payments"
              title="Нет выплат"
              description="Для этого артиста пока нет выплат"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year} className="space-y-4">
                <SectionHeader className="mb-0" title={year} />

                <div className="space-y-3">
                  {paymentsByYear[year]
                    .sort((a, b) => {
                      const quarterA = Number.parseInt(a.quarter.substring(1), 10)
                      const quarterB = Number.parseInt(b.quarter.substring(1), 10)
                      return quarterB - quarterA
                    })
                    .map((payment) => (
                      <div key={payment.id} className="card-glass rounded-2xl border border-white/5 p-4 text-white">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {payment.status === "completed" ? (
                                <span className="material-symbols-outlined text-xl text-status-success" aria-hidden>check_circle</span>
                              ) : (
                                <span className="material-symbols-outlined text-xl text-status-warning" aria-hidden>schedule</span>
                              )}
                              <div>
                                <h4 className="font-medium">
                                  Выплата за {payment.quarter} {payment.year}
                                </h4>
                                <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                                  <span className="material-symbols-outlined text-base" aria-hidden>calendar_today</span>
                                  {/* F-15: «Загружен: …» — дата файла, не дата периода. */}
                                  <span>{reportUploadedLabel(payment.date)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-bold">{formatMoney(payment.amount)}</div>
                              <div className="text-xs text-gray-400">
                                {payment.status === "completed" ? "Выплачено" : "В обработке"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 mt-4">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/dashboard/admin/payments/${payment.id}`}>
                                <span className="material-symbols-outlined text-base mr-2" aria-hidden>edit</span>
                                Редактировать
                              </Link>
                            </Button>

                            {payment.status === "pending" && (
                              <Button variant="success-outline" size="sm">
                                <span className="material-symbols-outlined text-base mr-2" aria-hidden>currency_ruble</span>
                                Подтвердить выплату
                              </Button>
                            )}
                          </div>
                        </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
}
