"use client"

import { useEffect, useState } from 'react'
import { Music, ListMusic, FileText, DollarSign, User, FileCheck, UserPlus, UserMinus, CheckCircle } from 'lucide-react'
import { Activity } from '@/lib/storage'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonRows } from '@/components/ui/skeleton-presets'
import { cn } from '@/lib/utils'

interface ActivityFeedProps {
  userId?: string
  role?: 'artist' | 'admin'
  limit?: number
  compact?: boolean
  /** С сервера (RSC) — без клиентского fetch при первом рендере */
  initialActivities?: Activity[]
}

export function ActivityFeed({ userId, role, limit = 5, compact = false, initialActivities }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>(() => initialActivities ?? [])
  const [loading, setLoading] = useState(initialActivities === undefined)

  useEffect(() => {
    if (initialActivities !== undefined) {
      setActivities(initialActivities)
      setLoading(false)
      return
    }
    loadActivities()
  }, [userId, role, limit, initialActivities])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (role) params.append('role', role)
      params.append('limit', limit.toString())

      const response = await fetch(`/api/activities?${params}`)
      const data = await response.json()

      if (data.success) {
        setActivities(data.activities)
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  /** Icon background style per type */
  const getIconBg = (type: Activity['type']): string => {
    switch (type) {
      case 'release_added': return 'from-blue-900 to-black text-blue-400'
      case 'playlist_found': return 'from-purple-900 to-black text-purple-400'
      case 'report_received': return 'from-emerald-900 to-black text-emerald-400'
      case 'payment_sent': return 'from-yellow-900 to-black text-yellow-400'
      case 'user_data_updated': return 'from-cyan-900 to-black text-cyan-400'
      case 'reports_generated': return 'from-green-900 to-black text-green-400'
      case 'artist_added': return 'from-teal-900 to-black text-teal-400'
      case 'artist_removed': return 'from-red-900 to-black text-red-400'
      case 'release_status_updated': return 'from-indigo-900 to-black text-indigo-400'
      default: return 'from-gray-900 to-black text-gray-400'
    }
  }

  /** Material symbol per type */
  const getIconName = (type: Activity['type']): string => {
    switch (type) {
      case 'release_added': return 'library_music'
      case 'playlist_found': return 'queue_music'
      case 'report_received': return 'analytics'
      case 'payment_sent': return 'currency_ruble'
      case 'user_data_updated': return 'manage_accounts'
      case 'reports_generated': return 'task'
      case 'artist_added': return 'person_add'
      case 'artist_removed': return 'person_remove'
      case 'release_status_updated': return 'new_releases'
      default: return 'info'
    }
  }

  /**
   * Бейдж типа события. F-11: подписи латиницей («RELEASE», «FINANCE») —
   * админ-жаргон в русскоязычном кабинете; цвета прежние.
   */
  const getBadge = (type: Activity['type']): { text: string; classes: string } => {
    switch (type) {
      case 'release_added':
      case 'release_status_updated':
        return { text: 'Релиз', classes: 'bg-green-500/20 text-green-400 border-green-500/20' }
      case 'playlist_found':
        return { text: 'Плейлист', classes: 'bg-purple-500/20 text-purple-400 border-purple-500/20' }
      case 'report_received':
      case 'reports_generated':
        return { text: 'Отчёт', classes: 'bg-blue-500/20 text-blue-400 border-blue-500/20' }
      case 'payment_sent':
        return { text: 'Финансы', classes: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' }
      case 'artist_added':
        return { text: 'Артист', classes: 'bg-teal-500/20 text-teal-400 border-teal-500/20' }
      case 'artist_removed':
        return { text: 'Артист', classes: 'bg-red-500/20 text-red-400 border-red-500/20' }
      case 'user_data_updated':
        return { text: 'Система', classes: 'bg-blue-500/20 text-blue-400 border-blue-500/20' }
      default:
        return { text: 'Система', classes: 'bg-gray-500/20 text-gray-400 border-gray-500/20' }
    }
  }

  /**
   * Вторая строка справа — имя релиза или плейлиста из метаданных.
   *
   * F-29: раньше при пустых метаданных сюда падала подпись типа события
   * («Playlist», «Release»), и тип оказывался написан дважды в одной строке —
   * бейджем и серым текстом. Теперь тип несёт только бейдж, а строка без
   * контекста не рендерится вовсе.
   */
  const secondaryContextLabel = (activity: Activity): string => {
    const m = activity.metadata
    if (m && typeof m.releaseName === 'string' && m.releaseName.trim()) return m.releaseName.trim()
    if (m && typeof m.playlistName === 'string' && m.playlistName.trim()) return m.playlistName.trim()
    return ''
  }

  /** Simplified description for artist role */
  const descriptionForDisplay = (activity: Activity): string => {
    if (role !== 'artist') return activity.description
    let d = activity.description
    d = d.replace(/^Релиз\s+"([^"]+)"\s+добавлен из Koala Music$/i, 'Добавлен релиз "$1"')
    d = d.replace(/^Релиз\s+"([^"]+)"\s+добавлен из Zvonko(\s+Digital)?$/i, 'Добавлен релиз "$1"')
    d = d.replace(/\s+добавлен из Koala Music/i, '')
    d = d.replace(/\s+добавлен из Zvonko(\s+Digital)?/i, '')
    d = d.replace(/^Вручную привязано\s+(\d+)\s+релиз\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Добавлено $1 релиз(ов)')
    d = d.replace(/^Вручную привязано\s+(\d+)\s+отчёт\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Вам назначено $1 отчёт(ов)')
    d = d.replace(/^Вручную привязано\s+(\d+)\s+плейлист\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Добавлено $1 плейлист(ов)')
    d = d.replace(/^Плейлист вручную привязан к артисту\s+"[^"]*"$/i, 'Плейлист добавлен в ваш профиль')
    d = d.replace(/^Автоматически привязано\s+(\d+)\s+релиз\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Добавлено $1 релиз(ов)')
    d = d.replace(/^Автоматически привязано\s+(\d+)\s+отчёт\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Вам назначено $1 отчёт(ов)')
    d = d.replace(/^Автоматически привязано\s+(\d+)\s+плейлист\(ов\)\s+к артисту\s+"[^"]*"$/i, 'Добавлено $1 плейлист(ов)')
    d = d.replace(/^Релиз\s+"([^"]+)"\s+успешно добавлен$/i, 'Добавлен релиз "$1"')
    return d
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'только что'
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays === 1) return '1 день назад'
    if (diffDays < 7) return `${diffDays} дн. назад`
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  }

  if (loading) {
    return <SkeletonRows rows={4} className="p-4" />
  }

  if (activities.length === 0) {
    return <EmptyState className="py-10" icon="inbox" title="Событий пока нет" />
  }

  return (
    <div className="divide-y divide-white/5">
      {activities.map((activity) => {
        const badge = getBadge(activity.type)
        const context = secondaryContextLabel(activity)
        const iconBg = getIconBg(activity.type)
        const iconName = getIconName(activity.type)
        return (
          <div key={activity.id} className="p-4 hover:bg-white/5 transition-colors flex items-start gap-4 group cursor-pointer sm:items-center">
            {/* Icon box — exact match HTML prototype */}
            <div className={`w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative`}>
              <div className={`w-full h-full bg-gradient-to-br ${iconBg} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-xl">{iconName}</span>
              </div>
            </div>

            {/*
              F-78: на 390 бейдж и колонка даты съедали заголовок до ~14 символов.
              До sm заголовок занимает всю ширину строки, а дата с контекстом
              переносится под описание; с sm раскладка прежняя — в один ряд.
            */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-bold text-sm truncate">{activity.title}</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      badge.classes
                    )}
                  >
                    {badge.text}
                  </Badge>
                </div>
                <p className="text-gray-400 text-xs truncate">
                  {descriptionForDisplay(activity)}
                </p>
              </div>

              {/* Metric — right side, same as HTML prototype */}
              <div className="min-w-0 shrink-0 sm:max-w-[36%] sm:text-right">
                <p className="text-white font-mono text-sm truncate">{formatDate(activity.createdAt)}</p>
                {context && (
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider truncate" title={context}>
                    {context}
                  </p>
                )}
              </div>
            </div>

            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-500 group-hover:border-primary/30 group-hover:text-primary transition-colors"
              aria-hidden
            >
              <span className="material-symbols-outlined text-[16px] leading-none">chevron_right</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
