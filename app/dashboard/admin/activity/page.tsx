"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { DatePicker } from "@/components/ui/date-picker"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterChip } from "@/components/ui/filter-chip"
import { FormField } from "@/components/ui/form-field"
import { PageHeader } from "@/components/ui/page-header"
import { Pagination } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SectionHeader } from "@/components/ui/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SkeletonRows } from "@/components/ui/skeleton-presets"
import type { ActivityType } from "@/lib/storage"
import { DashboardFooter } from "@/components/dashboard-footer"

const CATEGORIES = [
  { id: "all", label: "Общее", types: undefined },
  { id: "releases", label: "Релизы", types: ["release_added", "release_status_updated"] as ActivityType[] },
  { id: "playlists", label: "Плейлисты", types: ["playlist_found"] as ActivityType[] },
  { id: "reports", label: "Отчёты", types: ["report_received", "reports_generated"] as ActivityType[] },
  { id: "payments", label: "Выплаты", types: ["payment_sent"] as ActivityType[] },
  {
    id: "artists",
    label: "Артисты",
    types: ["artist_added", "artist_removed", "user_data_updated"] as ActivityType[],
  },
]

const TYPE_LABELS: Record<ActivityType, string> = {
  release_added: "Релиз добавлен",
  playlist_found: "Плейлист найден",
  report_received: "Отчёт назначен",
  payment_sent: "Выплата отправлена",
  user_data_updated: "Данные артиста обновлены",
  reports_generated: "Отчёты сгенерированы",
  artist_added: "Артист добавлен",
  artist_removed: "Артист удалён",
  release_status_updated: "Статус релиза обновлён",
  parser_started: "Парсер запущен",
  parser_completed: "Парсер завершён",
  parser_error: "Ошибка парсера",
  parser_release_found: "Парсер: релиз найден",
  parser_release_updated: "Парсер: релиз обновлён",
  parser_playlist_found: "Парсер: плейлист найден",
  analytics_import: "Импорт аналитики",
  analytics_cleanup: "Очистка аналитики",
  artist_auto_created: "Артист создан автоматически",
  report_status_changed: "Статус отчёта изменён",
  advance_issued: "Аванс выдан",
  advance_removed: "Аванс удалён",
}

/** Вид чипов-фильтров админки — один на /artists, /payments и /activity (F-22). */
const CHIP_CLASS =
  "rounded-lg border-white/10 bg-white/5 px-3 font-mono text-xs uppercase text-gray-400 hover:bg-white/[0.08] hover:text-white data-[active=true]:border-primary/40 data-[active=true]:bg-primary/20 data-[active=true]:text-primary"

function activityIcon(type: ActivityType): { name: string; className: string } {
  switch (type) {
    case "release_added":
    case "parser_release_found":
    case "parser_release_updated":
      return { name: "library_music", className: "text-sky-400" }
    case "playlist_found":
    case "parser_playlist_found":
      return { name: "queue_music", className: "text-rose-400" }
    case "report_received":
    case "reports_generated":
      return { name: "description", className: "text-emerald-400" }
    case "payment_sent":
      return { name: "payments", className: "text-amber-400" }
    case "user_data_updated":
      return { name: "person", className: "text-violet-400" }
    case "artist_added":
      return { name: "person_add", className: "text-emerald-400" }
    case "artist_removed":
      return { name: "person_remove", className: "text-red-400" }
    case "release_status_updated":
      return { name: "task_alt", className: "text-sky-400" }
    case "parser_started":
      return { name: "play_circle", className: "text-blue-400" }
    case "parser_completed":
      return { name: "check_circle", className: "text-green-400" }
    case "parser_error":
      return { name: "error", className: "text-red-400" }
    case "analytics_import":
    case "analytics_cleanup":
      return { name: "analytics", className: "text-amber-400" }
    default:
      return { name: "article", className: "text-gray-400" }
  }
}

interface ActivityItem {
  id: string
  type: ActivityType
  userId: string
  userRole: "artist" | "admin"
  title: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

interface UserOption {
  id: string
  name: string
  username?: string
  role?: string
}

/** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

/** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт /api/activities. */
function toIsoDate(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categoryId, setCategoryId] = useState("all")
  const [role, setRole] = useState<string>("all")
  const [userId, setUserId] = useState<string>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [users, setUsers] = useState<UserOption[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("")
  const [userPickerOpen, setUserPickerOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300)
    return () => clearTimeout(t)
  }, [userSearch])

  const fetchUsersForFilters = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("pageSize", "50")
      const q = debouncedUserSearch.trim()
      if (q) params.set("q", q)
      const res = await fetch(`/api/users?${params.toString()}`)
      const data = await res.json()
      let list: UserOption[] = Array.isArray(data?.users)
        ? data.users.map((u: { id: string; name?: string; username?: string; role?: string }) => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            role: u.role,
          }))
        : []
      if (userId && !list.some((u) => u.id === userId)) {
        const ures = await fetch(`/api/users?id=${encodeURIComponent(userId)}`)
        const udata = await ures.json()
        const u = udata?.users?.[0]
        if (u) {
          list = [{ id: u.id, name: u.name || u.username, username: u.username, role: u.role }, ...list]
        }
      }
      setUsers(list)
    } catch (e) {
      console.error("Failed to load users:", e)
    }
  }, [debouncedUserSearch, userId])

  useEffect(() => {
    fetchUsersForFilters()
  }, [fetchUsersForFilters])

  const loadActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(pageSize))
      params.set("offset", String(offset))
      if (role && role !== "all") params.set("role", role)
      if (userId) params.set("userId", userId)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const cat = CATEGORIES.find((c) => c.id === categoryId)
      if (cat?.types?.length) {
        cat.types.forEach((t) => params.append("type", t))
      }

      const res = await fetch(`/api/activities?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setActivities(data.activities || [])
        setTotal(data.total ?? data.activities?.length ?? 0)
      }
    } catch (e) {
      console.error("Failed to load activities:", e)
    } finally {
      setLoading(false)
    }
  }, [categoryId, role, userId, dateFrom, dateTo, offset, pageSize])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const resetOffset = () => setOffset(0)

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const whoLabel = (item: ActivityItem) => {
    if (item.userId === "system") return "Система"
    const u = users.find((x) => x.id === item.userId)
    return u ? u.name || u.username || item.userId : item.userId
  }

  const selectedUser = users.find((u) => u.id === userId)
  const selectedUserLabel = userId ? selectedUser?.name || selectedUser?.username || userId : "Все"

  const filterInput =
    "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  return (
    <div className="space-y-8">
        <PageHeader size="md" title="Активность" subtitle="Журнал событий платформы" />

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 space-y-6">
          <SectionHeader className="mb-0" size="sm" title="Фильтры и лента" />

          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {CATEGORIES.map((cat) => (
              <FilterChip
                key={cat.id}
                tone="success"
                active={categoryId === cat.id}
                className={CHIP_CLASS}
                onClick={() => {
                  setCategoryId(cat.id)
                  resetOffset()
                }}
              >
                {cat.label}
              </FilterChip>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <FormField label="Роль" htmlFor="filter-role" className="space-y-1.5">
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v)
                  resetOffset()
                }}
              >
                <SelectTrigger id="filter-role" className={filterInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="artist">Артист</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {/* F-50: было два контрола одного измерения — инпут «Поиск
                пользователя» и селект «Пользователь». Теперь один combobox:
                поиск живёт внутри списка. */}
            <FormField label="Пользователь" htmlFor="filter-user" className="space-y-1.5">
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="filter-user"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={userPickerOpen}
                    className={`${filterInput} justify-between font-normal`}
                  >
                    <span className="truncate">{selectedUserLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(20rem,var(--radix-popover-trigger-width))] p-0">
                  {/* Фильтрация серверная (запрос по q), поэтому cmdk своим
                      фильтром список не режет. */}
                  <Command shouldFilter={false} className="bg-transparent text-white">
                    <CommandInput
                      value={userSearch}
                      onValueChange={(v) => {
                        setUserSearch(v)
                        resetOffset()
                      }}
                      placeholder="Имя или username..."
                    />
                    <CommandList className="max-h-60">
                      <CommandEmpty className="py-4 text-center text-xs font-mono uppercase tracking-widest text-gray-500">
                        Никого не нашлось
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setUserId("")
                            setUserPickerOpen(false)
                            resetOffset()
                          }}
                        >
                          Все
                        </CommandItem>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={u.id}
                            onSelect={() => {
                              setUserId(u.id)
                              setUserPickerOpen(false)
                              resetOffset()
                            }}
                          >
                            {u.name || u.username || u.id}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormField>
            {/* F-12: нативные date-инпуты выпадали из тёмной темы */}
            <FormField label="Дата от" htmlFor="filter-date-from" className="space-y-1.5">
              <DatePicker
                id="filter-date-from"
                value={parseIsoDate(dateFrom)}
                onChange={(date) => {
                  setDateFrom(toIsoDate(date))
                  resetOffset()
                }}
                placeholder="дд.мм.гггг"
                className={`${filterInput} justify-start normal-case`}
              />
            </FormField>
            <FormField label="Дата до" htmlFor="filter-date-to" className="space-y-1.5">
              <DatePicker
                id="filter-date-to"
                value={parseIsoDate(dateTo)}
                onChange={(date) => {
                  setDateTo(toIsoDate(date))
                  resetOffset()
                }}
                placeholder="дд.мм.гггг"
                className={`${filterInput} justify-start normal-case`}
              />
            </FormField>
            <FormField label="На странице" htmlFor="filter-page-size" className="space-y-1.5">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v) as 20 | 50 | 100)
                  setOffset(0)
                }}
              >
                <SelectTrigger id="filter-page-size" className={filterInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOffset(0)
                  loadActivities()
                }}
                className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5 w-full md:w-auto"
              >
                <span className="material-symbols-outlined text-base mr-1">refresh</span>
                Обновить
              </Button>
            </div>
          </div>

          {loading ? (
            <SkeletonRows className="py-6" rows={6} />
          ) : activities.length === 0 ? (
            <EmptyState className="py-12" title="Нет записей" />
          ) : (
            <>
              {/* C-10/F-77: скролл с видимым индикатором — «Описание» и «Кто»
                  на 390 больше не пропадают за краем без аффорданса */}
              <div className="rounded-2xl border border-white/10 overflow-hidden table-glass">
                <DataTable tableClassName="min-w-[700px]">
                  <DataTableHeader>
                    <DataTableHeadRow>
                      <DataTableHeadCell>Дата / время</DataTableHeadCell>
                      <DataTableHeadCell>Событие</DataTableHeadCell>
                      <DataTableHeadCell>Описание</DataTableHeadCell>
                      <DataTableHeadCell>Кто</DataTableHeadCell>
                    </DataTableHeadRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {activities.map((item) => {
                      const ic = activityIcon(item.type)
                      const typeLabel = TYPE_LABELS[item.type] || item.type
                      return (
                        <DataTableRow key={item.id} className="table-row-hover">
                          <DataTableCell className="text-gray-300 whitespace-nowrap text-xs sm:text-sm [font-variant-numeric:tabular-nums]">
                            {formatDateTime(item.createdAt)}
                          </DataTableCell>
                          {/* F-49: «Тип» и «Заголовок» были одной и той же
                              строкой в двух колонках — теперь одна колонка,
                              тип несёт иконка, подпись остаётся только когда
                              она добавляет что-то к заголовку. */}
                          <DataTableCell className="min-w-0 max-w-[260px]">
                            <div className="flex items-start gap-2 min-w-0">
                              <span
                                className={`material-symbols-outlined text-lg flex-shrink-0 ${ic.className}`}
                                title={typeLabel}
                                aria-hidden
                              >
                                {ic.name}
                              </span>
                              <div className="min-w-0">
                                <span className="line-clamp-2 font-medium text-white text-xs sm:text-sm">
                                  {item.title}
                                </span>
                                {typeLabel !== item.title && (
                                  <span className="block truncate text-xs text-gray-500">{typeLabel}</span>
                                )}
                              </div>
                            </div>
                          </DataTableCell>
                          <DataTableCell className="text-gray-400 text-xs sm:text-sm min-w-[200px] max-w-md">
                            <div className="whitespace-normal break-words line-clamp-3">{item.description}</div>
                          </DataTableCell>
                          <DataTableCell className="text-gray-300 text-xs sm:text-sm whitespace-nowrap">
                            {whoLabel(item)}
                          </DataTableCell>
                        </DataTableRow>
                      )
                    })}
                  </DataTableBody>
                </DataTable>
              </div>

              {/* C-06: счётчик и навигация — один компонент, строки русские */}
              <Pagination
                page={Math.floor(offset / pageSize) + 1}
                total={total}
                pageSize={pageSize}
                loading={loading}
                itemForms={["событие", "события", "событий"]}
                onPageChange={(p) => setOffset((p - 1) * pageSize)}
              />
            </>
          )}
        </div>

        <DashboardFooter />
      </div>
    )
}
