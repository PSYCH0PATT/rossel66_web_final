"use client"

import { useState, useMemo, useRef } from "react"
import { useReleasesList, revalidateReleasesLists } from "@/lib/hooks/use-dashboard-fetch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { DatePicker } from "@/components/ui/date-picker"
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Pagination } from "@/components/ui/pagination"
import { SearchInput } from "@/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ReleaseStatusBadge } from "@/components/ui/status-badge"
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar"
import { DashboardFooter } from "@/components/dashboard-footer"
import { FOOTER_STRINGS } from "@/lib/ui-strings"
import Image from "next/image"
import Link from "next/link"
import type { ReleaseListItem } from "@/lib/release-list-dto"

type ReleaseRow = ReleaseListItem & { artistName?: string }

/** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

/** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт /api/releases. */
function toIsoDate(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function AdminReleasesClient() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterArtistName, setFilterArtistName] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val.trim())
      setPage(1)
    }, 350)
  }

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    if (debouncedQ) params.set("q", debouncedQ)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterArtistName.trim()) params.set("artistName", filterArtistName.trim())
    if (filterDateFrom) params.set("dateFrom", filterDateFrom)
    if (filterDateTo) params.set("dateTo", filterDateTo)
    return `/api/releases?${params}`
  }, [page, pageSize, debouncedQ, filterStatus, filterArtistName, filterDateFrom, filterDateTo])

  const { data, isLoading, mutate } = useReleasesList(listUrl)
  const releases = (data?.releases as ReleaseRow[] | undefined) ?? []
  const total = typeof data?.total === "number" ? data.total : releases.length
  const loading = isLoading

  const activeFiltersCount = useMemo(() => {
    let c = 0
    if (filterStatus !== "all") c++
    if (filterArtistName.trim()) c++
    if (filterDateFrom) c++
    if (filterDateTo) c++
    return c
  }, [filterStatus, filterArtistName, filterDateFrom, filterDateTo])

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterArtistName("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setQ("")
    setDebouncedQ("")
    setPage(1)
  }

  const handleAssignReleasesToArtists = async () => {
    if (!confirm("Привязать релизы без артиста ко всем артистам по имени?")) return
    setIsAssigning(true)
    try {
      const response = await fetch("/api/admin/assign-releases-to-artists", { method: "POST" })
      const result = await response.json()
      if (result.success) {
        alert(
          `✅ ${result.message}\n\nДетали:\n${result.details
            .map((d: any) => `• ${d.artist}: ${d.assigned} релиз(ов)`)
            .join("\n")}`
        )
        setPage(1)
        await mutate()
        revalidateReleasesLists()
      } else {
        alert(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ Ошибка при привязке релизов: ${error}`)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот релиз?")) return
    try {
      const response = await fetch(`/api/releases/${releaseId}`, { method: "DELETE" })
      if (response.ok) {
        await mutate()
        revalidateReleasesLists()
      } else {
        alert("Ошибка при удалении релиза")
      }
    } catch {
      alert("Ошибка при удалении релиза")
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return "--"
      if (dateStr.includes('.')) {
        const parts = dateStr.split('.')
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
          if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("ru-RU")
          }
        }
      }
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr || "--"
      return d.toLocaleDateString("ru-RU")
    } catch {
      return dateStr || "--"
    }
  }

  return (
    <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      {/* C-01: шапка экрана. Тулбар и поиск — в слоте meta, под H1. */}
      <PageHeader
        size="lg"
        title="РЕЛИЗЫ"
        className="mb-8 pb-6"
        rowClassName="items-stretch md:items-stretch"
        meta={
          <div className="mt-4 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            {/* C-08: тулбар вместо 7 raw-кнопок с цветами через style */}
            <Toolbar className="flex-1">
              <ToolbarButton asChild tone="info">
                <Link href="/dashboard/admin/releases/zvonko-parser">
                  <span className="material-symbols-outlined" aria-hidden>download</span>
                  Zvonko Parser
                </Link>
              </ToolbarButton>

              <ToolbarButton asChild tone="success">
                <Link href="/dashboard/admin/releases/koala-parser">
                  <span className="material-symbols-outlined" aria-hidden>sync</span>
                  Koala Parser
                </Link>
              </ToolbarButton>

              <ToolbarButton
                tone="warning"
                icon={isAssigning ? "sync" : "link"}
                onClick={handleAssignReleasesToArtists}
                disabled={isAssigning}
                className={isAssigning ? "[&_.material-symbols-outlined]:animate-spin" : undefined}
              >
                {isAssigning ? "Привязка..." : "Привязать релизы"}
              </ToolbarButton>

              {/* Filters */}
              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <ToolbarButton
                    tone={activeFiltersCount > 0 ? "active" : "neutral"}
                    icon="tune"
                    className="relative"
                  >
                    Фильтры
                    {activeFiltersCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-black">
                        {activeFiltersCount}
                      </span>
                    )}
                  </ToolbarButton>
                </DialogTrigger>
                <DialogContent
                  // globals.css задаёт `.grid { max-width: 100% }`, и это
                  // перебивает max-w-lg самого DialogContent — прежний код
                  // держал ширину inline-стилем. `!` вместо стиля: ширина
                  // модалки остаётся прежней, 32rem.
                  className="!max-w-lg border-white/10 bg-surface-dialog-blue text-white"
                >
                  <DialogHeader>
                    <DialogTitle className="text-white font-display text-xl tracking-wide uppercase">
                      Фильтры релизов
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <FormField label="Статус" htmlFor="status">
                      <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
                        <SelectTrigger id="status" className="border-white/10 text-white bg-black/40">
                          <SelectValue placeholder="Все статусы" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все статусы</SelectItem>
                          <SelectItem value="Модерируется">Модерируется</SelectItem>
                          <SelectItem value="Отклонен">Отклонен</SelectItem>
                          <SelectItem value="В доставке">В доставке</SelectItem>
                          <SelectItem value="Доставлен">Доставлен</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Артист" htmlFor="artist">
                      <Input
                        id="artist"
                        type="text"
                        placeholder="Имя артиста (частичное совпадение)"
                        value={filterArtistName}
                        onChange={(e) => { setFilterArtistName(e.target.value); setPage(1) }}
                        className="border-white/10 text-white bg-black/40"
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      {/* F-12: нативные date-инпуты выпадали из тёмной темы */}
                      <FormField label="Дата от" htmlFor="dateFrom">
                        <DatePicker
                          id="dateFrom"
                          value={parseIsoDate(filterDateFrom)}
                          onChange={(date) => { setFilterDateFrom(toIsoDate(date)); setPage(1) }}
                          placeholder="дд.мм.гггг"
                          className="h-10 w-full justify-start border-white/10 bg-black/40 text-sm normal-case text-white"
                        />
                      </FormField>
                      <FormField label="Дата до" htmlFor="dateTo">
                        <DatePicker
                          id="dateTo"
                          value={parseIsoDate(filterDateTo)}
                          onChange={(date) => { setFilterDateTo(toIsoDate(date)); setPage(1) }}
                          placeholder="дд.мм.гггг"
                          className="h-10 w-full justify-start border-white/10 bg-black/40 text-sm normal-case text-white"
                        />
                      </FormField>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={resetFilters}
                        className="flex-1 rounded-lg border-white/10 text-sm font-mono uppercase tracking-wider text-gray-400 hover:text-white"
                      >
                        Сбросить
                      </Button>
                      <Button
                        variant="cta"
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 rounded-lg text-sm uppercase tracking-wider"
                      >
                        Применить
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {(activeFiltersCount > 0 || q) && (
                <ToolbarButton tone="muted" icon="filter_alt_off" onClick={resetFilters}>
                  Сбросить
                </ToolbarButton>
              )}

              {/* C-08: primary на 390 встаёт первым, а не в третий ряд (F-09) */}
              <ToolbarButton asChild tone="primary" mobileFirst>
                <Link href="/dashboard/admin/releases/add">
                  <span className="material-symbols-outlined" aria-hidden>add</span>
                  Добавить релиз
                </Link>
              </ToolbarButton>
            </Toolbar>

            {/* Поиск — справа, та же высота h-10 */}
            <SearchInput
              value={q}
              onValueChange={handleSearch}
              placeholder="Поиск по названию или UPC..."
              containerClassName="w-full shrink-0 sm:ml-auto sm:w-72 sm:max-w-sm"
            />
          </div>
        }
      />

      {/* Table */}
      <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />

        {loading && releases.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" />
          </div>
        ) : releases.length === 0 ? (
          <EmptyState
            className="py-20"
            icon="library_music"
            title="Релизы не найдены"
            action={
              (activeFiltersCount > 0 || debouncedQ) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="rounded-lg border-white/10 font-mono text-xs uppercase tracking-wider text-gray-400 hover:text-white"
                >
                  Сбросить фильтры
                </Button>
              )
            }
          />
        ) : (
          /* C-10: скролл с видимым индикатором и тенями — колонки за краем
             больше не теряются на 390 (F-77); строка кликабельна целиком (F-31) */
          <DataTable>
            <DataTableHeader>
              <DataTableHeadRow className="bg-black/40">
                <DataTableHeadCell>Обложка</DataTableHeadCell>
                <DataTableHeadCell>Название</DataTableHeadCell>
                <DataTableHeadCell>Артист</DataTableHeadCell>
                <DataTableHeadCell>UPC</DataTableHeadCell>
                <DataTableHeadCell>Дата</DataTableHeadCell>
                <DataTableHeadCell>Статус</DataTableHeadCell>
                <DataTableHeadCell className="text-center">Треков</DataTableHeadCell>
                <DataTableHeadCell className="text-right">Действия</DataTableHeadCell>
              </DataTableHeadRow>
            </DataTableHeader>
            <DataTableBody className="text-sm">
              {releases.map((release) => (
                <DataTableRow
                  key={release.id}
                  href={`/dashboard/admin/releases/${release.id}`}
                  className="group table-row-hover"
                >
                  {/* Cover */}
                  <DataTableCell>
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden group-hover:ring-1 group-hover:ring-brand/50 transition-all flex-shrink-0">
                      {release.coverUrl ? (
                        <Image
                          src={release.coverUrl}
                          alt={release.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800/60 flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-600" style={{ fontSize: 22 }}>album</span>
                        </div>
                      )}
                    </div>
                  </DataTableCell>

                  {/* Title */}
                  <DataTableCell>
                    <Link href={`/dashboard/admin/releases/${release.id}`}>
                      <div className="font-bold text-white group-hover:text-brand transition-colors leading-snug max-w-[200px] truncate">
                        {release.title}
                      </div>
                      {(release as any).type && (
                        <div className="text-xs text-gray-500 mt-0.5 font-mono">{(release as any).type}</div>
                      )}
                    </Link>
                  </DataTableCell>

                  {/* Artist */}
                  <DataTableCell>
                    <div className="text-gray-300 max-w-[160px] truncate">{release.artistName ?? ""}</div>
                  </DataTableCell>

                  {/* UPC */}
                  <DataTableCell className="font-mono text-xs text-gray-400 tracking-wider">
                    {release.upc || "--"}
                  </DataTableCell>

                  {/* Date */}
                  <DataTableCell className="text-gray-400 font-mono text-xs whitespace-nowrap">
                    {release.releaseDate ? formatDate(release.releaseDate) : "--"}
                  </DataTableCell>

                  {/* Status */}
                  <DataTableCell>
                    <ReleaseStatusBadge status={release.status} />
                  </DataTableCell>

                  {/* Tracks */}
                  <DataTableCell className="text-center text-gray-400 font-mono">
                    <span className="flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-emerald-500/60" style={{ fontSize: 14 }}>music_note</span>
                      {release.trackCount ?? 0}
                    </span>
                  </DataTableCell>

                  {/* Actions */}
                  <DataTableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        asChild
                        size="icon"
                        variant="success-outline"
                        className="h-8 w-8 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11 rounded-lg border-brand/30 text-brand hover:bg-brand/15 hover:border-brand/60"
                      >
                        <Link
                          href={`/dashboard/admin/releases/${release.id}`}
                          aria-label={`Редактировать ${release.title}`}
                          title="Редактировать"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden>edit</span>
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive-outline"
                        onClick={() => handleDeleteRelease(release.id)}
                        aria-label={`Удалить ${release.title}`}
                        title="Удалить"
                        className="h-8 w-8 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11 rounded-lg"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden>delete</span>
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}

        {/* Loading overlay when paginating */}
        {loading && releases.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-xl backdrop-blur-[1px]">
            <Spinner size="lg" />
          </div>
        )}

        {/* C-06: счётчик, «на странице» и навигация — один компонент (F-21,
            F-26, F-27); строки русские (F-11) */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20">
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            loading={loading}
            itemForms={["релиз", "релиза", "релизов"]}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          />
        </div>
      </div>

      <DashboardFooter>
        {/* F-11: было «TOTAL RELEASES: 445» латиницей рядом с «System Online» */}
        <div className="uppercase tracking-widest text-gray-400">
          {FOOTER_STRINGS.totalReleases}:{" "}
          <span className="font-bold text-white">{loading ? "…" : total}</span>
        </div>
      </DashboardFooter>
    </div>
  )
}
