"use client"

import { useEffect, useState } from 'react'
import { Music, ListMusic, FileText, DollarSign, User, FileCheck } from 'lucide-react'
import { Activity } from '@/lib/storage'

interface ActivityFeedProps {
  userId?: string
  role?: 'artist' | 'admin'
  limit?: number
  compact?: boolean
}

export function ActivityFeed({ userId, role, limit = 5, compact = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [userId, role, limit])

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

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'release_added':
        return <Music className="h-4 w-4 text-category-blue" />
      case 'playlist_found':
        return <ListMusic className="h-4 w-4 text-category-red" />
      case 'report_received':
        return <FileText className="h-4 w-4 text-category-green" />
      case 'payment_sent':
        return <DollarSign className="h-4 w-4 text-category-amber" />
      case 'user_data_updated':
        return <User className="h-4 w-4 text-category-purple" />
      case 'reports_generated':
        return <FileCheck className="h-4 w-4 text-category-green" />
      default:
        return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'только что'
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'минуту' : diffMins < 5 ? 'минуты' : 'минут'} назад`
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'час' : diffHours < 5 ? 'часа' : 'часов'} назад`
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'} назад`

    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="p-2 rounded-lg bg-gray-700 h-8 w-8" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Пока нет активности
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted flex-shrink-0">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-foreground ${compact ? 'text-sm' : ''}`}>
              {activity.title}
            </p>
            <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'} line-clamp-2`}>
              {activity.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(activity.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

