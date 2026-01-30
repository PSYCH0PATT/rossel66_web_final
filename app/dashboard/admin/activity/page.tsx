"use client"

import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Activity,
  Music,
  ListMusic,
  FileText,
  DollarSign,
  User,
  UserPlus,
  UserMinus,
  CheckCircle,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import type { ActivityType } from '@/lib/storage'

const CATEGORIES = [
  { id: 'all', label: 'Общее', types: undefined },
  { id: 'releases', label: 'Релизы', types: ['release_added', 'release_status_updated'] as ActivityType[] },
  { id: 'playlists', label: 'Плейлисты', types: ['playlist_found'] as ActivityType[] },
  { id: 'reports', label: 'Отчёты', types: ['report_received', 'reports_generated'] as ActivityType[] },
  { id: 'payments', label: 'Выплаты', types: ['payment_sent'] as ActivityType[] },
  { id: 'artists', label: 'Артисты', types: ['artist_added', 'artist_removed', 'user_data_updated'] as ActivityType[] },
]

const TYPE_LABELS: Record<ActivityType, string> = {
  release_added: 'Релиз добавлен',
  playlist_found: 'Плейлист найден',
  report_received: 'Отчёт назначен',
  payment_sent: 'Выплата отправлена',
  user_data_updated: 'Данные артиста обновлены',
  reports_generated: 'Отчёты сгенерированы',
  artist_added: 'Артист добавлен',
  artist_removed: 'Артист удалён',
  release_status_updated: 'Статус релиза обновлён',
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'release_added':
      return <Music className="h-4 w-4 text-category-blue" />
    case 'playlist_found':
      return <ListMusic className="h-4 w-4 text-category-red" />
    case 'report_received':
    case 'reports_generated':
      return <FileText className="h-4 w-4 text-category-green" />
    case 'payment_sent':
      return <DollarSign className="h-4 w-4 text-category-amber" />
    case 'user_data_updated':
      return <User className="h-4 w-4 text-category-purple" />
    case 'artist_added':
      return <UserPlus className="h-4 w-4 text-category-green" />
    case 'artist_removed':
      return <UserMinus className="h-4 w-4 text-category-red" />
    case 'release_status_updated':
      return <CheckCircle className="h-4 w-4 text-category-blue" />
    default:
      return <FileText className="h-4 w-4 text-gray-400" />
  }
}

interface ActivityItem {
  id: string
  type: ActivityType
  userId: string
  userRole: 'artist' | 'admin'
  title: string
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

interface UserOption {
  id: string
  name: string
  username?: string
  role?: string
}

const PAGE_SIZE = 50

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categoryId, setCategoryId] = useState('all')
  const [role, setRole] = useState<string>('admin')
  const [userId, setUserId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [users, setUsers] = useState<UserOption[]>([])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data?.users?.length) {
        setUsers(data.users.map((u: any) => ({ id: u.id, name: u.name || u.username, username: u.username, role: u.role })))
      }
    } catch (e) {
      console.error('Failed to load users:', e)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const loadActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))
      if (role && role !== 'all') params.set('role', role)
      if (userId) params.set('userId', userId)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const cat = CATEGORIES.find(c => c.id === categoryId)
      if (cat?.types?.length) {
        cat.types.forEach(t => params.append('type', t))
      }

      const res = await fetch(`/api/activities?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setActivities(data.activities || [])
        setTotal(data.total ?? data.activities?.length ?? 0)
      }
    } catch (e) {
      console.error('Failed to load activities:', e)
    } finally {
      setLoading(false)
    }
  }, [categoryId, role, userId, dateFrom, dateTo, offset])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const resetOffset = () => setOffset(0)
  const prevPage = () => setOffset(o => Math.max(0, o - PAGE_SIZE))
  const nextPage = () => setOffset(o => o + PAGE_SIZE)
  const hasPrev = offset > 0
  const hasNext = offset + activities.length < total

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const whoLabel = (item: ActivityItem) => {
    if (item.userId === 'system') return 'Система'
    const u = users.find(x => x.id === item.userId)
    return u ? u.name || u.username || item.userId : item.userId
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Активность</h1>

        <Card className="bg-transparent border-slate-600/30 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Вся активность
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-600/50 pb-3">
              {CATEGORIES.map(cat => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? 'default' : 'ghost'}
                  size="sm"
                  className={categoryId === cat.id ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}
                  onClick={() => {
                    setCategoryId(cat.id)
                    resetOffset()
                  }}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Роль</label>
                <Select value={role} onValueChange={v => { setRole(v); resetOffset() }}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="artist">Артист</SelectItem>
                    <SelectItem value="admin">Админ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Пользователь</label>
                <Select value={userId || 'all'} onValueChange={v => { setUserId(v === 'all' ? '' : v); resetOffset() }}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.username || u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Дата от</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); resetOffset() }}
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Дата до</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); resetOffset() }}
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => { setOffset(0); loadActivities() }} className="border-slate-600 text-slate-300">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Обновить
                </Button>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="text-slate-400 py-8">Загрузка...</div>
            ) : activities.length === 0 ? (
              <div className="text-slate-400 py-8 text-center">Нет записей</div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-600/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr>
                        <th className="text-left p-3">Дата / время</th>
                        <th className="text-left p-3">Тип</th>
                        <th className="text-left p-3">Заголовок</th>
                        <th className="text-left p-3">Описание</th>
                        <th className="text-left p-3">Кто</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600/50">
                      {activities.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="p-3 text-slate-300 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0">{getActivityIcon(item.type)}</span>
                              <span className="text-slate-300">{TYPE_LABELS[item.type] || item.type}</span>
                            </div>
                          </td>
                          <td className="p-3 font-medium text-white">{item.title}</td>
                          <td className="p-3 text-slate-400 max-w-xs truncate">{item.description}</td>
                          <td className="p-3 text-slate-300">{whoLabel(item)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>
                    Показано {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!hasPrev} onClick={prevPage} className="border-slate-600 text-slate-300">
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Назад
                    </Button>
                    <Button variant="outline" size="sm" disabled={!hasNext} onClick={nextPage} className="border-slate-600 text-slate-300">
                      Далее
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
