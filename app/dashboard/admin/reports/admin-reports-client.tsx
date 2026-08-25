"use client"

import { useCallback, useEffect, useState } from "react"
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterChip } from "@/components/ui/filter-chip"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Toolbar } from "@/components/ui/toolbar"
import { ReportSortControls, type SortState } from "@/components/report-sort-controls"
import ReportsList, {
  REPORTS_DEFAULT_SORT,
  REPORTS_SORT_FIELDS,
} from "@/components/reports-list"
import PendingSignatureList, {
  PENDING_DEFAULT_SORT,
  PENDING_SORT_FIELDS,
} from "@/components/pending-signature-list"
import UnregisteredReportsList from "@/components/unregistered-reports-list"
import SimpleReportUploader from "@/components/simple-report-uploader"
import ReportProcessor from "@/components/report-processor"
import { MissingContractBanner } from "@/components/missing-contract-banner"

/** Виды объединённого экрана (решение 0-а + ответ №3 про генератор). */
export type ReportsView = "all" | "pending" | "unpaid" | "unregistered" | "generator"

const VIEWS: { id: ReportsView; label: (counts: Counts) => string }[] = [
  { id: "all", label: () => "Все" },
  { id: "pending", label: () => "Ждут подписи" },
  { id: "unpaid", label: (c) => `Невыплаченные (${c.unpaidTotal})` },
  { id: "unregistered", label: () => "Без кабинета" },
  { id: "generator", label: () => "Генератор" },
]

type Counts = { total: number; unpaidTotal: number }

/** Вид чипов-фильтров админки — один на /artists, /reports и /activity (F-22). */
const CHIP_CLASS =
  "rounded-lg border-white/10 bg-white/5 px-3 font-mono text-xs uppercase text-gray-400 hover:bg-white/[0.08] hover:text-white data-[active=true]:border-primary/40 data-[active=true]:bg-primary/20 data-[active=true]:text-primary"

/**
 * Объединённый экран «Отчёты» — решение 0-а (docs/ia-decisions.md).
 *
 * Сущность одна — квартальный отчёт артиста с жизненным циклом «загружен →
 * ознакомился → подписал → выплачено», а экранов было два: /reports и
 * /payments, со своими чипами, своей пагинацией и своими стилями статуса.
 * Теперь это один экран: ряд чипов вместо табов и чипов выплат, метрика
 * «Невыплаченных» из /payments — первой, загрузка файлов — в overflow
 * «Сервис» (0-в), генератор — пятым видом (ответ №3).
 */
export default function AdminReportsClient({ initialView }: { initialView: ReportsView }) {
  const [view, setView] = useState<ReportsView>(initialView)
  const [counts, setCounts] = useState<Counts>({ total: 0, unpaidTotal: 0 })
  const [folderSort, setFolderSort] = useState<SortState>(REPORTS_DEFAULT_SORT)
  const [pendingSort, setPendingSort] = useState<SortState>(PENDING_DEFAULT_SORT)
  const [uploaderOpen, setUploaderOpen] = useState(false)

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/payments?countsOnly=1")
      const data = await res.json()
      if (data.success) {
        setCounts({
          total: typeof data.total === "number" ? data.total : 0,
          unpaidTotal: typeof data.unpaidTotal === "number" ? data.unpaidTotal : 0,
        })
      }
    } catch (error) {
      console.error("Не удалось загрузить счётчики отчётов:", error)
    }
  }, [])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  const isFolders = view === "all" || view === "unpaid"

  return (
    <div className="space-y-8">
      <PageHeader
        title="Отчёты"
        subtitle="Квартальные отчёты артистов: подписи, выплаты и очередь без кабинета"
        actions={
          /* 0-в: сервисные операции — в overflow, на поверхности экрана их нет.
             Загрузка отчётов важная, но редкая (владелец, п.11). */
          <ActionMenu kind="service">
            <ActionMenuItem
              icon="upload"
              description="Excel готового отчёта за квартал"
              onSelect={() => setUploaderOpen(true)}
            >
              Загрузка отчётов
            </ActionMenuItem>
          </ActionMenu>
        }
      />

      {/* 0-а: главная операционная метрика цикла переезжает с /payments и идёт
          первой; «Сумма на странице» убрана — она зависела от пагинации. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          className="rounded-2xl border border-white/5 p-5 md:p-5"
          label="Невыплаченных"
          tone="warning"
          value={<span className="text-amber-400">{counts.unpaidTotal}</span>}
        />
        <StatCard
          className="rounded-2xl border border-white/5 p-5 md:p-5"
          label="Всего записей"
          value={counts.total}
        />
      </div>

      {/* 0-а: один ряд чипов вместо табов /reports и чипов /payments */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-gray-500 text-lg" aria-hidden>
          filter_list
        </span>
        {VIEWS.map((item) => (
          <FilterChip
            key={item.id}
            tone="success"
            active={view === item.id}
            className={CHIP_CLASS}
            onClick={() => setView(item.id)}
          >
            {item.label(counts)}
          </FilterChip>
        ))}
      </div>

      {/* 1.3: сортировка — в Toolbar экрана, а не внутри списка */}
      {(isFolders || view === "pending") && (
        <Toolbar>
          {isFolders ? (
            <ReportSortControls
              value={folderSort}
              onChange={setFolderSort}
              fields={REPORTS_SORT_FIELDS}
            />
          ) : (
            <ReportSortControls
              value={pendingSort}
              onChange={setPendingSort}
              fields={PENDING_SORT_FIELDS}
            />
          )}
        </Toolbar>
      )}

      {/* 0-а: предупреждение о неполных данных — после шапки и фильтров,
          свёрнутым, а не первым экраном (F-44) */}
      <MissingContractBanner />

      {isFolders && (
        <ReportsList
          filter={view === "unpaid" ? "unpaid" : "all"}
          sort={folderSort}
          onDataChange={loadCounts}
        />
      )}
      {view === "pending" && <PendingSignatureList sort={pendingSort} />}
      {view === "unregistered" && <UnregisteredReportsList onAssigned={loadCounts} />}
      {view === "generator" && (
        /* 1.4/F-71: одна шапка — PageHeader экрана и карточка формы; внешней
           секции-обёртки «Обработка» больше нет. */
        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <ReportProcessor />
        </div>
      )}

      <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
        <DialogContent className="bg-surface-dialog border border-white/10 text-white max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Загрузка отчёта</DialogTitle>
            <DialogDescription className="text-gray-400">
              Excel-файл готового отчёта и основные данные по нему
            </DialogDescription>
          </DialogHeader>
          <SimpleReportUploader />
        </DialogContent>
      </Dialog>

    </div>
  )
}
