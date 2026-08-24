"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ActivityFeed } from "@/components/activity-feed"
import { StreamingChart } from "@/components/streaming-chart-lazy"
import type { Activity } from "@/lib/storage"
import type { AdminDashboardPayload } from "@/lib/cached-dashboard"
// C-16/F-16: суммы кабинета — через formatMoney, всегда с «₽» (вердикт 1.1).
import { formatMoney, formatMoneyShort } from "@/lib/format-money"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
    /* 0-д п.3: на desktop дашборд помещается в один экран — высота страницы
       равна вьюпорту за вычетом полей шелла, а лента и график делят остаток
       (Friction 1.1: «график ниже фолда», C-18). Ниже xl — обычный поток. */
    <div className="flex flex-col gap-8 xl:h-[calc(100vh-5.5rem)]">
      {/* 0-д п.2: «Обновить данные» и метка «Обновлено …» убраны — на read-only
          обзоре действий нет вовсе (0-г), а страница и так перезапрашивается. */}
      <PageHeader
        title="ГЛАВНАЯ"
        subtitle="Панель управления лейблом. Обзор текущих метрик и недавней активности."
      />

      <TooltipProvider delayDuration={200}>
      {/* DS10/DS2: та же сетка и плотность, что у артиста — было grid-cols-1 и gap-6 на мобильном */}
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
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
                  {formatMoneyShort(metrics.totalPayments)}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="z-[250] max-w-xs border border-white/10 bg-surface-dialog/[0.96] px-3 py-2 text-xs font-mono text-white shadow-lg"
              >
                {formatMoney(metrics.totalPayments)}
              </TooltipContent>
            </Tooltip>
          }
        />
      </div>
      </TooltipProvider>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <SectionHeader
            className="mb-6"
            title="ПОСЛЕДНЯЯ АКТИВНОСТЬ"
            action={
              <SectionHeaderLink asChild className="inline-flex min-h-11 items-center pb-0">
                <Link href="/dashboard/admin/activity">Все события</Link>
              </SectionHeaderLink>
            }
          />
          <div className="card-glass min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/5">
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

          <div className="card-glass relative flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 p-4 xl:p-6">
            <StreamingChart days={streamWindowDays} initialStreamsByDay={initialStreamsByDay} />
          </div>
        </div>
      </div>

    </div>
  )
}
