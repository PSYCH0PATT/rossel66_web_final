"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  Barcode
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
}

interface KoalaRelease {
  koala_id: string
  title: string
  artist: string
  status: string
  release_date: string | null
  upc: string | null
  bandlink_url: string | null
  cover_url: string | null
  isrc_codes: string[]
  parsed_at: string
}

export default function KoalaParserPage() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [lastReleases, setLastReleases] = useState<KoalaRelease[]>([])

  // Загрузка статуса при монтировании
  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/koala-parser')
      const data = await response.json()
      
      if (data.success && data.status) {
        setStatus(data.status)
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
      const response = await fetch('/api/koala-parser', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setStatus({
          lastRun: new Date().toISOString(),
          success: true,
          stats: data.stats,
          message: data.message
        })
        
        if (data.releases) {
          setLastReleases(data.releases)
        }
      } else {
        setStatus({
          lastRun: new Date().toISOString(),
          success: false,
          stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [data.error || 'Неизвестная ошибка'] },
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
    "На модерации": "bg-orange-500 text-white",
    "Одобрен": "bg-blue-500 text-white",
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
            <h1 className="text-2xl font-bold text-white">Koala Music Parser</h1>
          </div>
          
          <Button
            onClick={runParser}
            disabled={isRunning}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Парсинг...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Запустить парсинг
              </>
            )}
          </Button>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CardDescription className="text-slate-400">Обновлено</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-400" />
                <span className="text-lg font-semibold text-white">
                  {status?.stats?.updated || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <CardTitle className="text-white">Последние спарсенные релизы</CardTitle>
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
                      <TableHead className="text-slate-300">BandLink</TableHead>
                      <TableHead className="text-slate-300">Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastReleases.map((release) => (
                      <TableRow 
                        key={release.koala_id}
                        className="border-slate-700 hover:bg-slate-800"
                      >
                        <TableCell className="text-white font-medium">
                          {release.title}
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
                        <TableCell>
                          {release.bandlink_url ? (
                            <a 
                              href={release.bandlink_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                            >
                              <LinkIcon className="h-4 w-4" />
                              BandLink
                            </a>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {release.release_date || '—'}
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


