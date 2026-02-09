"use client"

import { useState, useEffect } from 'react'
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Clock, Search, Filter, RefreshCw } from 'lucide-react'
// Используем простую таблицу без компонента (если компонент не существует)

interface HistoryRecord {
  id: number
  playlist_url: string
  playlist_name: string
  platform: string
  change_type: 'added' | 'updated' | 'removed' | 'position_changed'
  change_date: string
  artist_name: string | null
  artist_id: string | null
  track_title: string | null
  old_position: number | null
  new_position: number | null
  metadata: any
  created_at: string
}

export default function PlaylistHistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    changeType: 'all',
    artistName: '',
    playlistUrl: ''
  })

  useEffect(() => {
    loadHistory()
  }, [filters])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.changeType !== 'all') params.append('changeType', filters.changeType)
      if (filters.artistName) params.append('artistName', filters.artistName)
      if (filters.playlistUrl) params.append('playlistUrl', filters.playlistUrl)
      params.append('limit', '100')

      const response = await fetch(`/api/playlists/history?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setHistory(data.results || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'added': 'Добавлен',
      'updated': 'Обновлен',
      'removed': 'Удален',
      'position_changed': 'Изменена позиция'
    }
    return labels[type] || type
  }

  const getChangeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'added': 'bg-green-500/20 text-green-400',
      'updated': 'bg-blue-500/20 text-blue-400',
      'removed': 'bg-red-500/20 text-red-400',
      'position_changed': 'bg-yellow-500/20 text-yellow-400'
    }
    return colors[type] || 'bg-gray-500/20 text-gray-400'
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      changeType: 'all',
      artistName: '',
      playlistUrl: ''
    })
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">История изменений плейлистов</h1>
            <p className="text-muted-foreground">
              Отслеживание всех изменений в плейлистах (только для админов)
            </p>
          </div>
        </div>

        {/* Фильтры */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Фильтры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Начальная дата</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Конечная дата</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Тип изменения</label>
                <Select value={filters.changeType} onValueChange={(value) => setFilters({ ...filters, changeType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="added">Добавлен</SelectItem>
                    <SelectItem value="updated">Обновлен</SelectItem>
                    <SelectItem value="removed">Удален</SelectItem>
                    <SelectItem value="position_changed">Изменена позиция</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Артист</label>
                <Input
                  placeholder="Имя артиста"
                  value={filters.artistName}
                  onChange={(e) => setFilters({ ...filters, artistName: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">URL плейлиста</label>
                <Input
                  placeholder="URL плейлиста"
                  value={filters.playlistUrl}
                  onChange={(e) => setFilters({ ...filters, playlistUrl: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={loadHistory} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Сбросить фильтры
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Таблица истории */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              История изменений ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Загрузка...
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет записей в истории
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm whitespace-nowrap">Дата</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm whitespace-nowrap">Тип</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">Плейлист</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm whitespace-nowrap">Платформа</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm whitespace-nowrap">Артист</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">Трек</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm whitespace-nowrap">Позиция</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                            {formatDateTime(record.change_date)}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3">
                          <Badge className={`${getChangeTypeColor(record.change_type)} text-xs`}>
                            {getChangeTypeLabel(record.change_type)}
                          </Badge>
                        </td>
                        <td className="p-2 sm:p-3">
                          <div className="max-w-[120px] sm:max-w-xs truncate text-xs sm:text-sm" title={record.playlist_name}>
                            {record.playlist_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-xs" title={record.playlist_url}>
                            {record.playlist_url}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">{record.platform}</td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">{record.artist_name || '-'}</td>
                        <td className="p-2 sm:p-3">
                          {record.track_title ? (
                            <div className="max-w-[100px] sm:max-w-xs truncate text-xs sm:text-sm" title={record.track_title}>
                              {record.track_title}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">
                          {record.change_type === 'position_changed' && record.old_position !== null && record.new_position !== null ? (
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="text-muted-foreground">{record.old_position}</span>
                              <span>→</span>
                              <span className="font-semibold">{record.new_position}</span>
                            </div>
                          ) : record.new_position !== null ? (
                            record.new_position
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
