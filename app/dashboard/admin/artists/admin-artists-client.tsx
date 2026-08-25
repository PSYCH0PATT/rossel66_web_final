"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterChip } from "@/components/ui/filter-chip"
import { PageHeader } from "@/components/ui/page-header"
import { Pagination } from "@/components/ui/pagination"
import { SearchInput } from "@/components/ui/search-input"
import { Toolbar } from "@/components/ui/toolbar"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import type { AdminArtistItem } from "@/lib/cached-dashboard"
import {
  ARTIST_REPORT_FIELD_LABELS,
  getArtistReportMissingFields,
} from "@/lib/artist-report-requirements"
import { listSkeletonCount } from "@/lib/list-skeleton"
import { SkeletonLine } from "@/components/ui/skeleton-presets"

export default function AdminArtistsClient() {
  const [allArtists, setAllArtists] = useState<AdminArtistItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all")
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [stats, setStats] = useState({ all: 0, verified: 0, unverified: 0 })
  const [loading, setLoading] = useState(true)
  const [gridCols, setGridCols] = useState<number>(2)
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, filter])



  useEffect(() => {
    const computeCols = () => {
      if (typeof window === "undefined") return 2
      const w = window.innerWidth
      if (w >= 2560) return 8
      if (w >= 1920) return 7
      if (w >= 1600) return 6
      if (w >= 1280) return 5
      if (w >= 1080) return 5
      if (w >= 768) return 4
      if (w >= 640) return 3
      return 2
    }
    const updateCols = () => setGridCols(computeCols())
    updateCols()
    window.addEventListener("resize", updateCols)
    return () => window.removeEventListener("resize", updateCols)
  }, [])

  const skeletonCount = listSkeletonCount({
    pageSize,
    total: allArtists.length > 0 ? total : null,
    page,
    previousCount: allArtists.length || null,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      // F-37: боевой список — без тестовых учёток («test», логины прогонов)
      params.set("hideTest", "1")
      if (debouncedQ) params.set("q", debouncedQ)
      if (filter === "verified") params.set("verified", "true")
      if (filter === "unverified") params.set("verified", "false")
      const res = await fetch(`/api/artists?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setAllArtists(data.artists ?? [])
        setTotal(typeof data.total === "number" ? data.total : 0)
        if (data.stats) {
          setStats({
            all: data.stats.all ?? 0,
            verified: data.stats.verified ?? 0,
            unverified: data.stats.unverified ?? 0,
          })
        }
      }
    } catch (e) {
      console.error(e)
      setBanner({ type: "error", text: "Не удалось загрузить список артистов" })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filter, debouncedQ])

  useEffect(() => {
    load()
  }, [load])

  const verifyArtist = async (artistId: string) => {
    setIsVerifying((prev) => ({ ...prev, [artistId]: true }))
    setBanner(null)
    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artistId, verified: true }),
      })
      const result = await response.json()
      if (result.success) {
        setAllArtists((prev) => prev.map((a) => (a.id === artistId ? { ...a, verified: true } : a)))
        await load()
        setBanner({ type: "success", text: "Артист подтверждён" })
      } else {
        setBanner({ type: "error", text: result.error || "Ошибка при подтверждении" })
      }
    } catch {
      setBanner({ type: "error", text: "Произошла ошибка при подтверждении артиста" })
    } finally {
      setIsVerifying((prev) => ({ ...prev, [artistId]: false }))
    }
  }

  return (
    <div className="space-y-8">
      {banner && (
        <Banner variant={banner.type === "error" ? "danger" : "success"}>
          {banner.text}
        </Banner>
      )}

      <PageHeader
        rowClassName="md:flex-col md:items-start md:gap-6 lg:flex-row lg:items-end"
        title="Артисты"
        subtitle={
          debouncedQ
            ? `Найдено: ${total} (поиск «${debouncedQ}»)`
            : filter === "all"
              ? `Всего в системе: ${stats.all}`
              : filter === "verified"
                ? `Подтверждённые: ${stats.verified} из ${stats.all}`
                : `Неподтверждённые: ${stats.unverified} из ${stats.all}`
        }
        actions={
          /* 0-в/0-г: обоими входами не пользуются (владелец, п.11) — уходят в
             «Ещё», filled снят. На экране не остаётся ни одной filled-кнопки,
             и это норма: primary здесь — поиск и карточки. */
          <ActionMenu kind="more">
            <ActionMenuItem asChild icon="person_add" description="Аккаунт и профиль вручную">
              <Link href="/dashboard/admin/artists/add">Добавить артиста</Link>
            </ActionMenuItem>
            <ActionMenuItem asChild icon="group_add" description="Пачкой, по списку имён">
              <Link href="/dashboard/admin/artists/bulk-add">Массовое добавление</Link>
            </ActionMenuItem>
          </ActionMenu>
        }
      />

      {/* 1.6: три StatCard «Всего / Подтверждены / Новые» удалены — они
          повторяли числа фильтр-чипов один в один (вопрос №4 закрыт владельцем);
          сами числа остались в чипах ниже. */}

      {/* 0-г: primary экрана — поиск, поэтому он первый и широкий. */}
      <Toolbar className="mb-6 items-stretch gap-4 sm:flex-wrap sm:items-end sm:overflow-x-visible">
        <SearchInput
          value={q}
          onValueChange={setQ}
          placeholder="Поиск по имени или username…"
          containerClassName="w-full min-w-0 flex-1 sm:max-w-xl"
          spellCheck={false}
          autoComplete="off"
        />
      </Toolbar>

      <div className="flex flex-wrap gap-2 mb-8">
        {(
          [
            { id: "all" as const, label: `Все (${stats.all})` },
            { id: "verified" as const, label: `Подтверждённые (${stats.verified})` },
            { id: "unverified" as const, label: `Новые (${stats.unverified})` },
          ] as const
        ).map((tab) => (
          <FilterChip
            key={tab.id}
            tone="success"
            active={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className="min-h-11 rounded-lg border-white/5 bg-white/5 px-3 py-2 font-mono text-xs text-gray-400 hover:bg-white/10 hover:text-white data-[active=true]:border-primary/30 data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
          >
            {tab.label}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        /**
         * F-86: на время запроса экран схлопывался в один спиннер, и при
         * скролле на 390 попадался целый вьюпорт пустого фона. Держим место
         * ровно под те карточки, которые сейчас придут.
         */
        <div
          className="grid gap-2 sm:gap-3 mb-8"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          aria-busy="true"
          aria-label="Загрузка списка артистов"
        >
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div
              key={i}
              className="artist-card-container w-full overflow-hidden rounded-lg border border-white/5 card-glass"
              style={{ padding: "max(8px, 0.55vw)" }}
            >
              <SkeletonLine className="mb-2 h-3.5 w-2/3 bg-white/5" />
              <SkeletonLine className="mb-2 h-3 w-1/2 bg-white/5" />
              <SkeletonLine className="h-2.5 w-1/3 bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            className="grid gap-2 sm:gap-3 mb-8"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {allArtists.map((artist) => {
              // Одна величина на все четыре стороны: угловые значки должны
              // стоять ровно на той же линии, что и текст, на любой ширине.
              const pad = "max(8px, 0.55vw)"
              const missing = getArtistReportMissingFields(artist)
              const isNew = !(artist.verified ?? true)
              // У новых артистов данных нет по определению — значок появляется
              // только после подтверждения, иначе он висел бы у всех подряд.
              const showMissing = missing.length > 0 && !isNew
              const missingText = missing.map((f) => ARTIST_REPORT_FIELD_LABELS[f]).join(", ")

              return (
              <div key={artist.id} className="group relative">
                <Link
                  href={`/dashboard/admin/artists/${artist.id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div
                    className="artist-card-container relative w-full overflow-hidden rounded-lg border border-white/5 card-glass cursor-pointer transition-colors duration-200 hover:border-primary/40"
                    style={{ padding: pad }}
                  >
                    {/* Отступ справа — построчный и только под то, что реально
                        есть в углу: общий отступ съедал ширину имени у всех. */}
                    <div className="min-w-0">
                      <h3
                        className="artist-card-name truncate font-semibold text-white"
                        style={{ paddingRight: isNew ? 84 : 0 }}
                        title={artist.name}
                      >
                        {artist.name}
                      </h3>

                      <p
                        className="artist-card-username truncate font-mono text-gray-400"
                        title={`@${artist.username}`}
                      >
                        @{artist.username}
                      </p>

                      <div
                        className="artist-card-meta mt-0.5 flex min-w-0 items-center gap-1.5 text-gray-500"
                        style={{ paddingRight: showMissing ? 24 : 0 }}
                      >
                        {/* Б-20 (хвост F-85): голое «100%» ничего не говорило —
                            это процент отчислений артисту, на него умножается
                            сумма отчёта (lib/report-processing/index.ts). Слово
                            видно там, где под него есть место: замер мета-строки
                            даёт 192px на 1440 и 80px на 768, поэтому ниже xl
                            остаётся только title — иначе подпись выдавила бы ФИО. */}
                        <span
                          className={`shrink-0 font-mono tabular-nums ${
                            missing.includes("percentage") ? "text-amber-300" : "text-primary"
                          }`}
                          title="Процент отчислений артисту"
                        >
                          <span className="hidden xl:inline">Процент </span>
                          {artist.percentage ?? 0}%
                        </span>
                        {artist.fioShort && (
                          <>
                            <span aria-hidden className="text-gray-600">
                              ·
                            </span>
                            <span className="truncate" title={artist.fio ?? ""}>
                              {artist.fioShort}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Верхний правый угол: подтверждение (по наведению) и метка «Новый». */}
                {isNew && (
                  <div className="absolute z-10 flex items-center gap-1" style={{ top: pad, right: pad }}>
                    <Button
                      size="icon"
                      variant="success-outline"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        verifyArtist(artist.id)
                      }}
                      disabled={isVerifying[artist.id]}
                      className="h-5 w-5 shrink-0 rounded-full border-emerald-400/40 bg-emerald-500/20 text-emerald-300 opacity-0 transition-opacity duration-150 hover:border-emerald-300/80 focus-visible:opacity-100 group-hover:opacity-100 max-md:h-5 max-md:w-5 pointer-coarse:h-5 pointer-coarse:w-5"
                      aria-label={`Подтвердить артиста ${artist.name}`}
                      title="Подтвердить артиста"
                    >
                      {isVerifying[artist.id] ? (
                        <Spinner size="sm" className="h-2.5 w-2.5 [&>span]:h-2.5 [&>span]:w-2.5" />
                      ) : (
                        <span className="material-symbols-outlined leading-none" style={{ fontSize: 13 }} aria-hidden>
                          check
                        </span>
                      )}
                    </Button>

                    {/* Текст центрируем flex-ом при leading-none: с прежними
                        px/py надпись сидела в контуре не по центру. */}
                    <StatusBadge
                      variant="delivered"
                      withIcon={false}
                      className="h-5 shrink-0 justify-center border-sky-400/40 bg-sky-500/15 px-2 py-0 font-mono text-[9px] font-normal leading-none tracking-wider text-sky-300"
                    >
                      Новый
                    </StatusBadge>
                  </div>
                )}

                {/* Нижний правый угол: чего не хватает для отчёта. Подсказка на
                    hidden/block, а не на title — нативный тултип ждёт секунду. */}
                {showMissing && (
                  <div className="group/warn absolute z-20" style={{ bottom: pad, right: pad }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 font-mono text-[11px] font-bold leading-none text-amber-300">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded-md border border-amber-400/30 bg-status-warning/10 px-2 py-1 font-mono text-[10px] leading-none text-amber-200 shadow-lg backdrop-blur-md group-hover/warn:block">
                      Нет: {missingText}
                    </div>
                    <span className="sr-only">Нет данных для отчёта: {missingText}</span>
                  </div>
                )}
              </div>
              )
            })}
          </div>

          {allArtists.length === 0 && (
            <EmptyState
              className="mb-8 py-12"
              icon="person_search"
              title="Нет артистов по текущим фильтрам"
            />
          )}

          {/* C-06/F-27: счётчик, «на странице» и навигация — ОДИН Pagination
              на экран. Верхний блок с тем же счётчиком убран вместе с
              переездом поиска в Toolbar. */}
          <Pagination
            className="pt-4"
            page={page}
            total={total}
            pageSize={pageSize}
            loading={loading}
            itemForms={["артист", "артиста", "артистов"]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size as 20 | 50 | 100)
              setPage(1)
            }}
          />
        </>
      )}

    </div>
  )
}
