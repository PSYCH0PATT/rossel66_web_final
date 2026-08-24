"use client"

import { useState, useEffect } from "react"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchAllUsersFromApi } from "@/lib/fetch-all-users"
import { fetchAllArtistsFromApi } from "@/lib/fetch-all-artists"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { DashboardFooter } from "@/components/dashboard-footer"

interface Backup {
  id: string
  filename: string
  size: number
  createdAt: string
  type: "auto" | "manual"
  filesIncluded: string[]
}

type BannerState = { variant: "success" | "error" | "info"; message: string }

const inputClass =
  "h-11 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export default function AdminSettingsPage() {
  const profile = useDashboardProfile()
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminPassword, setAdminPassword] = useState<string>("")
  const [name, setName] = useState("Администратор")
  const [email, setEmail] = useState("admin@rossel66.com")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [backups, setBackups] = useState<Backup[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; filename: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string } | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    loadBackups()
  }, [])

  useEffect(() => {
    if (profile?.username) void loadAdminData(profile.username)
  }, [profile?.username])

  const loadAdminData = async (adminUsername: string) => {
    try {
      const response = await fetch(
        `/api/users?username=${encodeURIComponent(adminUsername)}&role=admin`,
        { cache: "no-store" }
      )
      const result = await response.json()

      if (result.success) {
        const admin = result.users?.[0]
        if (admin) {
          setAdminId(admin.id)
          setAdminPassword(admin.password)
          setName(admin.name)
          setEmail(admin.email)
        }
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных администратора:", error)
    }
  }


  const handlePasswordChange = async () => {
    if (!adminId) {
      setBanner({ variant: "error", message: "ID администратора не найден" })
      return
    }

    if (!currentPassword) {
      setBanner({ variant: "error", message: "Введите текущий пароль" })
      return
    }

    // H3/F-UI-9: текущий пароль проверяет СЕРВЕР (bcrypt в PUT /api/artists).
    // Прежняя клиентская сверка с adminPassword всегда падала: /api/users
    // не отдаёт поле password, поэтому adminPassword был пустым.

    if (!newPassword) {
      setBanner({ variant: "error", message: "Введите новый пароль" })
      return
    }

    if (newPassword.length < 6) {
      setBanner({ variant: "error", message: "Пароль должен содержать минимум 6 символов" })
      return
    }

    if (newPassword !== confirmPassword) {
      setBanner({ variant: "error", message: "Пароли не совпадают" })
      return
    }

    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: adminId,
          password: newPassword,
          currentPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setBanner({ variant: "success", message: "Пароль успешно обновлён" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setBanner({
          variant: "error",
          message: "Ошибка при обновлении пароля: " + (result.error || "Неизвестная ошибка"),
        })
      }
    } catch (error) {
      console.error("Error updating password:", error)
      setBanner({ variant: "error", message: "Ошибка при обновлении пароля" })
    }
  }

  const loadBackups = async () => {
    try {
      setLoadingBackups(true)
      const response = await fetch("/api/backups")
      const data = await response.json()

      if (data.success) {
        setBackups(data.backups)
      }
    } catch (error) {
      console.error("Error loading backups:", error)
    } finally {
      setLoadingBackups(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      })

      const data = await response.json()

      if (data.success) {
        setBanner({ variant: "success", message: data.message || "Резервная копия создана" })
        loadBackups()
      } else {
        setBanner({ variant: "error", message: "Ошибка при создании резервной копии" })
      }
    } catch {
      setBanner({ variant: "error", message: "Ошибка при создании резервной копии" })
    }
  }

  const handleDownloadBackup = (backupId: string) => {
    try {
      window.open(`/api/backups/download?id=${backupId}`, "_blank")
    } catch {
      setBanner({ variant: "error", message: "Ошибка при скачивании резервной копии" })
    }
  }

  const confirmRestore = async () => {
    if (!restoreTarget) return
    setRestoreBusy(true)
    try {
      const response = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: restoreTarget.id }),
      })

      const data = await response.json()

      if (data.success) {
        setBanner({
          variant: "success",
          message: (data.message || "Восстановление выполнено") + " Перезагрузите страницу.",
        })
        setRestoreTarget(null)
        window.location.reload()
      } else {
        setBanner({ variant: "error", message: "Ошибка при восстановлении данных" })
      }
    } catch {
      setBanner({ variant: "error", message: "Ошибка при восстановлении данных" })
    } finally {
      setRestoreBusy(false)
    }
  }

  const confirmDeleteBackup = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const response = await fetch(`/api/backups?id=${deleteTarget.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setBanner({ variant: "success", message: data.message || "Бэкап удалён" })
        setDeleteTarget(null)
        loadBackups()
      } else {
        setBanner({ variant: "error", message: "Ошибка при удалении резервной копии" })
      }
    } catch {
      setBanner({ variant: "error", message: "Ошибка при удалении резервной копии" })
    } finally {
      setDeleteBusy(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleExport = async () => {
    try {
      const [allUsers, allArtists] = await Promise.all([
        fetchAllUsersFromApi(),
        fetchAllArtistsFromApi(),
      ])
      const artistById = new Map(allArtists.map((a: Record<string, unknown>) => [a.id, a]))
      const csvRows = [
        ["ID", "Username", "Имя", "Email", "Роль", "ФИО", "ФИО кратко", "Договор", "Процент", "Дата регистрации", "Avatar URL", "VK Music URL", "Yandex Music URL", "Spotify URL"],
        ...allUsers.map((user: Record<string, unknown>) => {
          const artist = user.role === "artist" ? artistById.get(user.id) as Record<string, unknown> | undefined : undefined
          return [
            user.id,
            user.username || "",
            user.name,
            user.email,
            user.role === "admin" ? "Администратор" : "Артист",
            artist?.fio || "",
            artist?.fioShort || "",
            artist?.contract || "",
            artist?.percentage != null ? artist.percentage : "",
            new Date(user.createdAt as string).toLocaleDateString("ru-RU"),
            user.avatarUrl || "",
            user.vkMusicUrl || "",
            user.yandexMusicUrl || "",
            user.spotifyUrl || "",
          ]
        }),
      ]

      const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n")

      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      setBanner({ variant: "success", message: "Данные экспортированы" })
    } catch {
      setBanner({ variant: "error", message: "Ошибка при экспорте данных" })
    }
  }

  return (
    <>
    <div className="space-y-8">
        <PageHeader title="Настройки" subtitle="Пароль и управление данными" />

        {/* C-15: баннер из кита — кнопка закрытия больше не копируется по месту */}
        {banner && (
          <Banner
            variant={banner.variant === "error" ? "danger" : banner.variant}
            onClose={() => setBanner(null)}
          >
            {banner.message}
          </Banner>
        )}

        <div className="grid grid-cols-1 md:max-w-md gap-6">
          <div className="card-glass rounded-2xl border border-white/5 p-6">
            {/* F-59: полосы секций одного цвета — раньше азур и зелёный без логики */}
            <SectionHeader
              className="mb-6"
              size="sm"
              title={
                <>
                  <span className="material-symbols-outlined text-primary text-xl" aria-hidden>lock</span>
                  Пароль
                </>
              }
            />
            <div className="space-y-4">
              <FormField label="Текущий пароль" htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                />
              </FormField>
              <FormField label="Новый пароль" htmlFor="new-password">
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Подтверждение" htmlFor="confirm-password">
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </FormField>
              <Button type="button" onClick={handlePasswordChange} variant="cta" className="w-full rounded-lg">
                Обновить пароль
              </Button>
            </div>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <SectionHeader
            className="mb-6"
            size="sm"
            title={
              <>
                <span className="material-symbols-outlined text-primary text-xl" aria-hidden>database</span>
                Управление данными
              </>
            }
          />
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-gray-500">Резервное копирование</Label>
                <Button type="button" onClick={handleCreateBackup} variant="cta" className="w-full rounded-lg">
                  <span className="material-symbols-outlined text-lg mr-2">save</span>
                  Создать бэкап
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-gray-500">Экспорт</Label>
                <Button
                  type="button"
                  onClick={handleExport}
                  variant="outline"
                  className="w-full rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-lg mr-2">download</span>
                  Экспорт пользователей (CSV)
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-white">История бэкапов</Label>
                <Button
                  type="button"
                  onClick={loadBackups}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-white/15 text-gray-400 hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-base mr-1">refresh</span>
                  Обновить
                </Button>
              </div>

              {loadingBackups ? (
                <div className="flex justify-center py-10">
                  <Spinner label="Загрузка…" />
                </div>
              ) : backups.length === 0 ? (
                <EmptyState
                  className="py-10 border border-dashed border-white/10 rounded-xl"
                  title="Нет резервных копий"
                  description="Создайте первый бэкап."
                />
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden table-glass">
                  <DataTable tableClassName="min-w-[560px]">
                    <DataTableHeader>
                      <DataTableHeadRow>
                        <DataTableHeadCell>Дата</DataTableHeadCell>
                        <DataTableHeadCell>Размер</DataTableHeadCell>
                        <DataTableHeadCell>Тип</DataTableHeadCell>
                        <DataTableHeadCell className="text-right">Действия</DataTableHeadCell>
                      </DataTableHeadRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {backups.map((backup) => (
                        <DataTableRow key={backup.id} className="table-row-hover">
                          <DataTableCell className="text-white [font-variant-numeric:tabular-nums]">{formatDate(backup.createdAt)}</DataTableCell>
                          <DataTableCell className="text-gray-400">{formatFileSize(backup.size)}</DataTableCell>
                          <DataTableCell>
                            <StatusBadge
                              variant={backup.type === "auto" ? "delivered" : "live"}
                              withIcon={false}
                            >
                              {backup.type === "auto" ? "Авто" : "Ручной"}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                onClick={() => handleDownloadBackup(backup.id)}
                                variant="outline"
                                size="sm"
                                aria-label="Скачать бэкап"
                                className="rounded-lg border-white/15 h-9 w-9 p-0 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11 text-gray-300 hover:bg-white/5"
                              >
                                <span className="material-symbols-outlined text-lg">download</span>
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setRestoreTarget({ id: backup.id, filename: backup.filename })}
                                variant="outline"
                                size="sm"
                                aria-label="Восстановить из бэкапа"
                                className="rounded-lg border-primary/40 h-9 w-9 p-0 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11 text-primary hover:bg-primary/10"
                              >
                                <span className="material-symbols-outlined text-lg">restore</span>
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setDeleteTarget({ id: backup.id, filename: backup.filename })}
                                variant="destructive-outline"
                                size="sm"
                                aria-label="Удалить бэкап"
                                className="rounded-lg h-9 w-9 p-0 max-md:h-11 max-md:w-11 pointer-coarse:h-11 pointer-coarse:w-11"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </Button>
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </div>
              )}

              {backups.length > 0 && (
                <div className="space-y-1 text-xs text-gray-500 font-mono">
                  <p>Хранятся последние 10 автоматических копий.</p>
                  <p>Состав: пользователи, релизы, отчёты, файлы артистов.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DashboardFooter />
      </div>

      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent className="bg-surface-dialog border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Восстановление</DialogTitle>
            <DialogDescription className="text-gray-400">
              Восстановить данные из «{restoreTarget?.filename}»? Текущие данные будут заменены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setRestoreTarget(null)} disabled={restoreBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="cta"
              onClick={confirmRestore}
              disabled={restoreBusy}
            >
              {restoreBusy ? "Восстановление..." : "Восстановить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-surface-dialog border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase text-red-400">Удалить бэкап</DialogTitle>
            <DialogDescription className="text-gray-400">
              Удалить «{deleteTarget?.filename}»? Это действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive-outline"
              onClick={confirmDeleteBackup}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
