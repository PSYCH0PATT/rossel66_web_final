"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
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
}

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
  const prevPage = () => setOffset((o) => Math.max(0, o - pageSize))
  const nextPage = () => setOffset((o) => o + pageSize)
  const hasPrev = offset > 0
  const hasNext = offset + activities.length < total

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

  const filterInput =
    "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  return (
    <div className="space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary cursor-pointer transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Активность</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">Активность</h1>
            <p className="text-sm text-gray-400 font-light mt-2">Журнал событий платформы</p>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            Фильтры и лента
          </h2>

          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                type="button"
                variant="ghost"
                size="sm"
                className={`rounded-lg border text-xs font-mono uppercase ${
                  categoryId === cat.id
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/[0.08]"
                }`}
                onClick={() => {
                  setCategoryId(cat.id)
                  resetOffset()
                }}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">Роль</label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v)
                  resetOffset()
                }}
              >
                <SelectTrigger className={filterInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="artist">Артист</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">Поиск пользователя</label>
              <Input
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value)
                  resetOffset()
                }}
                placeholder="Имя или username..."
                className={`${filterInput} mb-2`}
                spellCheck={false}
              />
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">Пользователь</label>
              <Select
                value={userId || "all"}
                onValueChange={(v) => {
                  setUserId(v === "all" ? "" : v)
                  resetOffset()
                }}
              >
                <SelectTrigger className={filterInput}>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">Дата от</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  resetOffset()
                }}
                className={filterInput}
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">Дата до</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  resetOffset()
                }}
                className={filterInput}
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 block mb-1.5">На странице</label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v) as 20 | 50 | 100)
                  setOffset(0)
                }}
              >
                <SelectTrigger className={filterInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <div className="space-y-2 py-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-white/[0.04] motion-safe:animate-pulse" aria-hidden />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-mono text-sm">Нет записей</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 overflow-x-auto table-glass">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-left text-xs font-mono uppercase text-gray-500 border-b border-white/10">
                      <th className="p-3 sm:p-4 whitespace-nowrap">Дата / время</th>
                      <th className="p-3 sm:p-4 whitespace-nowrap">Тип</th>
                      <th className="p-3 sm:p-4">Заголовок</th>
                      <th className="p-3 sm:p-4">Описание</th>
                      <th className="p-3 sm:p-4 whitespace-nowrap">Кто</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((item) => {
                      const ic = activityIcon(item.type)
                      return (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.04] table-row-hover">
                          <td className="p-3 sm:p-4 text-gray-300 whitespace-nowrap text-xs sm:text-sm [font-variant-numeric:tabular-nums]">
                            {formatDateTime(item.createdAt)}
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`material-symbols-outlined text-lg flex-shrink-0 ${ic.className}`}>
                                {ic.name}
                              </span>
                              <span className="text-gray-300 text-xs sm:text-sm whitespace-nowrap truncate">
                                {TYPE_LABELS[item.type] || item.type}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 font-medium text-white text-xs sm:text-sm min-w-0 max-w-[220px]">
                            <span className="line-clamp-2">{item.title}</span>
                          </td>
                          <td className="p-3 sm:p-4 text-gray-400 text-xs sm:text-sm min-w-[200px] max-w-md">
                            <div className="whitespace-normal break-words line-clamp-3">{item.description}</div>
                          </td>
                          <td className="p-3 sm:p-4 text-gray-300 text-xs sm:text-sm whitespace-nowrap">{whoLabel(item)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono text-gray-500">
                <span className="[font-variant-numeric:tabular-nums]">
                  {offset + 1}–{Math.min(offset + pageSize, total)} из {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={prevPage}
                    className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-base mr-1">chevron_left</span>
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={nextPage}
                    className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                  >
                    Далее
                    <span className="material-symbols-outlined text-base ml-1">chevron_right</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DashboardFooter />
      </div>
    )
}
