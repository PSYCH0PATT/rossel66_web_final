"use client"

import { useState, useEffect } from "react"
import { formatDateRu } from "@/lib/format-date"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormField } from "@/components/ui/form-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText, Trash2, Play, DollarSign, Calendar, ChevronDown, ChevronRight, UserPlus } from "lucide-react"
import { downloadFileFromApi, quarterArchiveName } from "@/lib/download-file"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"

interface UnregisteredReport {
  id: string
  artistName: string
  quarter: string
  year: number
  fileName: string
  uploadDate: string
  status: "processed" | "pending"
  totalPlays: number
  totalAmount: number
}

interface Artist {
  id: string
  name: string
  username: string
}

/**
 * Вид «Без кабинета» экрана «Отчёты».
 *
 * Вопрос №1 (docs/ia-decisions.md, ответ владельца — вариант «а»): назначение
 * отчёта артисту жило только на роуте-сироте /dashboard/admin/unregistered-reports,
 * доступном по прямому URL, а в этом компоненте его не было вовсе. Теперь
 * «Назначить» и диалог назначения здесь, роут-сирота удалён (redirect).
 */
export default function UnregisteredReportsList({
  /** Отчёт назначен — счётчики шапки экрана пора пересчитать. */
  onAssigned,
}: {
  onAssigned?: () => void
}) {
  const [reports, setReports] = useState<UnregisteredReport[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set())
  const [assignFor, setAssignFor] = useState<UnregisteredReport | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string>("")
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/reports/unregistered")
        const data = await response.json()
        
        if (data.reports) {
          setReports(data.reports)
        }
      } catch (error) {
        console.error("Ошибка при загрузке отчётов:", error)
      } finally {
        setIsLoading(false)
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

    fetchReports()
    loadArtists()
  }, [])

  const handleDownload = (reportId: string, fileName: string) => {
    void downloadFileFromApi(`/api/reports/download/${reportId}`, fileName)
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
        setReports((prev) => prev.filter((report) => report.id !== assignFor.id))
        setAssignFor(null)
        setSelectedArtist("")
        setBanner({ type: "ok", text: "Отчёт назначен артисту" })
        onAssigned?.()
      } else {
        setBanner({ type: "err", text: "Ошибка: " + (data.error || "") })
      }
    } catch (error) {
      console.error("Ошибка при назначении отчёта:", error)
      setBanner({ type: "err", text: "Ошибка при назначении отчёта" })
    }
  }

  const handleDelete = async (reportId: string, artistName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить отчёт для ${artistName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/reports/delete/${reportId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Ошибка при удалении отчёта')
      }

      // Обновляем список отчётов
      setReports(reports.filter(report => report.id !== reportId))
    } catch (error) {
      console.error('Ошибка при удалении:', error)
      alert('Ошибка при удалении отчёта')
    }
  }

  /** Метка квартала приходит как «Q1 2026» — год нужен роуту и имени архива. */
  const handleDownloadAll = (quarterLabel: string) => {
    const [quarter, year] = quarterLabel.split(" ")
    const suffix = year ? `?${new URLSearchParams({ year })}` : ""
    void downloadFileFromApi(
      `/api/reports/download-all/${encodeURIComponent(quarter)}${suffix}`,
      quarterArchiveName(quarter, year)
    )
  }

  const toggleQuarter = (quarter: string) => {
    const newCollapsed = new Set(collapsedQuarters)
    if (newCollapsed.has(quarter)) {
      newCollapsed.delete(quarter)
    } else {
      newCollapsed.add(quarter)
    }
    setCollapsedQuarters(newCollapsed)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner label="Загрузка отчётов..." />
      </div>
    )
  }

  if (reports.length === 0) {
    /* F-47: было три статус-сообщения на экране. Пилюля «Система работает
       корректно» дублировала заголовок и спорила с баннером о неполных
       данных — остаётся одно состояние экрана. */
    return (
      <>
        {banner && (
          <Banner
            className="mb-4"
            variant={banner.type === "ok" ? "success" : "danger"}
            onClose={() => setBanner(null)}
          >
            {banner.text}
          </Banner>
        )}
        <EmptyState
          icon="how_to_reg"
          title="Нет отчётов без кабинета"
          description="Все отчёты назначены зарегистрированным артистам"
        />
      </>
    )
  }

  // Группируем отчёты по кварталам
  const reportsByQuarter = reports.reduce((acc, report) => {
    const key = `${report.quarter} ${report.year}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(report)
    return acc
  }, {} as Record<string, UnregisteredReport[]>)

  return (
    <div className="space-y-4">
      {banner && (
        <Banner
          variant={banner.type === "ok" ? "success" : "danger"}
          onClose={() => setBanner(null)}
        >
          {banner.text}
        </Banner>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          {/* F-60: одна сущность — одно имя, «Отчёты без кабинета» */}
          <h3 className="text-lg font-semibold text-white">Отчёты без кабинета</h3>
          <p className="text-sm text-slate-400">Отчёты артистов, у которых нет кабинета</p>
        </div>
        <div className="text-sm text-slate-400">
          Всего: {reports.length} отчётов
        </div>
      </div>

      {Object.entries(reportsByQuarter).map(([quarter, quarterReports]) => {
        const isCollapsed = collapsedQuarters.has(quarter)
        return (
          <Card key={quarter} className="bg-transparent border-slate-600/30">
            <CardHeader 
              className="pb-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
              onClick={() => toggleQuarter(quarter)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20">
                    <FileText className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">{quarter}</h4>
                    <p className="text-sm text-slate-400">{quarterReports.length} отчётов</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="success-outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadAll(quarter)
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Скачать все
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="pt-0">
                <div className="space-y-3">
              {quarterReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-600/30 bg-transparent p-4 transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-700/20 sm:flex-row sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-lg mb-2 truncate">
                      {report.artistName}
                    </h4>
                    
                    <div className="flex items-center flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Play className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-white font-medium">{report.totalPlays.toLocaleString("ru-RU")}</span>
                        <span className="text-slate-400">прослушиваний</span>
                      </div>
                      
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <DollarSign className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                        <span className="text-white font-medium">{report.totalAmount.toFixed(2)} ₽</span>
                      </div>
                      
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-400">{formatDateRu(report.uploadDate)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-shrink-0">
                    <Button
                      variant="success-outline"
                      size="sm"
                      onClick={() => handleDownload(report.id, report.fileName)}
                      className="whitespace-nowrap"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Скачать
                    </Button>
                    {/* Главное действие вида — перенесено с роута-сироты (вопрос №1) */}
                    <Button
                      variant="cta"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => {
                        setAssignFor(report)
                        setSelectedArtist("")
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Назначить
                    </Button>
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      aria-label={`Удалить отчёт ${report.artistName}`}
                      onClick={() => handleDelete(report.id, report.artistName)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

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
    </div>
  )
}
