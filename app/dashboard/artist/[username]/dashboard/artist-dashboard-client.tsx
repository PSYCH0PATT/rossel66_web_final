"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ActivityFeed } from "@/components/activity-feed"
import { StreamingChart } from "@/components/streaming-chart-lazy"
import type { Activity } from "@/lib/storage"
import type { ArtistDashboardPayload } from "@/lib/cached-dashboard"
import { formatRubKpiShort, formatRubPlain } from "@/lib/format-dashboard-rub"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DashboardFooter } from "@/components/dashboard-footer"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader, SectionHeaderLink } from "@/components/ui/section-header"
import { StatCard } from "@/components/ui/stat-card"

type StreamDay = { date: string; streams: number }

type Props = {
  username: string
  artist: ArtistDashboardPayload["artist"]
  releaseCount: number
  playlistCount: number
  reports: ArtistDashboardPayload["reports"]
  initialStreamsByDay: StreamDay[]
  initialActivities: Activity[]
  /** F-18: окно метрики — то же, что просит страница аналитики. */
  streamWindowDays: number
}

export default function ArtistDashboardClient({
  username,
  artist,
  releaseCount,
  playlistCount,
  reports,
  initialStreamsByDay,
  initialActivities,
  streamWindowDays,
}: Props) {
  const totalEarnings = useMemo(
    () => reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0),
    [reports]
  )
  return (
    <div className="max-w-full p-0 pb-6 md:pb-0">
      <PageHeader
        className="mb-6 pb-4 md:mb-8 md:pb-8"
        title="ГЛАВНАЯ"
        subtitle={`С возвращением, ${artist.name || artist.username}. Кратко, что происходит с вашей музыкой сегодня.`}
        actions={
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
        }
      />

      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 mb-12">
          <StatCard label="Релизы" value={releaseCount} icon="library_music" bgIcon="album" />
          <StatCard
            label="Отчёты"
            value={reports.length}
            icon="analytics"
            tone="azure"
            bgIcon="bar_chart"
          />
          <StatCard
            label="Заработок"
            icon="currency_ruble"
            tone="primary"
            bgIcon="currency_ruble"
            value={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default whitespace-nowrap">
                    {formatRubKpiShort(totalEarnings)}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="z-[250] max-w-xs border border-white/10 bg-surface-dialog/[0.96] px-3 py-2 text-xs font-mono text-white shadow-lg"
                >
                  {formatRubPlain(totalEarnings)}
                </TooltipContent>
              </Tooltip>
            }
          />
          <StatCard
            label="Плейлисты"
            value={playlistCount}
            icon="queue_music"
            tone="purple"
            bgIcon="playlist_play"
          />
        </div>
      </TooltipProvider>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div>
          <SectionHeader
            className="mb-6"
            title="ПОСЛЕДНЯЯ АКТИВНОСТЬ"
            action={
              /* G9: раньше href="#" — ссылка вела в никуда, страницы активности у артиста не было */
              <SectionHeaderLink asChild>
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={`/dashboard/artist/${artist.username}/activity`}
                >
                  Все события
                </Link>
              </SectionHeaderLink>
            }
          />
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
          <SectionHeader className="mb-6" title="СТАТИСТИКА СТРИМОВ" accent="azure" />

          <div className="card-glass rounded-2xl flex-1 border border-white/5 p-6 flex flex-col relative min-h-[320px]">
            <StreamingChart
              artistId={artist.id}
              days={streamWindowDays}
              initialStreamsByDay={initialStreamsByDay}
            />
          </div>
        </div>
      </div>

      <DashboardFooter role="artist" />
    </div>
  )
}
