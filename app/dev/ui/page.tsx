"use client"

/**
 * Витрина UI-кита кабинета — этап 2.2 UI-overhaul (docs/ui-audit.md).
 * Все компоненты этапа, их варианты и состояния на одном экране.
 * Страницы кабинета на компоненты НЕ переведены — это волны этапа 4.
 */

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Pagination } from "@/components/ui/pagination"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { FilterChip } from "@/components/ui/filter-chip"
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar"
import { SearchInput } from "@/components/ui/search-input"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableResponsive,
  DataTableRow,
} from "@/components/ui/data-table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import {
  SkeletonChart,
  SkeletonLine,
  SkeletonRows,
  SkeletonStatCard,
  SkeletonValue,
} from "@/components/ui/skeleton-presets"
import { SectionHeader, SectionHeaderLink } from "@/components/ui/section-header"
import { StatCard } from "@/components/ui/stat-card"
import { ReleaseStatusBadge, StatusBadge } from "@/components/ui/status-badge"
import { Banner } from "@/components/ui/banner"
import { FormField } from "@/components/ui/form-field"
import { DatePicker } from "@/components/ui/date-picker"
import { FileInput } from "@/components/ui/file-input"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartTooltip,
  ChartTooltipPanel,
  ChartTooltipScope,
} from "@/components/charts/chart-tooltip"
import { chartXAxisProps, chartYAxisProps } from "@/components/charts/chart-axis"
import { CHART_SERIES_COLORS } from "@/lib/chart-colors"
import { formatDayMonthUtc } from "@/lib/format-date"
import { PERIOD_STRINGS } from "@/lib/ui-strings"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// ---------------------------------------------------------------------------
// Каркас витрины
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "c-01", title: "C-01 PageHeader" },
  { id: "c-02", title: "C-02 Button" },
  { id: "c-06", title: "C-06 Pagination" },
  { id: "c-07", title: "C-07 SegmentedControl + FilterChip" },
  { id: "c-08", title: "C-08 Toolbar + SearchInput" },
  { id: "c-09", title: "C-09 ChartTooltip" },
  { id: "c-10", title: "C-10 DataTable" },
  { id: "c-12", title: "C-12 Drawer (Sheet + ScrollArea)" },
  { id: "c-14", title: "C-14 Empty / Loading" },
  { id: "c-15", title: "C-15 Секции, карточки, бейджи, баннеры" },
  { id: "c-17", title: "C-17 Инпуты" },
] as const

function DemoSection({
  id,
  title,
  note,
  children,
}: {
  id: string
  title: React.ReactNode
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Не <section>: глобальные стили лендинга (globals.css) вешают на голый
    // section флекс со scroll-snap, и витрину «прилепляет» к секциям.
    <div id={id} className="scroll-mt-6 space-y-4">
      <SectionHeader title={title} />
      {note && <p className="max-w-3xl text-xs text-gray-500">{note}</p>}
      <div className="card-glass space-y-8 rounded-2xl border border-white/5 p-4 md:p-6">
        {children}
      </div>
    </div>
  )
}

function Demo({
  label,
  children,
  stack = false,
}: {
  label: React.ReactNode
  children: React.ReactNode
  stack?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
        {label}
      </p>
      <div className={stack ? "space-y-3" : "flex flex-wrap items-end gap-3"}>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Данные демо
// ---------------------------------------------------------------------------

const CHART_DATA = Array.from({ length: 21 }, (_, i) => ({
  date: `2026-08-${String(i + 1).padStart(2, "0")}`,
  "VK Музыка": 400 + Math.round(300 * Math.abs(Math.sin(i / 3))),
  "Яндекс Музыка": 250 + Math.round(200 * Math.abs(Math.cos(i / 4))),
}))

const TABLE_ROWS = [
  { title: "МЕЛАНХОЛИЯ", artist: "KAI ANGEL", upc: "196922000001", date: "14.03.2026", status: "Доставлен", tracks: 8 },
  { title: "ПОЛНОЧЬ", artist: "9MICE", upc: "196922000002", date: "02.05.2026", status: "В доставке", tracks: 1 },
  { title: "ЛЕТО-2026", artist: "FRIENDLY THUG 52", upc: "196922000003", date: "30.06.2026", status: "Модерируется", tracks: 12 },
  { title: "ДЕМО-СБОРНИК", artist: "test", upc: "196922000004", date: "11.08.2026", status: "Отклонен", tracks: 4 },
  { title: "ЧЕРНОВИК EP", artist: "cherrypiertd", upc: "—", date: "—", status: "Драфт", tracks: 3 },
]

const DRAWER_NAV = [
  "Главная",
  "Артисты",
  "Релизы",
  "Отчёты",
  "Выплаты",
  "Генератор отчётов",
  "Плейлисты",
  "История плейлистов",
  "Аналитика",
  "Активность",
]

const PERIOD_OPTIONS = [
  { value: "7d", label: PERIOD_STRINGS.short.d7 },
  { value: "30d", label: PERIOD_STRINGS.short.d30 },
  { value: "90d", label: PERIOD_STRINGS.short.d90 },
  { value: "180d", label: PERIOD_STRINGS.short.d180 },
  { value: "365d", label: PERIOD_STRINGS.short.y1 },
  { value: "custom", label: PERIOD_STRINGS.short.custom },
] as const

// ---------------------------------------------------------------------------
// Страница
// ---------------------------------------------------------------------------

export default function DevUiPage() {
  const isMobile = useMobileDetector()

  // C-06
  const [page, setPage] = React.useState(3)
  const [pageSize, setPageSize] = React.useState(20)

  // C-07
  const [period, setPeriod] = React.useState<string>("30d")
  const [chipFilter, setChipFilter] = React.useState("all")

  // C-08
  const [toolbarFilters, setToolbarFilters] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // C-15
  const [banners, setBanners] = React.useState({
    info: true,
    success: true,
    warning: true,
    danger: true,
  })

  // C-17
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>()
  const [dateTo, setDateTo] = React.useState<Date | undefined>()

  const closedBanners = Object.values(banners).filter((v) => !v).length

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-8 md:px-8 md:py-12">
      <PageHeader
        title="UI-кит"
        subtitle="Витрина компонентов этапа 2.2: варианты и состояния. Страницы кабинета переезжают на них волнами этапа 4."
        actions={
          <Button asChild variant="outline">
            <a href="#c-01">Слот действий</a>
          </Button>
        }
      />

      <nav aria-label="Разделы витрины" className="-mt-8 flex flex-wrap gap-x-4 gap-y-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="font-mono text-[11px] uppercase tracking-wider text-gray-500 transition-colors hover:text-primary"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-01"
        title="C-01 PageHeader"
        note="Лечит 7 вариантов шапки: один размер H1 на весь кабинет, крошки или back-link, слот actions. H1 — имя сущности, не действие. Размер передать нечем: пропа size у компонента нет, ширину и поля страницы задаёт DashboardShell."
      >
        <Demo label="subtitle + actions" stack>
          <PageHeader
            title="Плейлисты"
            subtitle="Попадания треков в редакционные плейлисты площадок."
            actions={
              <>
                <Button variant="outline">Экспорт CSV</Button>
                <Button variant="cta">Синхронизировать</Button>
              </>
            }
          />
        </Demo>
        <Demo label="breadcrumbs (крошка = H1)" stack>
          <PageHeader
            title="Меланхолия"
            subtitle="Редактирование релиза"
            breadcrumbs={[
              { label: "Релизы", href: "#c-01" },
              { label: "Меланхолия" },
            ]}
            actions={<Button>Сохранить</Button>}
          />
        </Demo>
        <Demo label="backHref" stack>
          <PageHeader
            title="Добавить артиста"
            subtitle="Логин, имя и контакты."
            backHref="#c-01"
          />
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-02"
        title="C-02 Button"
        note="Новые варианты: cta (glow, F-28 — disabled реально гаснет), destructive-outline, success-outline, warning-outline. Остальные — сток shadcn без изменений."
      >
        <Demo label="Варианты">
          <Button>default</Button>
          <Button variant="cta">cta (glow)</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="outline">outline</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="link">link</Button>
          <Button variant="destructive">destructive</Button>
          <Button variant="destructive-outline">destructive-outline</Button>
          <Button variant="success-outline">success-outline</Button>
          <Button variant="warning-outline">warning-outline</Button>
        </Demo>
        <Demo label="Единый disabled (приглушён, glow снят)">
          <Button disabled>default</Button>
          <Button variant="cta" disabled>
            cta
          </Button>
          <Button variant="outline" disabled>
            outline
          </Button>
          <Button variant="destructive-outline" disabled>
            destructive-outline
          </Button>
          <Button variant="success-outline" disabled>
            success-outline
          </Button>
        </Demo>
        <Demo label="Размеры (тач 44px на мобиле из коробки)">
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" variant="ghost" aria-label="Обновить">
            <span className="material-symbols-outlined" aria-hidden>
              refresh
            </span>
          </Button>
          <Button size="icon" variant="destructive-outline" aria-label="Удалить">
            <span className="material-symbols-outlined" aria-hidden>
              delete
            </span>
          </Button>
        </Demo>
        <Demo label="С иконкой">
          <Button variant="cta">
            <span className="material-symbols-outlined" aria-hidden>
              add
            </span>
            Добавить релиз
          </Button>
          <Button variant="success-outline">
            <span className="material-symbols-outlined" aria-hidden>
              download
            </span>
            Скачать
          </Button>
          <Button variant="destructive-outline">
            <span className="material-symbols-outlined" aria-hidden>
              delete
            </span>
            Удалить
          </Button>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-06"
        title="C-06 Pagination"
        note="Счётчик в одном месте (F-27), «На странице», русские строки (F-11). При одной странице навигация скрывается целиком (F-26)."
      >
        <Demo label={`Интерактив: страница ${page}, на странице ${pageSize}`} stack>
          <Pagination
            page={page}
            total={137}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </Demo>
        <Demo label="Одна страница: только счётчик" stack>
          <Pagination page={1} total={8} pageSize={20} onPageChange={() => {}} />
        </Demo>
        <Demo label="Загрузка" stack>
          <Pagination
            page={2}
            total={137}
            pageSize={20}
            onPageChange={() => {}}
            loading
          />
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-07"
        title="C-07 SegmentedControl + FilterChip"
        note="Единое active-состояние (F-22), подписи из словаря PERIOD_STRINGS — не «Custom»."
      >
        <Demo label={`SegmentedControl: период = ${period}`}>
          <SegmentedControl
            aria-label="Период"
            options={PERIOD_OPTIONS}
            value={period}
            onValueChange={setPeriod}
          />
        </Demo>
        <Demo label="FilterChip: тона info / danger / orange / warning, активен один">
          <FilterChip
            tone="info"
            active={chipFilter === "all"}
            onClick={() => setChipFilter("all")}
          >
            Все отчёты
          </FilterChip>
          <FilterChip
            tone="danger"
            active={chipFilter === "unsigned"}
            onClick={() => setChipFilter("unsigned")}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden>
              cancel
            </span>
            Неподписанные
          </FilterChip>
          <FilterChip
            tone="orange"
            active={chipFilter === "unpaid"}
            onClick={() => setChipFilter("unpaid")}
          >
            Невыплаченные
          </FilterChip>
          <FilterChip
            tone="warning"
            active={chipFilter === "ack"}
            onClick={() => setChipFilter("ack")}
          >
            Ознакомлен, не подписан
          </FilterChip>
          <FilterChip tone="success" active disabled>
            disabled active
          </FilterChip>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-08"
        title="C-08 Toolbar + SearchInput"
        note="Тулбар releases без единого inline style: тона токенами, primary с mobileFirst встаёт первым на 390 (F-09)."
      >
        <Demo label="Тулбар releases" stack>
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Toolbar className="flex-1">
              <ToolbarButton tone="info" icon="download">
                Zvonko Parser
              </ToolbarButton>
              <ToolbarButton tone="success" icon="sync">
                Koala Parser
              </ToolbarButton>
              <ToolbarButton tone="warning" icon="link">
                Привязать релизы
              </ToolbarButton>
              <ToolbarButton
                tone={toolbarFilters ? "active" : "neutral"}
                icon="tune"
                onClick={() => setToolbarFilters((v) => !v)}
              >
                Фильтры{toolbarFilters ? " · 2" : ""}
              </ToolbarButton>
              {toolbarFilters && (
                <ToolbarButton
                  tone="muted"
                  icon="filter_alt_off"
                  onClick={() => setToolbarFilters(false)}
                >
                  Сбросить
                </ToolbarButton>
              )}
              <ToolbarButton tone="primary" icon="add" mobileFirst>
                Добавить релиз
              </ToolbarButton>
              <ToolbarButton tone="neutral" icon="pause" disabled>
                disabled
              </ToolbarButton>
            </Toolbar>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Поиск по названию или UPC..."
              containerClassName="sm:ml-auto sm:w-72 shrink-0"
            />
          </div>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-09"
        title="C-09 ChartTooltip"
        note="Компакт ≤280px (F-19), закрывается по скроллу (F-88) и повторному тапу; оси — chartXAxisProps/chartYAxisProps: паддинг последнего тика (F-62), прореживание на мобиле. На <768px значения уходят в панель ПОД графиком."
      >
        <Demo label="AreaChart, две серии, showTotal" stack>
          <ChartTooltipScope>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    {CHART_SERIES_COLORS.slice(0, 2).map((color, i) => (
                      <linearGradient key={i} id={`dev-ui-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayMonthUtc}
                    {...chartXAxisProps({ mobile: isMobile })}
                  />
                  <YAxis {...chartYAxisProps()} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatDayMonthUtc(String(l))}
                        showTotal
                      />
                    }
                    cursor={{ stroke: "rgba(16,185,129,0.3)", strokeWidth: 1 }}
                  />
                  {(["VK Музыка", "Яндекс Музыка"] as const).map((key, i) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={CHART_SERIES_COLORS[i]}
                      strokeWidth={2}
                      fill={`url(#dev-ui-grad-${i})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartTooltipPanel />
          </ChartTooltipScope>
          <p className="text-[11px] text-gray-600">
            Панель под графиком видна на вьюпорте уже 768px (сузьте окно).
          </p>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-10"
        title="C-10 DataTable"
        note="Горизонтальный скролл с видимым скроллбаром и тенями у краёв (F-76, F-77), sticky-первая колонка, строка целиком кликабельна (F-31) — вложенные кнопки не перехватываются. Для 390 — вариант с карточками."
      >
        <Demo label="stickyFirstColumn + кликабельные строки (сузьте окно для скролла)" stack>
          <DataTable stickyFirstColumn>
            <DataTableHeader>
              <DataTableHeadRow>
                <DataTableHeadCell>Название</DataTableHeadCell>
                <DataTableHeadCell>Артист</DataTableHeadCell>
                <DataTableHeadCell>UPC</DataTableHeadCell>
                <DataTableHeadCell>Дата</DataTableHeadCell>
                <DataTableHeadCell>Статус</DataTableHeadCell>
                <DataTableHeadCell className="text-center">Треков</DataTableHeadCell>
                <DataTableHeadCell>Лейбл</DataTableHeadCell>
                <DataTableHeadCell>Дистрибьютор</DataTableHeadCell>
                <DataTableHeadCell className="text-right">Действия</DataTableHeadCell>
              </DataTableHeadRow>
            </DataTableHeader>
            <DataTableBody>
              {TABLE_ROWS.map((row) => (
                <DataTableRow key={row.upc + row.title} href="#c-10">
                  <DataTableCell className="font-bold text-white">{row.title}</DataTableCell>
                  <DataTableCell className="text-gray-300">{row.artist}</DataTableCell>
                  <DataTableCell className="font-mono text-xs text-gray-400">{row.upc}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap font-mono text-xs text-gray-400">{row.date}</DataTableCell>
                  <DataTableCell>
                    <ReleaseStatusBadge status={row.status} />
                  </DataTableCell>
                  <DataTableCell className="text-center font-mono text-gray-400">{row.tracks}</DataTableCell>
                  <DataTableCell className="text-gray-400">ROSSEL 66</DataTableCell>
                  <DataTableCell className="text-gray-400">Zvonko Digital</DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      size="icon"
                      variant="destructive-outline"
                      className="h-8 w-8"
                      aria-label={`Удалить ${row.title}`}
                      onClick={() => setBanners((b) => ({ ...b, danger: true }))}
                    >
                      <span className="material-symbols-outlined text-[15px]" aria-hidden>
                        delete
                      </span>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Demo>
        <Demo label="DataTableResponsive: таблица ≥768, карточки на 390" stack>
          <DataTableResponsive
            table={
              <DataTable>
                <DataTableHeader>
                  <DataTableHeadRow>
                    <DataTableHeadCell>Название</DataTableHeadCell>
                    <DataTableHeadCell>Статус</DataTableHeadCell>
                    <DataTableHeadCell className="text-right">Треков</DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHeader>
                <DataTableBody>
                  {TABLE_ROWS.slice(0, 3).map((row) => (
                    <DataTableRow key={row.title}>
                      <DataTableCell className="font-bold text-white">{row.title}</DataTableCell>
                      <DataTableCell>
                        <ReleaseStatusBadge status={row.status} />
                      </DataTableCell>
                      <DataTableCell className="text-right font-mono text-gray-400">{row.tracks}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            }
            cards={
              <div className="space-y-3">
                {TABLE_ROWS.slice(0, 3).map((row) => (
                  <div
                    key={row.title}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-surface-raised/60 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{row.title}</p>
                      <p className="font-mono text-xs text-gray-500">{row.tracks} трек(ов)</p>
                    </div>
                    <ReleaseStatusBadge status={row.status} />
                  </div>
                ))}
              </div>
            }
          />
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-12"
        title="C-12 Drawer (Sheet + ScrollArea)"
        note="Мобильный drawer: содержимое скроллится, нижний пункт «Выйти» достижим на любой высоте экрана (F-75), паддинги под safe-area."
      >
        <Demo label="Sheet side=left + ScrollArea (10 пунктов + «Выйти»)">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <span className="material-symbols-outlined" aria-hidden>
                  menu
                </span>
                Открыть drawer
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 flex-col p-0 pt-[max(0px,env(safe-area-inset-top))]"
            >
              <SheetHeader className="border-b border-white/5 px-6 py-4">
                <SheetTitle className="text-left font-mono text-xs uppercase tracking-widest text-gray-500">
                  Панель управления
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1" viewportClassName="px-4 py-4">
                <nav className="space-y-1">
                  {DRAWER_NAV.map((label, i) => (
                    <a
                      key={label}
                      href="#c-12"
                      className={`flex items-center rounded-lg p-3 text-sm font-medium tracking-wide transition-all ${
                        i === 0
                          ? "border border-primary/20 bg-primary/10 text-primary"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
              </ScrollArea>
              <div className="border-t border-white/5 p-4">
                <button
                  type="button"
                  className="group flex w-full items-center rounded-lg p-3 text-gray-400 transition-all hover:bg-red-500/10 hover:text-red-400"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    logout
                  </span>
                  <span className="ml-4 text-sm font-medium tracking-wide">Выйти</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </Demo>
        <Demo label="ScrollArea отдельно: видимый скроллбар + градиент-фейд" stack>
          <ScrollArea className="max-w-md" viewportClassName="max-h-48" fadeClassName="from-[#101010]">
            <ul className="space-y-2 p-3">
              {Array.from({ length: 24 }, (_, i) => (
                <li key={i} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300">
                  Строка списка {i + 1}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-14"
        title="C-14 Empty / Loading"
        note="EmptyState: читаемый текст и ОДНО действие (F-25, F-41, F-58). Spinner — единый вместо трёх исполнений. Скелетоны вместо ложных нулей (F-54)."
      >
        <Demo label="EmptyState c действием" stack>
          <EmptyState
            icon="library_music"
            title="Релизы не найдены"
            description="Попробуйте изменить фильтры или сбросить поиск."
            action={<Button variant="outline">Сбросить фильтры</Button>}
          />
        </Demo>
        <Demo label="EmptyState без действия" stack>
          <EmptyState
            icon="bar_chart"
            title="Нет данных аналитики"
            description="Импортируйте CSV, чтобы увидеть прослушивания."
          />
        </Demo>
        <Demo label="Spinner: sm / md / lg / с подписью">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner size="md" label="Загрузка…" />
        </Demo>
        <Demo label="Скелетоны: строка, значение KPI, стат-карточка, строки списка, график" stack>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <SkeletonLine className="w-2/3" />
              <SkeletonLine className="w-1/3" />
              <SkeletonValue />
              <SkeletonRows rows={3} />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SkeletonStatCard />
                <SkeletonStatCard />
              </div>
              <SkeletonChart />
            </div>
          </div>
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-15"
        title="C-15 Секции, карточки, бейджи, баннеры"
        note="SectionHeader — один стиль заголовка с полосой по правилу (F-57, F-59). StatCard — типографика значений (F-64). StatusBadge — один стиль на статус (F-23). Banner — кнопка закрытия больше не копируется (#16)."
      >
        <Demo label="SectionHeader: размеры, акценты, ссылка справа" stack>
          <SectionHeader
            title="Последние релизы"
            action={<SectionHeaderLink href="#c-15">Все релизы</SectionHeaderLink>}
          />
          <SectionHeader title="Плейлисты" accent="azure" size="sm" as="h3" />
          <SectionHeader title="Авансы" accent="orange" size="sm" as="h3" />
          <SectionHeader title="Без полосы" accent="none" size="sm" as="h3" />
        </Demo>
        <Demo label="StatCard: тона + вотермарка + footer" stack>
          <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4">
            <StatCard label="Релизы" value="445" icon="library_music" bgIcon="album" />
            <StatCard label="Отчёты" value="12" icon="analytics" tone="azure" bgIcon="bar_chart" />
            <StatCard
              label="Заработок"
              value="1,2 млн ₽"
              icon="currency_ruble"
              tone="primary"
              bgIcon="currency_ruble"
              footer="за все кварталы"
            />
            <StatCard label="На модерации" value="3" icon="pending" tone="warning" bgIcon="pending" />
          </div>
        </Demo>
        <Demo label="StatusBadge: все варианты">
          <StatusBadge variant="live">Доставлен</StatusBadge>
          <StatusBadge variant="delivered">В доставке</StatusBadge>
          <StatusBadge variant="moderation">Модерируется</StatusBadge>
          <StatusBadge variant="rejected">Отклонен</StatusBadge>
          <StatusBadge variant="draft">Драфт</StatusBadge>
          <StatusBadge variant="warning">Не подписан</StatusBadge>
          <StatusBadge variant="live" withIcon={false}>
            без иконки
          </StatusBadge>
        </Demo>
        <Demo label="ReleaseStatusBadge: по сырому статусу из данных">
          <ReleaseStatusBadge status="released" />
          <ReleaseStatusBadge status="delivery" />
          <ReleaseStatusBadge status="На модерации" />
          <ReleaseStatusBadge status="Снят" />
          <ReleaseStatusBadge status={undefined} />
        </Demo>
        <Demo label={`Banner: 4 варианта + onClose${closedBanners ? ` (закрыто: ${closedBanners})` : ""}`} stack>
          {banners.info && (
            <Banner variant="info" onClose={() => setBanners((b) => ({ ...b, info: false }))}>
              Синхронизация с площадками выполняется раз в сутки.
            </Banner>
          )}
          {banners.success && (
            <Banner variant="success" onClose={() => setBanners((b) => ({ ...b, success: false }))}>
              Настройки сохранены.
            </Banner>
          )}
          {banners.warning && (
            <Banner variant="warning" onClose={() => setBanners((b) => ({ ...b, warning: false }))}>
              У 3 артистов не хватает данных для отчётов.
            </Banner>
          )}
          {banners.danger && (
            <Banner variant="danger" onClose={() => setBanners((b) => ({ ...b, danger: false }))}>
              Не удалось удалить релиз. Попробуйте ещё раз.
            </Banner>
          )}
          {closedBanners > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBanners({ info: true, success: true, warning: true, danger: true })
              }
            >
              Показать закрытые
            </Button>
          )}
        </Demo>
      </DemoSection>

      {/* ----------------------------------------------------------------- */}
      <DemoSection
        id="c-17"
        title="C-17 Инпуты"
        note="FormField: у поля всегда label (F-82). DatePicker и FileInput — стилизованные замены нативных контролов (F-12)."
      >
        <div className="grid max-w-2xl gap-6 md:grid-cols-2">
          <FormField label="Название релиза" htmlFor="dev-title" hint="Как на обложке.">
            <Input id="dev-title" placeholder="Меланхолия" />
          </FormField>
          <FormField label="UPC" htmlFor="dev-upc" error="UPC — 12 цифр." required>
            <Input id="dev-upc" defaultValue="12345" aria-invalid />
          </FormField>
          <FormField label="Статус" htmlFor="dev-status">
            <Select defaultValue="delivered">
              <SelectTrigger id="dev-status">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivered">Доставлен</SelectItem>
                <SelectItem value="delivery">В доставке</SelectItem>
                <SelectItem value="moderation">Модерируется</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Отключённое поле" htmlFor="dev-disabled">
            <Input id="dev-disabled" placeholder="Недоступно" disabled />
          </FormField>
          <FormField label="Период с" htmlFor="dev-date-from">
            <DatePicker
              id="dev-date-from"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="ОТ"
            />
          </FormField>
          <FormField label="Период по" htmlFor="dev-date-to">
            <DatePicker id="dev-date-to" value={dateTo} onChange={setDateTo} placeholder="ДО" />
          </FormField>
          <FormField label="Отчёт (XLSX)" htmlFor="dev-file" className="md:col-span-2">
            <FileInput id="dev-file" accept=".xlsx,.xls,.csv" multiple />
          </FormField>
        </div>
      </DemoSection>

      <footer className="border-t border-white/5 pt-6 text-xs text-gray-600">
        <p className="font-mono uppercase tracking-widest">
          Этап 2.2 UI-overhaul · docs/ui-audit.md · страницы кабинета мигрируют волнами этапа 4
        </p>
      </footer>
    </div>
  )
}
