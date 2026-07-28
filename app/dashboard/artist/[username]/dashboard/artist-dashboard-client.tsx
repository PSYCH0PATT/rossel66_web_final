"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ActivityFeed } from "@/components/activity-feed"
import { StreamingChart } from "@/components/streaming-chart-lazy"
import type { Activity } from "@/lib/storage"
import type { ArtistDashboardPayload } from "@/lib/cached-dashboard"
import { formatRubKpiShort, formatRubPlain } from "@/lib/format-dashboard-rub"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type StreamDay = { date: string; streams: number }

type Props = {
  username: string
  artist: ArtistDashboardPayload["artist"]
  releaseCount: number
  releasedCount: number
  playlistCount: number
  reports: ArtistDashboardPayload["reports"]
  initialStreamsByDay: StreamDay[]
  initialActivities: Activity[]
}

export default function ArtistDashboardClient({
  username,
  artist,
  releaseCount,
  releasedCount,
  playlistCount,
  reports,
  initialStreamsByDay,
  initialActivities,
}: Props) {
  const totalEarnings = useMemo(
    () => reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0),
    [reports]
  )
  // C5: честные под-метрики для KPI-бейджей (вместо фейковых «+X%»)
  const signedCount = useMemo(
    () => reports.filter((r) => r.isSigned).length,
    [reports]
  )
  const unpaidEarnings = useMemo(
    () => reports.reduce((sum, r) => sum + (r.isPaid ? 0 : r.totalAmount || 0), 0),
    [reports]
  )
  return (
    <div className="max-w-full p-0 pb-6 md:pb-0">
      <div className="mb-6 flex flex-col gap-3 md:mb-8 md:gap-6">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">ГЛАВНАЯ</span>
        </div>
        <div className="flex flex-col items-start gap-4 border-b border-white/5 pb-4 md:flex-row md:items-end md:justify-between md:gap-6 md:pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
              ДАШБОРД
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              С возвращением, {artist.name || artist.username}. Кратко, что происходит с вашей музыкой сегодня.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="text-right hidden md:block">
              <p className="text-xs text-gray-500 font-mono uppercase">Обновлено</p>
              <p className="text-white font-mono text-sm">
                {new Date().toLocaleString("ru-RU", {
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
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 mb-12">
        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-white">album</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 text-white mb-3 border border-white/10">
                <span className="material-symbols-outlined text-xl">library_music</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Релизы</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-white font-display md:text-3xl xl:text-4xl">{releaseCount}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary" title="Доставлено">
                <span className="material-symbols-outlined">check_circle</span> {releasedCount}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#0ea5e9]">bar_chart</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-accent-azure/10 text-accent-azure mb-3 border border-accent-azure/20">
                <span className="material-symbols-outlined text-xl">analytics</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Отчёты</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-white font-display md:text-3xl xl:text-4xl">{reports.length}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--azure" title="Подписано">
                <span className="material-symbols-outlined">task_alt</span> {signedCount}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#10b981]">currency_ruble</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary mb-3 border border-primary/20">
                <span className="material-symbols-outlined text-xl">currency_ruble</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Заработок</h3>
            </div>
            <div className="flex flex-col items-start gap-1 md:flex-row md:items-end md:justify-between md:gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="min-w-0 cursor-default truncate whitespace-nowrap text-2xl font-bold text-white font-display tabular-nums md:text-3xl xl:text-4xl">
                    {formatRubKpiShort(totalEarnings)}
                  </p>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="z-[250] max-w-xs border border-white/10 bg-[rgba(15,15,15,0.96)] px-3 py-2 text-xs font-mono text-white shadow-lg"
                >
                  {formatRubPlain(totalEarnings)}
                </TooltipContent>
              </Tooltip>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary shrink-0" title="К выплате (неоплачено)">
                <span className="material-symbols-outlined">schedule</span> {formatRubKpiShort(unpaidEarnings)}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#c084fc]">playlist_play</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20">
                <span className="material-symbols-outlined text-xl">queue_music</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Плейлисты</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-white font-display md:text-3xl xl:text-4xl">{playlistCount}</p>
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
            {/* G9: раньше href="#" — ссылка вела в никуда, страницы активности у артиста не было */}
            <Link
              className="inline-flex min-h-11 items-center text-xs text-primary hover:text-emerald-300 uppercase tracking-widest font-mono border-b border-primary/30 hover:border-primary transition-all"
              href={`/dashboard/artist/${artist.username}/activity`}
            >
              Все события
            </Link>
          </div>
          <div className="card-glass rounded-2xl overflow-hidden border border-white/5">
            <ActivityFeed
              userId={artist.id}
              role="artist"
              limit={5}
              initialActivities={initialActivities}
            />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-accent-azure rounded-full"></span>
              СТАТИСТИКА СТРИМОВ
            </h2>
          </div>

          <div className="card-glass rounded-2xl flex-1 border border-white/5 p-6 flex flex-col relative min-h-[320px]">
            <StreamingChart
              artistId={artist.id}
              days={30}
              initialStreamsByDay={initialStreamsByDay}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 mb-6 flex justify-between items-center border-t border-white/5 pt-6 text-sm md:mb-0">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse"></span>
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>
    )
}
