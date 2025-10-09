"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Eye, FileDown, FileText, Loader2, Play, DollarSign, Calendar, ChevronDown, ChevronRight, Trash2, CheckCircle, XCircle, Filter, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface Report {
  id: string
  artistId?: string
  artistName: string
  quarter: string
  year: number
  fileName: string
  uploadDate: string
  status: "processed" | "pending"
  isRegistered: boolean
  totalPlays: number
  totalAmount: number
  isSigned: boolean
  isPaid: boolean
}

export default function ReportsList() {
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'unsigned' | 'unpaid'>('all')

  const fetchReports = async () => {
    try {
      console.log('🔄 Загружаем отчеты в админской панели...')
      setIsLoading(true)
      const timestamp = Date.now()
      const response = await fetch(`/api/reports/quarters?t=${timestamp}`)
      const data = await response.json()
      console.log('📊 Ответ от /api/reports/quarters:', data)

      if (data.quarters && data.quarters.length > 0) {
        // Загружаем все отчеты для всех кварталов
        const allReports: Report[] = []

        for (const quarter of data.quarters) {
          console.log(`📋 Загружаем отчеты для квартала ${quarter}...`)
          const reportsResponse = await fetch(`/api/reports/list/${quarter}?t=${timestamp}`)
          const reportsResult = await reportsResponse.json()
          console.log(`📋 Ответ от /api/reports/list/${quarter}:`, reportsResult)
          if (reportsResult.reports) {
            console.log(`✅ Добавляем ${reportsResult.reports.length} отчетов для ${quarter}`)
            allReports.push(...reportsResult.reports)
          }
        }

        console.log('Загружено отчетов:', allReports.length)
        console.log('Отчеты с статусами:', allReports.map(r => ({ id: r.id, name: r.artistName, isSigned: r.isSigned, isPaid: r.isPaid })))
        setReports(allReports)
      }
    } catch (error) {
      console.error("Ошибка при загрузке отчетов:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
    
    // Добавляем периодическое обновление каждые 10 секунд для отладки
    const interval = setInterval(fetchReports, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleDownloadReport = (reportId: string) => {
    window.open(`/api/reports/download/${reportId}`, "_blank")
  }

  const handleDownloadAllReports = (quarter: string) => {
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

  const handleDeleteReport = async (reportId: string, artistName: string) => {
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

  const handleStatusUpdate = async (reportId: string, statusType: 'signed' | 'paid', value: boolean) => {
    console.log(`Обновляем статус ${statusType} для отчета ${reportId} на ${value}`)
    
    try {
      const response = await fetch('/api/reports/update-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          statusType,
          value
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при обновлении статуса')
      }

      console.log(`Статус ${statusType} успешно обновлен для отчета ${reportId}`)

      // Обновляем локальное состояние
      setReports(prevReports => prevReports.map(report => {
        if (report.id === reportId) {
          const updatedReport = {
            ...report,
            [statusType === 'signed' ? 'isSigned' : 'isPaid']: value
          }
          console.log(`Локальное состояние обновлено для отчета ${reportId}:`, updatedReport)
          return updatedReport
        }
        return report
      }))
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error)
      alert(`Ошибка при обновлении статуса отчета: ${error instanceof Error ? error.message : String(error)}`)
    }
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 mb-6">
          <FileText className="h-10 w-10 text-blue-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">
          Нет готовых отчетов
        </h3>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Готовые отчеты будут появляться здесь после обработки данных
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <span className="text-blue-300 font-medium">Ожидание отчетов</span>
        </div>
      </div>
    )
  }

  // Фильтруем отчеты по выбранному фильтру
  const filteredReports = reports.filter(report => {
    switch (filter) {
      case 'unsigned':
        return !report.isSigned
      case 'unpaid':
        return !report.isPaid
      default:
        return true
    }
  })

  // Группируем отфильтрованные отчеты по кварталам
  const reportsByQuarter = filteredReports.reduce((acc, report) => {
    const key = `${report.quarter} ${report.year}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(report)
    return acc
  }, {} as Record<string, Report[]>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Готовые отчеты</h3>
          <p className="text-sm text-slate-400">Отчеты зарегистрированных артистов</p>
        </div>
        <div className="text-sm text-slate-400">
          Показано: {filteredReports.length} из {reports.length} отчетов
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-slate-400" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('all')}
          style={{
            backgroundColor: filter === 'all' ? '#3b82f6' : 'transparent',
            borderColor: filter === 'all' ? '#3b82f6' : '#64748b',
            color: filter === 'all' ? 'white' : '#cbd5e1'
          }}
          onMouseEnter={(e) => {
            if (filter !== 'all') {
              e.currentTarget.style.backgroundColor = '#334155'
              e.currentTarget.style.color = 'white'
            }
          }}
          onMouseLeave={(e) => {
            if (filter !== 'all') {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#cbd5e1'
            }
          }}
        >
          Все отчеты
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('unsigned')}
          style={{
            backgroundColor: filter === 'unsigned' ? '#ef4444' : 'transparent',
            borderColor: filter === 'unsigned' ? '#ef4444' : '#64748b',
            color: filter === 'unsigned' ? 'white' : '#cbd5e1'
          }}
          onMouseEnter={(e) => {
            if (filter !== 'unsigned') {
              e.currentTarget.style.backgroundColor = '#334155'
              e.currentTarget.style.color = 'white'
            }
          }}
          onMouseLeave={(e) => {
            if (filter !== 'unsigned') {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#cbd5e1'
            }
          }}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Неподписанные ({reports.filter(r => !r.isSigned).length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter('unpaid')}
          style={{
            backgroundColor: filter === 'unpaid' ? '#f97316' : 'transparent',
            borderColor: filter === 'unpaid' ? '#f97316' : '#64748b',
            color: filter === 'unpaid' ? 'white' : '#cbd5e1'
          }}
          onMouseEnter={(e) => {
            if (filter !== 'unpaid') {
              e.currentTarget.style.backgroundColor = '#334155'
              e.currentTarget.style.color = 'white'
            }
          }}
          onMouseLeave={(e) => {
            if (filter !== 'unpaid') {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#cbd5e1'
            }
          }}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Невыплаченные ({reports.filter(r => !r.isPaid).length})
        </Button>
        
      </div>

      {filteredReports.length === 0 ? (
        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">
            {filter === 'unsigned' ? 'Нет неподписанных отчетов' : 
             filter === 'unpaid' ? 'Нет невыплаченных отчетов' : 
             'Нет отчетов'}
          </h3>
          <p className="text-slate-400">
            {filter === 'unsigned' ? 'Все отчеты подписаны' : 
             filter === 'unpaid' ? 'Все отчеты выплачены' : 
             'Отчеты появятся после обработки'}
          </p>
        </Card>
      ) : (
        Object.entries(reportsByQuarter).map(([quarter, quarterReports]) => {
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
                      handleDownloadAllReports(quarter.split(' ')[0])
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
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                          {report.artistName.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-lg mb-2 truncate">
                            {report.artistName}
                          </h4>
                          
                          <div className="flex items-center flex-wrap gap-4 text-sm mb-3">
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
                              <span className="text-slate-400">{new Date(report.uploadDate).toLocaleDateString('ru-RU')}</span>
                            </div>
                          </div>
                          
                          {/* Админские контролы статусов */}
                          <div className="flex items-center flex-wrap gap-6 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {report.isSigned ? (
                                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                )}
                                <Label htmlFor={`signed-${report.id}`} className="text-slate-300 whitespace-nowrap">
                                  Подписан
                                </Label>
                              </div>
                              <Switch
                                id={`signed-${report.id}`}
                                checked={report.isSigned}
                                onCheckedChange={(checked) => handleStatusUpdate(report.id, 'signed', checked)}
                                style={{
                                  backgroundColor: report.isSigned ? '#10b981' : '#475569',
                                  border: '1px solid #64748b'
                                }}
                              />
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {report.isPaid ? (
                                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                )}
                                <Label htmlFor={`paid-${report.id}`} className="text-slate-300 whitespace-nowrap">
                                  Выплачено
                                </Label>
                              </div>
                              <Switch
                                id={`paid-${report.id}`}
                                checked={report.isPaid}
                                onCheckedChange={(checked) => handleStatusUpdate(report.id, 'paid', checked)}
                                style={{
                                  backgroundColor: report.isPaid ? '#10b981' : '#475569',
                                  border: '1px solid #64748b'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(report.id)}
                          className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-green-300 whitespace-nowrap"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Скачать
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id, report.artistName)}
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
      }))}
    </div>
  )
}
