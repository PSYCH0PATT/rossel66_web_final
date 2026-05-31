"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ActivityFeed } from "@/components/activity-feed"
import { StreamingChart } from "@/components/streaming-chart-lazy"
import type { Activity } from "@/lib/storage"
import type { AdminDashboardPayload } from "@/lib/cached-dashboard"
import { formatRubExact, formatRubKpiShort } from "@/lib/format-dashboard-rub"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type StreamDay = { date: string; streams: number }

type Payment = AdminDashboardPayload["payments"][number]

type Props = {
  artistCount: number
  releaseCount: number
  pendingReleases: number
  reportCount: number
  payments: Payment[]
  reports: AdminDashboardPayload["reports"]
  initialStreamsByDay: StreamDay[]
  initialActivities: Activity[]
}

export default function AdminDashboardClient({
  artistCount,
  releaseCount,
  pendingReleases,
  reportCount,
  payments,
  reports,
  initialStreamsByDay,
  initialActivities,
}: Props) {
  const router = useRouter()

  const metrics = useMemo(() => {
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const pendingPayments = payments.filter((p) => !p.isPaid).length

    return {
      artistCount,
      releaseCount,
      reportCount,
      pendingReleases,
      totalPayments,
      pendingPayments,
    }
  }, [artistCount, releaseCount, reportCount, pendingReleases, payments])

  return (
    <>
    <div className="mb-8 flex flex-col gap-3 md:mb-12 md:gap-6">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <span className="hover:text-primary cursor-pointer transition-colors">ДАШБОРД</span>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-white">Обзор</span>
        </div>
        <div className="flex flex-col items-start gap-4 border-b border-white/5 pb-4 md:flex-row md:items-end md:justify-between md:gap-6 md:pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 tracking-tight uppercase">
              ДАШБОРД
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Панель управления лейблом. Обзор текущих метрик и недавней активности.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest border border-white/10 rounded-lg px-3 py-2"
            >
              Обновить данные
            </button>
            <div className="text-right hidden md:block">
              <p className="text-xs text-gray-500 font-mono uppercase">Last Updated</p>
              <p className="text-white font-mono text-sm">
                {new Date().toLocaleString("en-GB", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-white">groups</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 text-white mb-3 border border-white/10">
                <span className="material-symbols-outlined text-xl">person</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Артисты</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-bold text-white font-display">{metrics.artistCount}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary">
                +2 <span className="material-symbols-outlined">arrow_upward</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#0ea5e9]">album</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-accent-azure/10 text-accent-azure mb-3 border border-accent-azure/20">
                <span className="material-symbols-outlined text-xl">library_music</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Релизы</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-bold text-white font-display">{metrics.releaseCount}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--azure">
                +{metrics.pendingReleases} <span className="material-symbols-outlined">trending_up</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#10b981]">bar_chart</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary mb-3 border border-primary/20">
                <span className="material-symbols-outlined text-xl">description</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Отчеты</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-bold text-white font-display">{metrics.reportCount}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary">
                +4 <span className="material-symbols-outlined">arrow_upward</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#c084fc]">currency_ruble</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20">
                <span className="material-symbols-outlined text-xl">currency_ruble</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Выплаты</h3>
            </div>
            <div className="flex items-end justify-between gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="min-w-0 cursor-default truncate whitespace-nowrap text-4xl font-bold text-white font-display tabular-nums">
                    {formatRubKpiShort(metrics.totalPayments)}
                  </p>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="z-[250] max-w-xs border border-white/10 bg-[rgba(15,15,15,0.96)] px-3 py-2 text-xs font-mono text-white shadow-lg"
                >
                  {formatRubExact(metrics.totalPayments)}
                </TooltipContent>
              </Tooltip>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--purple shrink-0">
                +{metrics.pendingPayments} <span className="material-symbols-outlined">add</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      </TooltipProvider>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              ПОСЛЕДНЯЯ АКТИВНОСТЬ
            </h2>
            <Link
              className="text-xs text-primary hover:text-emerald-300 uppercase tracking-widest font-mono border-b border-primary/30 pb-0.5 hover:border-primary transition-all"
              href="/dashboard/admin/activity"
            >
              View All
            </Link>
          </div>
          <div className="card-glass rounded-2xl overflow-hidden border border-white/5">
            <ActivityFeed role="admin" limit={5} initialActivities={initialActivities} />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-accent-azure rounded-full"></span>
              СТАТИСТИКА СТРИМОВ
            </h2>
            <div className="flex gap-4">
              <span className="flex items-center text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span> Current
              </span>
              <span className="flex items-center text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-accent-azure mr-2"></span> Target
              </span>
            </div>
          </div>

          <div className="card-glass rounded-2xl flex-1 border border-white/5 p-8 flex flex-col relative min-h-[360px]">
            <StreamingChart days={30} initialStreamsByDay={initialStreamsByDay} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center text-sm border-t border-white/5 pt-6">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse"></span>
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
      </div>
    </>
  )
}
