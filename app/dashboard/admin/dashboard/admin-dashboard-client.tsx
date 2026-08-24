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
import { DashboardFooter } from "@/components/dashboard-footer"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader, SectionHeaderLink } from "@/components/ui/section-header"
import { StatCard } from "@/components/ui/stat-card"

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
  /** F-18: окно метрики — то же, что просит страница аналитики. */
  streamWindowDays: number
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
  streamWindowDays,
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
    <div className="space-y-8">
      <PageHeader
        title="ГЛАВНАЯ"
        subtitle="Панель управления лейблом. Обзор текущих метрик и недавней активности."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              className="h-11 rounded-lg border-white/10 bg-transparent px-3 font-mono text-xs uppercase tracking-widest text-gray-500 hover:bg-transparent hover:text-primary"
            >
              Обновить данные
            </Button>
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
          </>
        }
      />

      <TooltipProvider delayDuration={200}>
      {/* DS10/DS2: та же сетка и плотность, что у артиста — было grid-cols-1 и gap-6 на мобильном */}
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 mb-12">
        <StatCard
          label="Артисты"
          value={metrics.artistCount}
          icon="person"
          bgIcon="groups"
          bgIconClassName="stat-dash-bg-icon--short"
        />

        <StatCard
          label="Релизы"
          value={metrics.releaseCount}
          icon="library_music"
          bgIcon="album"
          tone="azure"
        />

        <StatCard
          label="Отчёты"
          value={metrics.reportCount}
          icon="description"
          bgIcon="bar_chart"
          tone="primary"
        />

        <StatCard
          label="Выплаты"
          icon="currency_ruble"
          bgIcon="currency_ruble"
          tone="purple"
          bgIconClassName="text-brand-purple-fg"
          value={
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default whitespace-nowrap">
                  {formatRubKpiShort(metrics.totalPayments)}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="z-[250] max-w-xs border border-white/10 bg-surface-dialog/[0.96] px-3 py-2 text-xs font-mono text-white shadow-lg"
              >
                {formatRubExact(metrics.totalPayments)}
              </TooltipContent>
            </Tooltip>
          }
        />
      </div>
      </TooltipProvider>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div>
          <SectionHeader
            className="mb-6"
            title="ПОСЛЕДНЯЯ АКТИВНОСТЬ"
            action={
              <SectionHeaderLink asChild className="inline-flex min-h-11 items-center pb-0">
                <Link href="/dashboard/admin/activity">Все события</Link>
              </SectionHeaderLink>
            }
          />
          <div className="card-glass rounded-2xl overflow-hidden border border-white/5">
            <ActivityFeed role="admin" limit={5} initialActivities={initialActivities} />
          </div>
        </div>

        <div className="flex flex-col h-full">
          {/*
            DS7: легенда «CURRENT / TARGET» была декоративной — на графике
            одна серия (реальные прослушивания), никакого «target» не
            существует, а англоязычные подписи нарушали единый язык.
            Оставляем честную подпись одной серии.
          */}
          <SectionHeader
            className="mb-6"
            title="СТАТИСТИКА СТРИМОВ"
            accent="azure"
            action={
              <span className="flex items-center text-[10px] font-mono uppercase tracking-widest text-gray-400">
                <span className="mr-2 h-2 w-2 rounded-full bg-primary" />
                Прослушивания
              </span>
            }
          />

          <div className="card-glass rounded-2xl flex-1 border border-white/5 p-8 flex flex-col relative min-h-[360px]">
            <StreamingChart days={streamWindowDays} initialStreamsByDay={initialStreamsByDay} />
          </div>
        </div>
      </div>

      <DashboardFooter />
    </div>
  )
}
