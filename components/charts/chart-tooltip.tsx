"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

/**
 * Единый тултип графиков — C-09 (docs/ui-audit.md). Сводит три самописных
 * тултипа (streaming-chart, DspStreamChart, Track*Bar) в один стиль:
 * компактная карточка ≤280px на токенах (фон surface-dialog/95, рамка
 * brand/30 — значения STREAM_CHART_COLORS), чтобы не закрывать плот (F-19).
 * Флип у краёв делает сам recharts — карточке достаточно быть компактной.
 *
 * Использование:
 *   <Tooltip content={<ChartTooltip labelFormatter={formatDayMonthUtc} />} />
 *
 * Поведение:
 * - скролл страницы закрывает тултип (F-88);
 * - тап закрывает показанный тултип, тап по другой точке — переносит;
 * - на <768px плавающая карточка над пальцем бесполезна: оберните график в
 *   <ChartTooltipScope> и поставьте <ChartTooltipPanel /> ПОД графиком —
 *   значения уходят в панель, карточка не рендерится.
 */

interface ChartTooltipRow {
  key: string
  name: string
  value: React.ReactNode
  color?: string
}

interface ChartTooltipData {
  label: React.ReactNode
  rows: ChartTooltipRow[]
  total?: React.ReactNode
}

interface ChartTooltipScopeValue {
  data: ChartTooltipData | null
  setData: (data: ChartTooltipData | null) => void
}

const ChartTooltipContext = React.createContext<ChartTooltipScopeValue | null>(null)

/** Связывает ChartTooltip графика с ChartTooltipPanel под ним. */
function ChartTooltipScope({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<ChartTooltipData | null>(null)
  const value = React.useMemo(() => ({ data, setData }), [data])
  return (
    <ChartTooltipContext.Provider value={value}>
      {children}
    </ChartTooltipContext.Provider>
  )
}

/** Элемент payload recharts; полная типизация тултипа recharts не нужна. */
interface RechartsPayloadEntry {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  stroke?: string
  fill?: string
}

export interface ChartTooltipProps {
  /** Инжектируется recharts. */
  active?: boolean
  /** Инжектируется recharts. */
  payload?: RechartsPayloadEntry[]
  /** Инжектируется recharts. */
  label?: string | number
  labelFormatter?: (label: string | number) => React.ReactNode
  /** По умолчанию — toLocaleString("ru-RU"). */
  valueFormatter?: (value: number, name: string) => React.ReactNode
  /** Строка «Всего» над сериями (как у DspStreamChart). */
  showTotal?: boolean
  totalLabel?: string
  /** Компактность: больше строк сворачивается в «ещё N». */
  maxRows?: number
}

const defaultValueFormatter = (value: number) => value.toLocaleString("ru-RU")

function TooltipRows({
  data,
  maxRows,
}: {
  data: ChartTooltipData
  maxRows: number
}) {
  const visible = data.rows.slice(0, maxRows)
  const hiddenCount = data.rows.length - visible.length
  const single = data.rows.length === 1 && data.total === undefined
  return (
    <>
      <p className="mb-1 font-mono text-[11px] leading-tight text-gray-400">
        {data.label}
      </p>
      {data.total !== undefined && (
        <p className="mb-1 text-sm font-bold text-white">{data.total}</p>
      )}
      {single ? (
        <p className="text-sm font-bold text-brand">{visible[0].value}</p>
      ) : (
        <div className="space-y-0.5">
          {visible.map((row) => (
            <div key={row.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="min-w-0 truncate text-gray-300">{row.name}</span>
              <span className="ml-auto shrink-0 pl-2 font-mono text-white">
                {row.value}
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-[10px] text-gray-500">ещё {hiddenCount}</p>
          )}
        </div>
      )}
    </>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = defaultValueFormatter,
  showTotal = false,
  totalLabel = "Всего",
  maxRows = 6,
}: ChartTooltipProps) {
  const scope = React.useContext(ChartTooltipContext)
  const isMobile = useMobileDetector()

  // Закрытие по скроллу и тапу. dismissedLabel хранит подпись скрытой точки:
  // новая точка (другой label) снова показывает тултип.
  const [dismissedLabel, setDismissedLabel] = React.useState<
    string | number | null
  >(null)

  const hasPayload = Boolean(active && payload && payload.length > 0)
  const activeRef = React.useRef(false)
  const labelRef = React.useRef<string | number | undefined>(undefined)
  React.useEffect(() => {
    activeRef.current = hasPayload
    labelRef.current = label
  })

  React.useEffect(() => {
    const onScroll = () => {
      if (activeRef.current) setDismissedLabel(labelRef.current ?? null)
    }
    // Тап-переключатель: тап скрывает показанный тултип; если он уже скрыт,
    // тап снимает скрытие (recharts тем же тапом переставит точку).
    const onTouchStart = () => {
      if (!activeRef.current) return
      setDismissedLabel((prev) => (prev === null ? labelRef.current ?? null : null))
    }
    window.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true })
      window.removeEventListener("touchstart", onTouchStart)
    }
  }, [])

  const data: ChartTooltipData | null = React.useMemo(() => {
    if (!hasPayload || label === undefined) return null
    const rows: ChartTooltipRow[] = (payload ?? [])
      .filter((entry) => entry.value !== undefined && entry.value !== null)
      .map((entry, i) => {
        const name = String(entry.name ?? entry.dataKey ?? "")
        const numeric = Number(entry.value)
        return {
          key: `${String(entry.dataKey ?? name)}-${i}`,
          name,
          value: Number.isFinite(numeric)
            ? valueFormatter(numeric, name)
            : String(entry.value),
          color: entry.color ?? entry.stroke ?? entry.fill,
        }
      })
    if (rows.length === 0) return null
    const totalValue = showTotal
      ? (payload ?? []).reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)
      : undefined
    return {
      label: labelFormatter ? labelFormatter(label) : String(label),
      rows,
      total:
        totalValue === undefined ? undefined : (
          <>
            {totalLabel}: {defaultValueFormatter(totalValue)}
          </>
        ),
    }
  }, [hasPayload, payload, label, labelFormatter, valueFormatter, showTotal, totalLabel])

  // Мобильный режим со Scope: значения уходят в панель под графиком.
  const publishToPanel = Boolean(scope && isMobile)
  const publishedKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!publishToPanel || !scope) return
    if (!data) return
    // Ключ против цикла: setData перерисовывает провайдер, recharts пересоздаёт
    // payload — без ключа эффект публиковал бы одно и то же бесконечно.
    const key =
      String(label) + "|" + data.rows.map((r) => `${r.key}:${r.name}`).join(",")
    if (publishedKeyRef.current === key) return
    publishedKeyRef.current = key
    scope.setData(data)
  }, [publishToPanel, scope, data, label])

  React.useEffect(() => {
    if (!scope) return
    return () => scope.setData(null)
    // Чистим панель только при размонтировании графика.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) return null
  if (publishToPanel) return null
  if (dismissedLabel !== null && dismissedLabel === label) return null

  return (
    <div
      role="tooltip"
      className="pointer-events-none max-w-[280px] rounded-lg border border-brand/30 bg-surface-dialog/95 px-3 py-2 shadow-xl"
    >
      <TooltipRows data={data} maxRows={maxRows} />
    </div>
  )
}

export interface ChartTooltipPanelProps {
  className?: string
  /** Текст до первого касания графика. */
  placeholder?: React.ReactNode
}

/**
 * Панель значений ПОД графиком для <768px. Работает в паре с
 * <ChartTooltipScope>; на десктопе не рендерится.
 */
function ChartTooltipPanel({
  className,
  placeholder = "Коснитесь графика, чтобы увидеть значения",
}: ChartTooltipPanelProps) {
  const scope = React.useContext(ChartTooltipContext)
  const isMobile = useMobileDetector()
  if (!scope || !isMobile) return null
  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-2 rounded-lg border border-white/10 bg-surface-raised/60 px-3 py-2",
        className
      )}
    >
      {scope.data ? (
        <TooltipRows data={scope.data} maxRows={12} />
      ) : (
        <p className="font-mono text-[11px] text-gray-500">{placeholder}</p>
      )}
    </div>
  )
}

export { ChartTooltip, ChartTooltipPanel, ChartTooltipScope }
