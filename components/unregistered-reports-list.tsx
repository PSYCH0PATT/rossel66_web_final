"use client"

import { useState, useEffect } from "react"
import { formatDateRu } from "@/lib/format-date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText, Loader2, Users, Trash2, Play, DollarSign, Calendar, ChevronDown, ChevronRight } from "lucide-react"

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

export default function UnregisteredReportsList() {
  const [reports, setReports] = useState<UnregisteredReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set())

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
        console.error("Ошибка при загрузке отчетов:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReports()
  }, [])

  const handleDownload = async (reportId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/reports/download/${reportId}`)
      
      if (!response.ok) {
        throw new Error('Ошибка при скачивании файла')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Ошибка при скачивании:', error)
    }
  }

  const handleDelete = async (reportId: string, artistName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить отчет для ${artistName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/reports/delete/${reportId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Ошибка при удалении отчета')
      }

      // Обновляем список отчетов
      setReports(reports.filter(report => report.id !== reportId))
    } catch (error) {
      console.error('Ошибка при удалении:', error)
      alert('Ошибка при удалении отчета')
    }
  }

  const handleDownloadAll = (quarter: string) => {
    window.open(`/api/reports/download-all/${quarter}`, "_blank")
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
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">Загрузка отчетов...</span>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-6">
          <Users className="h-10 w-10 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">
          Отлично! Нет незарегистрированных отчетов
        </h3>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Все отчеты успешно назначены зарегистрированным артистам
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="text-emerald-300 font-medium">Система работает корректно</span>
        </div>
      </div>
    )
  }

  // Группируем отчеты по кварталам
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Незарегистрированные отчеты</h3>
          <p className="text-sm text-slate-400">Отчеты артистов без кабинета</p>
        </div>
        <div className="text-sm text-slate-400">
          Всего: {reports.length} отчетов
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
                    <p className="text-sm text-slate-400">{quarterReports.length} отчетов</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadAll(quarter.split(' ')[0])
                    }}
                    className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-green-300"
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
                  className="flex items-center p-4 rounded-lg bg-transparent border border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/20 transition-all duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-lg mb-2 truncate">
                      {report.artistName}
                    </h4>
                    
                    <div className="flex items-center flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Play className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-white font-medium">{report.totalPlays.toLocaleString()}</span>
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
                  
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id, report.fileName)}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-green-300 whitespace-nowrap"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Скачать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(report.id, report.artistName)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
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
    </div>
  )
}
