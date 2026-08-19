"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminPaymentItem } from "@/lib/cached-dashboard"
import { DashboardFooter } from "@/components/dashboard-footer"

export default function AdminPaymentsClient() {
  const [payments, setPayments] = useState<AdminPaymentItem[]>([])
  const [total, setTotal] = useState(0)
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [filter, setFilter] = useState<"all" | "unpaid">("all")
  const [loading, setLoading] = useState(true)
  const [statusError, setStatusError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (filter === "unpaid") params.set("unpaidOnly", "true")
      const res = await fetch(`/api/payments?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setPayments(data.payments ?? [])
        setTotal(typeof data.total === "number" ? data.total : 0)
        setUnpaidTotal(typeof data.unpaidTotal === "number" ? data.unpaidTotal : 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filter])

  useEffect(() => {
    load()
  }, [load])

  const pageSum = useMemo(
    () => payments.reduce((acc, p) => acc + Math.floor(Number(p.amount) || 0), 0),
    [payments],
  )

  const handlePaymentStatusUpdate = async (reportId: string, isPaid: boolean) => {
    setStatusError("")
    try {
      const response = await fetch("/api/reports/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, statusType: "paid", value: isPaid }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка при обновлении статуса")
      }

      setPayments((prev) => prev.map((p) => (p.reportId === reportId ? { ...p, isPaid } : p)))
      await load()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusError(msg)
    }
  }

  const handleSignatureStatusUpdate = async (reportId: string, isSigned: boolean) => {
    setStatusError("")
    try {
      const response = await fetch("/api/reports/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, statusType: "signed", value: isSigned }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка при обновлении статуса")
      }

      setPayments((prev) => prev.map((p) => (p.reportId === reportId ? { ...p, isSigned } : p)))
      await load()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatusError(msg)
    }
  }

  const setFilterAndReset = (f: "all" | "unpaid") => {
    setFilter(f)
    setPage(1)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const hasPrev = page > 1
  const hasNext = page * pageSize < total

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end sm:justify-between gap-4 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">Выплаты</h1>
            <p className="text-sm text-gray-400 font-light mt-2">Отчёты и статусы выплат артистам</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-500">
            <span className="[font-variant-numeric:tabular-nums]">
              {from}–{to} из {total}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">На стр.</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v) as 20 | 50 | 100)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[100px] h-9 rounded-lg border-white/10 bg-white/5 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card-glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-mono uppercase text-gray-500 mb-1">Всего записей</p>
          <p className="font-display text-2xl text-white [font-variant-numeric:tabular-nums]">{total}</p>
        </div>
        <div className="stat-card-glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-mono uppercase text-gray-500 mb-1">Невыплаченных</p>
          <p className="font-display text-2xl text-amber-400 [font-variant-numeric:tabular-nums]">{unpaidTotal}</p>
        </div>
        <div className="stat-card-glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-mono uppercase text-gray-500 mb-1">Сумма на странице</p>
          <p className="font-display text-2xl text-primary [font-variant-numeric:tabular-nums]">
            {pageSum.toLocaleString("ru-RU")} ₽
          </p>
        </div>
      </div>

      {statusError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2" role="alert">
          <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
          {statusError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-gray-500 text-lg">filter_list</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFilterAndReset("all")}
          className={`rounded-lg border text-xs font-mono uppercase ${
            filter === "all"
              ? "bg-primary/20 border-primary/40 text-primary"
              : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/[0.08]"
          }`}
        >
          Все
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFilterAndReset("unpaid")}
          className={`rounded-lg border text-xs font-mono uppercase inline-flex items-center gap-1 ${
            filter === "unpaid"
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/[0.08]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">pending</span>
          Невыплаченные ({unpaidTotal})
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-white/[0.04] border border-white/5 motion-safe:animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="card-glass rounded-2xl border border-white/5 p-10 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 block">payments</span>
          <h2 className="text-lg font-semibold text-white mb-2">
            {filter === "unpaid" ? "Нет невыплаченных выплат" : "Нет выплат"}
          </h2>
          <p className="text-gray-500 text-sm font-mono max-w-md mx-auto">
            {filter === "unpaid"
              ? "Все выплаты обработаны"
              : "Выплаты появятся после создания отчётов для зарегистрированных артистов."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 overflow-hidden table-glass">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-mono uppercase text-gray-500 border-b border-white/10">
                  <th className="p-3 sm:p-4">Квартал</th>
                  <th className="p-3 sm:p-4">Артист</th>
                  <th className="p-3 sm:p-4">Дата</th>
                  <th className="p-3 sm:p-4">Сумма</th>
                  <th className="p-3 sm:p-4">Подпись</th>
                  <th className="p-3 sm:p-4 text-right">Выплачено</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, idx) => {
                  const y = payment.year ?? 0
                  const prevY = idx > 0 ? payments[idx - 1].year ?? 0 : null
                  const showYear = prevY === null || y !== prevY
                  return (
                    <Fragment key={payment.id}>
                      {showYear && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-xs font-mono uppercase text-gray-500 bg-black/30 border-y border-white/5">
                            {y || "—"}
                          </td>
                        </tr>
                      )}
                      <tr
                        className="border-b border-white/5 hover:bg-white/[0.04] motion-safe:transition-colors table-row-hover"
                      >
                        <td className="p-3 sm:p-4 font-mono text-white whitespace-nowrap">
                          {payment.quarter} {payment.year}
                        </td>
                        <td className="p-3 sm:p-4 text-gray-300 min-w-0 max-w-[200px]">
                          <span className="truncate block">{payment.artistName}</span>
                        </td>
                        <td className="p-3 sm:p-4 text-gray-400 [font-variant-numeric:tabular-nums] whitespace-nowrap">
                          {payment.date ? new Date(payment.date).toLocaleDateString("ru-RU") : "—"}
                        </td>
                        <td className="p-3 sm:p-4 font-display text-white [font-variant-numeric:tabular-nums]">
                          {Math.floor(payment.amount ?? 0).toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`signed-${payment.id}`}
                              checked={payment.isSigned ?? false}
                              onCheckedChange={(checked) => handleSignatureStatusUpdate(payment.reportId, checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                            <span className="text-xs font-mono text-gray-400">
                              {payment.isSigned ? "Да" : "Нет"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center justify-end gap-3">
                            <Label htmlFor={`paid-${payment.id}`} className="text-gray-400 text-xs sr-only sm:not-sr-only sm:inline">
                              Выплачено
                            </Label>
                            <Switch
                              id={`paid-${payment.id}`}
                              checked={payment.isPaid ?? false}
                              onCheckedChange={(checked) => handlePaymentStatusUpdate(payment.reportId, checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
            >
              <span className="material-symbols-outlined text-base mr-1">chevron_left</span>
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
            >
              Далее
              <span className="material-symbols-outlined text-base ml-1">chevron_right</span>
            </Button>
          </div>
        </div>
      )}

      <DashboardFooter />
    </div>
  )
}
