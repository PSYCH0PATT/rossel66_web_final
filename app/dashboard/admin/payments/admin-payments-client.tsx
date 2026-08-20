"use client"

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { Banner } from "@/components/ui/banner"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterChip } from "@/components/ui/filter-chip"
import { PageHeader } from "@/components/ui/page-header"
import { Pagination } from "@/components/ui/pagination"
import { SkeletonRows } from "@/components/ui/skeleton-presets"
import { StatCard } from "@/components/ui/stat-card"
import { Switch } from "@/components/ui/switch"
import type { AdminPaymentItem } from "@/lib/cached-dashboard"
import { DashboardFooter } from "@/components/dashboard-footer"

/** Вид чипов-фильтров админки — один на /artists, /payments и /activity (F-22). */
const CHIP_CLASS =
  "rounded-lg border-white/10 bg-white/5 px-3 font-mono text-xs uppercase text-gray-400 hover:bg-white/[0.08] hover:text-white data-[active=true]:border-primary/40 data-[active=true]:bg-primary/20 data-[active=true]:text-primary"

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

  return (
    <div className="space-y-8">
      <PageHeader
        size="md"
        title="Выплаты"
        subtitle="Отчёты и статусы выплат артистам"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard className="rounded-2xl border border-white/5 p-5 md:p-5" label="Всего записей" value={total} />
        <StatCard
          className="rounded-2xl border border-white/5 p-5 md:p-5"
          label="Невыплаченных"
          tone="warning"
          value={<span className="text-amber-400">{unpaidTotal}</span>}
        />
        <StatCard
          className="rounded-2xl border border-white/5 p-5 md:p-5"
          label="Сумма на странице"
          tone="primary"
          value={<span className="text-primary">{pageSum.toLocaleString("ru-RU")} ₽</span>}
        />
      </div>

      {statusError && <Banner variant="danger">{statusError}</Banner>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-gray-500 text-lg">filter_list</span>
        <FilterChip
          tone="success"
          active={filter === "all"}
          onClick={() => setFilterAndReset("all")}
          className={CHIP_CLASS}
        >
          Все
        </FilterChip>
        <FilterChip
          tone="success"
          active={filter === "unpaid"}
          onClick={() => setFilterAndReset("unpaid")}
          className={CHIP_CLASS}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>pending</span>
          Невыплаченные ({unpaidTotal})
        </FilterChip>
      </div>

      {loading ? (
        <SkeletonRows className="py-4" rows={5} />
      ) : payments.length === 0 ? (
        <EmptyState
          className="card-glass rounded-2xl border border-white/5 p-10"
          icon="payments"
          title={filter === "unpaid" ? "Нет невыплаченных выплат" : "Нет выплат"}
          description={
            filter === "unpaid"
              ? "Все выплаты обработаны"
              : "Выплаты появятся после создания отчётов для зарегистрированных артистов."
          }
        />
      ) : (
        <div className="space-y-6">
          {/* C-10/F-76: без горизонтального скролла колонка тогглов «Выплачено»
              на 390 была за краем — отметить выплату с телефона было нельзя */}
          <div className="rounded-2xl border border-white/10 overflow-hidden table-glass">
            <DataTable tableClassName="min-w-[640px]">
              <DataTableHeader>
                <DataTableHeadRow>
                  <DataTableHeadCell>Квартал</DataTableHeadCell>
                  <DataTableHeadCell>Артист</DataTableHeadCell>
                  <DataTableHeadCell>Дата</DataTableHeadCell>
                  <DataTableHeadCell>Сумма</DataTableHeadCell>
                  <DataTableHeadCell>Подпись</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Выплачено</DataTableHeadCell>
                </DataTableHeadRow>
              </DataTableHeader>
              <DataTableBody>
                {payments.map((payment, idx) => {
                  const y = payment.year ?? 0
                  const prevY = idx > 0 ? payments[idx - 1].year ?? 0 : null
                  const showYear = prevY === null || y !== prevY
                  return (
                    <Fragment key={payment.id}>
                      {showYear && (
                        <DataTableRow className="border-y border-white/5 bg-black/30 hover:bg-black/30">
                          <DataTableCell colSpan={6} className="text-xs font-mono uppercase text-gray-500">
                            {y || "—"}
                          </DataTableCell>
                        </DataTableRow>
                      )}
                      <DataTableRow className="table-row-hover">
                        <DataTableCell className="font-mono text-white whitespace-nowrap">
                          {payment.quarter} {payment.year}
                        </DataTableCell>
                        <DataTableCell className="text-gray-300 min-w-0 max-w-[200px]">
                          <span className="truncate block">{payment.artistName}</span>
                        </DataTableCell>
                        <DataTableCell className="text-gray-400 [font-variant-numeric:tabular-nums] whitespace-nowrap">
                          {payment.date ? new Date(payment.date).toLocaleDateString("ru-RU") : "—"}
                        </DataTableCell>
                        <DataTableCell className="font-display text-white [font-variant-numeric:tabular-nums]">
                          {Math.floor(payment.amount ?? 0).toLocaleString("ru-RU")} ₽
                        </DataTableCell>
                        {/* F-42: один паттерн подписи тумблера — значение справа */}
                        <DataTableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`signed-${payment.id}`}
                              aria-label={`Подпись: ${payment.artistName}, ${payment.quarter} ${payment.year}`}
                              checked={payment.isSigned ?? false}
                              onCheckedChange={(checked) => handleSignatureStatusUpdate(payment.reportId, checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                            <span className="text-xs font-mono text-gray-400">
                              {payment.isSigned ? "Да" : "Нет"}
                            </span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              id={`paid-${payment.id}`}
                              aria-label={`Выплачено: ${payment.artistName}, ${payment.quarter} ${payment.year}`}
                              checked={payment.isPaid ?? false}
                              onCheckedChange={(checked) => handlePaymentStatusUpdate(payment.reportId, checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                            <span className="text-xs font-mono text-gray-400">
                              {payment.isPaid ? "Да" : "Нет"}
                            </span>
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    </Fragment>
                  )
                })}
              </DataTableBody>
            </DataTable>
          </div>

          {/* C-06: счётчик, «на странице» и навигация — один компонент (F-21) */}
          <Pagination
            className="pt-2"
            page={page}
            total={total}
            pageSize={pageSize}
            loading={loading}
            itemForms={["запись", "записи", "записей"]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size as 20 | 50 | 100)
              setPage(1)
            }}
          />
        </div>
      )}

      <DashboardFooter />
    </div>
  )
}
