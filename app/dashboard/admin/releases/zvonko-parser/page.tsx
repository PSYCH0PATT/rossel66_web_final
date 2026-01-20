"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  RefreshCw, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  Music,
  Link as LinkIcon,
  Barcode,
  Download,
  Settings
} from "lucide-react"
import Link from "next/link"

interface ParseStats {
  total: number
  added: number
  updated: number
  skipped: number
  errors: string[]
}

interface ParserStatus {
  lastRun: string
  success: boolean
  stats: ParseStats
  message: string
  pagesProcessed?: number
  totalPages?: number
}

interface ZvonkoRelease {
  id: string
  title: string
  artist: string
  cover: string
  upc: string
  label: string
  date: string
  territories: string
  platforms: string
  genre: string
  page: number
  position_on_page: number
  status: string
  parsed_at: string
}

export default function ZvonkoParserPage() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [lastReleases, setLastReleases] = useState<ZvonkoRelease[]>([])
  const [pagesToParse, setPagesToParse] = useState<number>(1)
  const [selectedAction, setSelectedAction] = useState<'parse' | 'compare' | 'add'>('parse')

  // Загрузка статуса при монтировании
  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/zvonko-parser')
      const data = await response.json()
      
      if (data.success && data.status) {
        setStatus(data.status)
      }
      
      if (data.releases) {
        setLastReleases(data.releases)
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const runParser = async () => {
    setIsRunning(true)
    
    try {
      const response = await fetch('/api/zvonko-parser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: selectedAction,
          pagesToParse: pagesToParse
        })
      })
      const data = await response.json()
      
      if (data.success) {
        setStatus({
          lastRun: new Date().toISOString(),
          success: true,
          stats: data.stats,
          message: data.message,
          pagesProcessed: data.pagesProcessed,
          totalPages: data.totalPages
        })
        
        if (data.releases) {
          setLastReleases(data.releases)
        }
      } else {
        setStatus({
          lastRun: new Date().toISOString(),
          success: false,
          stats: data.stats || { total: 0, added: 0, updated: 0, skipped: 0, errors: [data.error || 'Неизвестная ошибка'] },
          message: data.error || 'Ошибка парсинга'
        })
      }
    } catch (error) {
      console.error('Ошибка запуска парсера:', error)
      setStatus({
        lastRun: new Date().toISOString(),
        success: false,
        stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [String(error)] },
        message: 'Ошибка подключения к серверу'
      })
    } finally {
      setIsRunning(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Status badge colors
  const statusColors: Record<string, string> = {
    "Новый": "bg-blue-500 text-white",
    "На модерации": "bg-orange-500 text-white",
    "Одобрен": "bg-green-500 text-white",
    "Отклонён": "bg-red-500 text-white",
    "В доставке": "bg-purple-500 text-white",
    "Доставлен": "bg-green-500 text-white",
    "Снят": "bg-gray-500 text-white",
  }

  if (isLoading) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-400" />
          <span className="ml-2 text-green-400">Загрузка...</span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/releases">
              <Button
                variant="outline"
                size="sm"
                style={{
                  borderColor: '#64748b',
                  color: '#cbd5e1',
                  backgroundColor: 'transparent'
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к релизам
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">Zvonko Digital Parser</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Настройки парсера */}
            <div className="flex items-center gap-2 p-2 border border-slate-600 rounded-lg bg-slate-800">
              <Label htmlFor="pages" className="text-slate-300 text-sm">Страниц:</Label>
              <Input
                id="pages"
                type="number"
                min="1"
                max="50"
                value={pagesToParse}
                onChange={(e) => setPagesToParse(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-center border-slate-600 bg-slate-700 text-white"
                disabled={isRunning}
              />
            </div>
            
            <div className="flex items-center gap-2 p-2 border border-slate-600 rounded-lg bg-slate-800">
              <Label htmlFor="action" className="text-slate-300 text-sm">Действие:</Label>
              <select
                id="action"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as 'parse' | 'compare' | 'add')}
                className="h-8 border border-slate-600 bg-slate-700 text-white rounded px-2 text-sm"
                disabled={isRunning}
              >
                <option value="parse">Парсинг</option>
                <option value="compare">Сравнение</option>
                <option value="add">Добавление</option>
              </select>
            </div>
            
            <Button
              onClick={runParser}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {selectedAction === 'parse' ? 'Парсинг...' : selectedAction === 'compare' ? 'Сравнение...' : 'Добавление...'}
                </>
              ) : (
                <>
                  {selectedAction === 'parse' && <Download className="h-4 w-4 mr-2" />}
                  {selectedAction === 'compare' && <RefreshCw className="h-4 w-4 mr-2" />}
                  {selectedAction === 'add' && <Play className="h-4 w-4 mr-2" />}
                  {selectedAction === 'parse' ? 'Запустить парсинг' : selectedAction === 'compare' ? 'Сравнить с системой' : 'Добавить новые'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Последний запуск</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <span className="text-lg font-semibold text-white">
                  {status?.lastRun ? formatDate(status.lastRun) : 'Никогда'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Статус</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {status?.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : status?.lastRun ? (
                  <XCircle className="h-5 w-5 text-red-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                )}
                <span className={`text-lg font-semibold ${status?.success ? 'text-green-400' : status?.lastRun ? 'text-red-400' : 'text-yellow-400'}`}>
                  {status?.success ? 'Успешно' : status?.lastRun ? 'Ошибка' : 'Не запускался'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Найдено</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-400" />
                <span className="text-lg font-semibold text-white">
                  {status?.stats?.total || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Добавлено</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Music className="h-5 w-5 text-green-400" />
                <span className="text-lg font-semibold text-white">
                  {status?.stats?.added || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Страниц</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-400" />
                <span className="text-lg font-semibold text-white">
                  {status?.pagesProcessed || 0}/{status?.totalPages || pagesToParse}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Информация о парсере */}
        <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Информация о парсере
            </CardTitle>
            <CardDescription className="text-slate-400">
              Zvonko Digital - платформа для дистрибуции музыки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="text-white font-medium">Парсинг</h4>
                <p className="text-sm text-slate-300">
                  Извлечение данных о релизах из Zvonko Digital
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Download className="h-3 w-3" />
                  <span>Название, артист, UPC, обложка, даты</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-white font-medium">Сравнение</h4>
                <p className="text-sm text-slate-300">
                  Сравнение спарсенных данных с существующими релизами
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="h-3 w-3" />
                  <span>Поиск дубликатов по UPC и названиям</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-white font-medium">Добавление</h4>
                <p className="text-sm text-slate-300">
                  Добавление новых релизов в систему
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Play className="h-3 w-3" />
                  <span>Автоматическое создание треков и ISRC</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Информация о расписании */}
        <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
          <CardHeader>
            <CardTitle className="text-white">Расписание автоматического парсинга</CardTitle>
            <CardDescription className="text-slate-400">
              Парсер автоматически запускается по расписанию
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="h-5 w-5 text-green-400" />
                <span>12:00 (полдень)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="h-5 w-5 text-green-400" />
                <span>20:00 (вечер)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Сообщение о результате */}
        {status?.message && (
          <Card className={`border-slate-700 ${status.success ? 'border-green-600' : 'border-red-600'}`} style={{ backgroundColor: '#1a1d24' }}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                {status.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${status.success ? 'text-green-400' : 'text-red-400'}`}>
                    {status.message}
                  </p>
                  {status.stats && (
                    <p className="text-sm text-slate-400 mt-1">
                      Всего: {status.stats.total} | Добавлено: {status.stats.added} | Обновлено: {status.stats.updated} | Пропущено: {status.stats.skipped}
                    </p>
                  )}
                  {status.pagesProcessed && (
                    <p className="text-sm text-slate-400 mt-1">
                      Обработано страниц: {status.pagesProcessed}/{status.totalPages || pagesToParse}
                    </p>
                  )}
                  {status.stats?.errors && status.stats.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-400">
                      {status.stats.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Таблица последних спарсенных релизов */}
        {lastReleases.length > 0 && (
          <Card className="border-slate-700" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader>
              <CardTitle className="text-white">Последние обработанные релизы</CardTitle>
              <CardDescription className="text-slate-400">
                Релизы из последнего запуска парсера
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-slate-800">
                      <TableHead className="text-slate-300">Название</TableHead>
                      <TableHead className="text-slate-300">Артист</TableHead>
                      <TableHead className="text-slate-300">Статус</TableHead>
                      <TableHead className="text-slate-300">UPC</TableHead>
                      <TableHead className="text-slate-300">Жанр</TableHead>
                      <TableHead className="text-slate-300">Площадки</TableHead>
                      <TableHead className="text-slate-300">Дата</TableHead>
                      <TableHead className="text-slate-300">Стр.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastReleases.map((release) => (
                      <TableRow 
                        key={release.id}
                        className="border-slate-700 hover:bg-slate-800"
                      >
                        <TableCell className="text-white font-medium">
                          <div className="flex items-center gap-2">
                            {release.cover && (
                              <img 
                                src={release.cover} 
                                alt={release.title}
                                className="w-8 h-8 rounded object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                            {release.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.artist}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[release.status] || 'bg-gray-500 text-white'}>
                            {release.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.upc ? (
                            <div className="flex items-center gap-1">
                              <Barcode className="h-4 w-4 text-green-400" />
                              {release.upc}
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.genre || (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.platforms ? (
                            <Badge variant="outline" className="text-xs">
                              {release.platforms}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.date || '—'}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          <Badge variant="secondary" className="text-xs">
                            {release.page}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
