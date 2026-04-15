"use client"

import { useMemo } from "react"
import Layout from "@/components/layout"
import Link from "next/link"
import { ActivityFeed } from "@/components/activity-feed"
import { StreamingChart } from "@/components/streaming-chart"
import type { Activity } from "@/lib/storage"
import type { ArtistDashboardPayload } from "@/lib/cached-dashboard"
import type { Release } from "@/lib/data"

type StreamDay = { date: string; streams: number }

type Props = {
  username: string
  artist: ArtistDashboardPayload["artist"]
  releases: Release[]
  reports: ArtistDashboardPayload["reports"]
  playlists: ArtistDashboardPayload["playlists"]
  initialStreamsByDay: StreamDay[]
  initialActivities: Activity[]
}

export default function ArtistDashboardClient({
  username,
  artist,
  releases,
  reports,
  playlists,
  initialStreamsByDay,
  initialActivities,
}: Props) {
  const totalEarnings = useMemo(
    () => reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0),
    [reports]
  )
  const releasedCount = useMemo(
    () => releases.filter((r) => r.status === "released").length,
    [releases]
  )

  return (
    <Layout role="artist" requiredRole="artist" username={username}>
      <div className="p-0 md:p-0 max-w-full pb-24">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            Dashboard
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Обзор</span>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
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
              <p className="text-4xl font-bold text-white font-display">{releases.length}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary">
                +{releasedCount} <span className="material-symbols-outlined">arrow_upward</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
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
              <p className="text-4xl font-bold text-white font-display">{reports.length}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--azure">
                +1 <span className="material-symbols-outlined">trending_up</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#10b981]">attach_money</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary mb-3 border border-primary/20">
                <span className="material-symbols-outlined text-xl">payments</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Заработок (Оценочно)</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-bold text-white font-display">
                {totalEarnings >= 1000 ? `$${(totalEarnings / 1000).toFixed(1)}k` : `$${Math.round(totalEarnings)}`}
              </p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--primary">
                +5.4% <span className="material-symbols-outlined">arrow_upward</span>
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
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
              <p className="text-4xl font-bold text-white font-display">{playlists.length}</p>
              <span className="stat-dash-metric-badge stat-dash-metric-badge--purple">
                +{playlists.length} <span className="material-symbols-outlined">add</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              ПОСЛЕДНЯЯ АКТИВНОСТЬ
            </h2>
            <Link
              className="text-xs text-primary hover:text-emerald-300 uppercase tracking-widest font-mono border-b border-primary/30 pb-0.5 hover:border-primary transition-all"
              href="#"
            >
              View All
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
            <StreamingChart
              artistId={artist.id}
              days={30}
              initialStreamsByDay={initialStreamsByDay}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center text-sm border-t border-white/5 pt-6">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse"></span>
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>
    </Layout>
  )
}
