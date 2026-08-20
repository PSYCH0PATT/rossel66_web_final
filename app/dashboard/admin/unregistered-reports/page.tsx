"use client"

import { useState, useEffect } from "react"
import { Banner } from "@/components/ui/banner"
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
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardFooter } from "@/components/dashboard-footer"
import { downloadFileFromApi } from "@/lib/download-file"

interface UnregisteredReport {
  id: string
  artistName: string
  quarter: string
  year: number
  fileName: string
  uploadDate: string
  totalPlays: number
  totalAmount: number
}

interface Artist {
  id: string
  name: string
  username: string
}

export default function UnregisteredReportsPage() {
  const [reports, setReports] = useState<UnregisteredReport[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [assignFor, setAssignFor] = useState<UnregisteredReport | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string>("")
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    fetchUnregisteredReports()
    loadArtists()
  }, [])

  const fetchUnregisteredReports = async () => {
    try {
      const response = await fetch("/api/reports/unregistered")
      const data = await response.json()
      // /api/reports/unregistered отдаёт { reports: [...] } без поля success
      if (Array.isArray(data.reports)) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error("Ошибка при загрузке отчётов:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadArtists = async () => {
    try {
      // forPicker=1 возвращает всех артистов (до 500), а не первую страницу из 20
      const response = await fetch("/api/artists?forPicker=1")
      const data = await response.json()
      if (data.success) {
        setArtists(data.artists)
      }
    } catch (error) {
      console.error("Ошибка при загрузке артистов:", error)
    }
  }

  const handleAssignReport = async () => {
    if (!assignFor || !selectedArtist) return

    try {
      const response = await fetch("/api/reports/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: assignFor.id,
          artistId: selectedArtist,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setReports(reports.filter((report) => report.id !== assignFor.id))
        setAssignFor(null)
        setSelectedArtist("")
        setBanner({ type: "ok", text: "Отчёт назначен артисту" })
      } else {
        setBanner({ type: "err", text: "Ошибка: " + (data.error || "") })
      }
    } catch (error) {
      console.error("Ошибка при назначении отчёта:", error)
      setBanner({ type: "err", text: "Ошибка при назначении отчёта" })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner />
        </div>
      )
  }

  return (
    <>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* C-01: возврат — в back-слоте шапки; кнопки-дубля в пустом
            состоянии больше нет (F-25) */}
        <PageHeader
          size="md"
          backHref="/dashboard/admin/dashboard"
          backLabel="К панели"
          title="Отчёты без кабинета"
          subtitle="Назначение вручную зарегистрированным артистам"
        />

        {banner && (
          <Banner
            variant={banner.type === "ok" ? "success" : "danger"}
            onClose={() => setBanner(null)}
          >
            {banner.text}
          </Banner>
        )}

        {reports.length === 0 ? (
          <EmptyState
            className="card-glass rounded-2xl border border-white/5 p-12"
            icon="description"
            title="Нет таких отчётов"
            description="Все отчёты назначены"
          />
        ) : (
          <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6 overflow-hidden">
            <SectionHeader className="mb-6" size="sm" title={`Список (${reports.length})`} />
            <div className="rounded-xl border border-white/10 overflow-hidden table-glass">
              <DataTable>
                <DataTableHeader>
                  <DataTableHeadRow>
                    <DataTableHeadCell>Артист</DataTableHeadCell>
                    <DataTableHeadCell>Период</DataTableHeadCell>
                    <DataTableHeadCell className="[font-variant-numeric:tabular-nums]">
                      Прослушивания
                    </DataTableHeadCell>
                    <DataTableHeadCell>Сумма</DataTableHeadCell>
                    <DataTableHeadCell>Дата</DataTableHeadCell>
                    <DataTableHeadCell className="text-right">Действия</DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHeader>
                <DataTableBody>
                  {reports.map((report) => (
                    <DataTableRow key={report.id}>
                      <DataTableCell className="font-medium text-white max-w-[180px]">
                        <span className="truncate block">{report.artistName}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge variant="draft" withIcon={false}>
                          {report.quarter} {report.year}
                        </StatusBadge>
                      </DataTableCell>
                      {/* C7: у коллабов число учитывается у каждого участника — не суммировать */}
                      <DataTableCell
                        className="text-gray-300 [font-variant-numeric:tabular-nums]"
                        title="У совместных треков одно и то же число прослушиваний учитывается у каждого участника — складывать по разным артистам нельзя."
                      >
                        {report.totalPlays.toLocaleString("ru-RU")}
                      </DataTableCell>
                      <DataTableCell className="font-display text-primary [font-variant-numeric:tabular-nums]">
                        {formatCurrency(report.totalAmount)}
                      </DataTableCell>
                      <DataTableCell className="text-gray-400 text-sm [font-variant-numeric:tabular-nums]">
                        {formatDate(report.uploadDate)}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                            onClick={() =>
                              void downloadFileFromApi(
                                `/api/reports/download/${report.id}`,
                                report.fileName
                              )
                            }
                          >
                            <span className="material-symbols-outlined text-base mr-1">download</span>
                            Скачать
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="cta"
                            className="rounded-lg"
                            onClick={() => {
                              setAssignFor(report)
                              setSelectedArtist("")
                            }}
                          >
                            <span className="material-symbols-outlined text-base mr-1">person_add</span>
                            Назначить
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </div>
        )}

        <DashboardFooter />
      </div>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent className="bg-surface-dialog border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Назначить отчёт</DialogTitle>
            <DialogDescription className="text-gray-400">
              {assignFor ? `Отчёт: ${assignFor.artistName} — ${assignFor.quarter} ${assignFor.year}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <FormField label="Артист" htmlFor="assign-artist">
              <Select value={selectedArtist} onValueChange={setSelectedArtist}>
                <SelectTrigger id="assign-artist" className="rounded-lg border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Выберите артиста" />
                </SelectTrigger>
                <SelectContent>
                  {artists.map((artist) => (
                    <SelectItem key={artist.id} value={artist.id}>
                      {artist.name} (@{artist.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setAssignFor(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="cta"
              onClick={() => void handleAssignReport()}
              disabled={!selectedArtist}
            >
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
