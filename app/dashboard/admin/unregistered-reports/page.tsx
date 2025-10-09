"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, UserPlus, FileText, ArrowLeft } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
  const [selectedReport, setSelectedReport] = useState<UnregisteredReport | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string>("")

  useEffect(() => {
    loadReports()
    loadArtists()
  }, [])

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports/unregistered')
      const data = await response.json()
      if (data.success) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Ошибка при загрузке отчетов:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadArtists = async () => {
    try {
      const response = await fetch('/api/artists')
      const data = await response.json()
      if (data.success) {
        setArtists(data.artists)
      }
    } catch (error) {
      console.error('Ошибка при загрузке артистов:', error)
    }
  }

  const handleAssignReport = async () => {
    if (!selectedReport || !selectedArtist) return

    try {
      const response = await fetch('/api/reports/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          artistId: selectedArtist,
        }),
      })

      const data = await response.json()
      if (data.success) {
        // Обновляем список отчетов
        setReports(reports.filter(report => report.id !== selectedReport.id))
        setSelectedReport(null)
        setSelectedArtist("")
        alert('Отчет успешно назначен артисту!')
      } else {
        alert('Ошибка при назначении отчета: ' + data.error)
      }
    } catch (error) {
      console.error('Ошибка при назначении отчета:', error)
      alert('Ошибка при назначении отчета')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка отчетов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/dashboard">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Назад к панели
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Отчеты артистов без кабинета</h1>
          <p className="text-gray-600 mt-2">
            Отчеты, которые не могут быть автоматически назначены зарегистрированным артистам
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет незарегистрированных отчетов</h3>
            <p className="text-gray-600 mb-4">
              Все отчеты успешно назначены зарегистрированным артистам
            </p>
            <Link href="/dashboard/admin/dashboard">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Вернуться к панели
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Список незарегистрированных отчетов</CardTitle>
            <CardDescription>
              Назначьте отчеты артистам или создайте новые кабинеты
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Артист</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Прослушивания</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Дата загрузки</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.artistName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {report.quarter} {report.year}
                      </Badge>
                    </TableCell>
                    <TableCell>{report.totalPlays.toLocaleString()}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(report.totalAmount)}
                    </TableCell>
                    <TableCell>{formatDate(report.uploadDate)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/reports/download/${report.id}`, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Скачать
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setSelectedReport(report)}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Назначить
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Назначить отчет артисту</DialogTitle>
                              <DialogDescription>
                                Выберите артиста для назначения отчета "{report.artistName}"
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Выберите артиста:
                                </label>
                                <Select value={selectedArtist} onValueChange={setSelectedArtist}>
                                  <SelectTrigger>
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
                              <div className="flex justify-end space-x-2">
                                <Button variant="outline" onClick={() => setSelectedReport(null)}>
                                  Отмена
                                </Button>
                                <Button
                                  onClick={handleAssignReport}
                                  disabled={!selectedArtist}
                                >
                                  Назначить
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
