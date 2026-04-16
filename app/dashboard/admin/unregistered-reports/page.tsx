"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

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
      if (data.success) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error("Ошибка при загрузке отчетов:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadArtists = async () => {
    try {
      const response = await fetch("/api/artists")
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
      console.error("Ошибка при назначении отчета:", error)
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
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="inline-block size-8 border-2 border-primary/30 border-t-primary rounded-full motion-safe:animate-spin" aria-hidden />
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Незарегистрированные отчёты</span>
          </div>
          <div className="border-b border-white/5 pb-8 flex flex-col sm:flex-row items-start sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">
                Отчёты без кабинета
              </h1>
              <p className="text-sm text-gray-400 font-light mt-2">
                Назначение вручную зарегистрированным артистам
              </p>
            </div>
            <Link
              href="/dashboard/admin/dashboard"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase text-gray-500 hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              К панели
            </Link>
          </div>
        </div>

        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
              banner.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
            role="status"
          >
            <span className="material-symbols-outlined flex-shrink-0">{banner.type === "ok" ? "check_circle" : "error"}</span>
            {banner.text}
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="ml-auto text-gray-500 hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Закрыть"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="card-glass rounded-2xl border border-white/5 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-gray-600 block mb-4">description</span>
            <h3 className="text-lg font-medium text-white mb-2">Нет таких отчётов</h3>
            <p className="text-gray-500 text-sm font-mono mb-6">Все отчёты назначены</p>
            <Button asChild className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold">
              <Link href="/dashboard/admin/dashboard">На панель</Link>
            </Button>
          </div>
        ) : (
          <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6 overflow-hidden">
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              Список ({reports.length})
            </h2>
            <div className="rounded-xl border border-white/10 overflow-x-auto table-glass">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-xs font-mono uppercase text-gray-500">Артист</TableHead>
                    <TableHead className="text-xs font-mono uppercase text-gray-500">Период</TableHead>
                    <TableHead className="text-xs font-mono uppercase text-gray-500 [font-variant-numeric:tabular-nums]">
                      Прослушивания
                    </TableHead>
                    <TableHead className="text-xs font-mono uppercase text-gray-500">Сумма</TableHead>
                    <TableHead className="text-xs font-mono uppercase text-gray-500">Дата</TableHead>
                    <TableHead className="text-xs font-mono uppercase text-gray-500 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id} className="border-white/5 hover:bg-white/[0.04]">
                      <TableCell className="font-medium text-white max-w-[180px]">
                        <span className="truncate block">{report.artistName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="release-status-badge text-[0.65rem] border border-white/15 text-gray-300 bg-white/5">
                          {report.quarter} {report.year}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-300 [font-variant-numeric:tabular-nums]">
                        {report.totalPlays.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="font-display text-primary [font-variant-numeric:tabular-nums]">
                        {formatCurrency(report.totalAmount)}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm [font-variant-numeric:tabular-nums]">
                        {formatDate(report.uploadDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                            onClick={() => window.open(`/api/reports/download/${report.id}`, "_blank")}
                          >
                            <span className="material-symbols-outlined text-base mr-1">download</span>
                            Скачать
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold"
                            onClick={() => {
                              setAssignFor(report)
                              setSelectedArtist("")
                            }}
                          >
                            <span className="material-symbols-outlined text-base mr-1">person_add</span>
                            Назначить
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <footer className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Назначить отчёт</DialogTitle>
            <DialogDescription className="text-gray-400">
              {assignFor ? `Отчёт: ${assignFor.artistName} — ${assignFor.quarter} ${assignFor.year}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-mono uppercase text-gray-500 block">Артист</label>
            <Select value={selectedArtist} onValueChange={setSelectedArtist}>
              <SelectTrigger className="rounded-lg border-white/10 bg-white/5 text-white">
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
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setAssignFor(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-primary text-black hover:bg-primary/90"
              onClick={() => void handleAssignReport()}
              disabled={!selectedArtist}
            >
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
