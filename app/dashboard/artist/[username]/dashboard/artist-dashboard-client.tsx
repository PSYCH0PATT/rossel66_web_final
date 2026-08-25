"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ActivityFeed } from "@/components/activity-feed"
import { ARTIST_FEED_VIEW } from "@/lib/activity-views"
import { StreamingChart } from "@/components/streaming-chart-lazy"
import type { Activity } from "@/lib/storage"
import type { ArtistDashboardPayload } from "@/lib/cached-dashboard"
import { formatMoney } from "@/lib/format-money"
import { formatDateRu } from "@/lib/format-date"
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
  /**
   * Когда собраны данные экрана. Считает сервер: `new Date()` в рендере
   * клиента давал hydration-mismatch (тот же баг чинили на админ-дашборде).
   */
  generatedAt: string
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
  generatedAt,
}: Props) {
  const totalEarnings = useMemo(
    () => reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0),
    [reports]
  )
  return (
    <div className="space-y-8">
      {/*
        Метка свежести данных живёт в подписи шапки, а не отдельным блоком
        справа (вердикт 3.2): это уточнение к заголовку, а не действие.
      */}
      <PageHeader
        title="ГЛАВНАЯ"
        subtitle={
          <>
            С возвращением, {artist.name || artist.username}. Кратко, что происходит с вашей
            музыкой сегодня.{" "}
            <span className="whitespace-nowrap text-gray-500">
              Обновлено {formatDateRu(generatedAt)}
            </span>
          </>
        }
      />

      {/* Цифра раздела — вход в этот раздел (вердикт 3.2): «Релизы 5» это
          ссылка, а не подпись. «Заработок» ссылкой не делаем — вердикт
          перечисляет три карточки, и деньгам нужен свой экран-разбор. */}
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 mb-12">
        <StatCard
          label="Релизы"
          value={releaseCount}
          icon="library_music"
          bgIcon="album"
          href={`/dashboard/artist/${username}/releases`}
        />
        <StatCard
          label="Отчёты"
          value={reports.length}
          icon="analytics"
          tone="azure"
          bgIcon="bar_chart"
          href={`/dashboard/artist/${username}/reports`}
        />
        {/* F-16: было «221» без валюты при 220,78 ₽ — точная сумма и знак. */}
        <StatCard
          label="Заработок"
          icon="currency_ruble"
          tone="primary"
          bgIcon="currency_ruble"
          value={<span className="whitespace-nowrap">{formatMoney(totalEarnings)}</span>}
        />
        <StatCard
          label="Плейлисты"
          value={playlistCount}
          icon="queue_music"
          tone="purple"
          bgIcon="playlist_play"
          href={`/dashboard/artist/${username}/playlists`}
        />
      </div>

      {/*
        Главная цифра экрана — стримы, и она стояла справа вторым блоком, а
        первым шла лента событий (вердикт 3.2: «график — первый блок после
        ряда StatCard»). Порядок в разметке = порядок чтения и на 390.
      */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
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
              view={ARTIST_FEED_VIEW}
              initialActivities={initialActivities}
            />
          </div>
        </div>
      </div>

    </div>
  )
}
