"use client"

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatDayMonthUtc } from "@/lib/format-date"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { chartXAxisProps, chartYAxisProps } from "@/components/charts/chart-axis"
import { STREAM_CHART_COLORS } from "@/lib/chart-colors"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { SkeletonValue } from "@/components/ui/skeleton-presets"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

interface StreamPoint {
  date: string
  streams: number
}

interface StreamingChartProps {
  artistId?: string
  days?: number
  /** Если передан с сервера — клиент не делает повторный fetch */
  initialStreamsByDay?: StreamPoint[]
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

/** A8: подпись дня в UTC — дата точки календарная, локальный getDate() сдвигал ось */
const formatDate = formatDayMonthUtc

function statsFromSortedPoints(sorted: StreamPoint[]) {
  const totalStreams = sorted.reduce((s, p) => s + p.streams, 0)
  let change = 0
  if (sorted.length >= 2) {
    const half = Math.floor(sorted.length / 2)
    const first = sorted.slice(0, half).reduce((s, p) => s + p.streams, 0)
    const second = sorted.slice(half).reduce((s, p) => s + p.streams, 0)
    change = first > 0 ? ((second - first) / first) * 100 : 0
  }
  return { totalStreams, change }
}

export function StreamingChart({ artistId, days = 30, initialStreamsByDay }: StreamingChartProps) {
  const isMobile = useMobileDetector()
  const sortedInitial = initialStreamsByDay
    ? [...initialStreamsByDay].sort((a, b) => a.date.localeCompare(b.date))
    : []
  const initialStats =
    initialStreamsByDay !== undefined ? statsFromSortedPoints(sortedInitial) : { totalStreams: 0, change: 0 }

  const [points, setPoints] = useState<StreamPoint[]>(sortedInitial)
  const [loading, setLoading] = useState(initialStreamsByDay === undefined)
  const [total, setTotal] = useState(initialStats.totalStreams)
  const [change, setChange] = useState(initialStats.change)

  useEffect(() => {
    if (initialStreamsByDay !== undefined) {
      const sorted = [...initialStreamsByDay].sort((a, b) => a.date.localeCompare(b.date))
      const { totalStreams, change: ch } = statsFromSortedPoints(sorted)
      setPoints(sorted)
      setTotal(totalStreams)
      setChange(ch)
      setLoading(false)
      return
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, days, initialStreamsByDay])

  async function load() {
    try {
      setLoading(true)
      const end = new Date()
      const start = new Date()
      start.setDate(end.getDate() - days)

      const params = new URLSearchParams({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      })
      if (artistId) params.append('artistId', artistId)

      const res = await fetch(`/api/analytics/streams?${params}`)
      const json = await res.json()

      if (!json.success) throw new Error(json.error)

      // json.data is the analytics object from getStreamAnalytics
      // streamsByDay is Array<{date: string, streams: number}>
      const streamsByDay: StreamPoint[] = json.data?.streamsByDay ?? []
      const sorted = [...streamsByDay].sort((a, b) => a.date.localeCompare(b.date))

      const { totalStreams, change: ch } = statsFromSortedPoints(sorted)
      setTotal(totalStreams)
      setChange(ch)
      setPoints(sorted)
    } catch (e) {
      console.error('StreamingChart:', e)
      setPoints([])
    } finally {
      setLoading(false)
    }
  }

  const changePositive = change >= 0
  const changeStr = `${changePositive ? '+' : ''}${change.toFixed(1)}%`

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-[280px]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Прослушивания за месяц</p>
            <SkeletonValue />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Spinner label="Загрузка…" />
        </div>
      </div>
    )
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-[280px]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Прослушивания за месяц</p>
            <h3 className="text-3xl font-display font-bold text-white">—</h3>
          </div>
        </div>
        <EmptyState
          className="flex-1 py-0"
          icon="bar_chart"
          title="Нет данных аналитики"
          description="Импортируйте CSV, чтобы увидеть прослушивания"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[280px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Всего прослушиваний</p>
          <h3 className="text-3xl font-display font-bold text-white leading-none">
            {formatNum(total)}
            <span className={`text-sm font-sans font-normal ml-2 ${changePositive ? 'text-primary' : 'text-red-400'}`}>
              {changeStr}
            </span>
          </h3>
        </div>
      </div>

      {/* Recharts Area Chart - matches HTML prototype design */}
      <div className="flex-1 min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="streamGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STREAM_CHART_COLORS.line} stopOpacity={0.25} />
                <stop offset="95%" stopColor={STREAM_CHART_COLORS.line} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              {...chartXAxisProps({ mobile: isMobile })}
            />
            <YAxis {...chartYAxisProps()} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(l) => formatDate(String(l))} />}
              cursor={{ stroke: STREAM_CHART_COLORS.tooltipBorder, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="streams"
              stroke={STREAM_CHART_COLORS.line}
              strokeWidth={2.5}
              fill="url(#streamGradient)"
              dot={false}
              activeDot={{ r: 4, fill: STREAM_CHART_COLORS.line, stroke: STREAM_CHART_COLORS.activeDotStroke, strokeWidth: 2 }}
              isAnimationActive={false}
              style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
