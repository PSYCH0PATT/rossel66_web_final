"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AdminInput } from "@/components/ui/admin-input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { fetchAllUsersFromApi } from "@/lib/fetch-all-users"

interface Backup {
  id: string
  filename: string
  size: number
  createdAt: string
  type: "auto" | "manual"
  filesIncluded: string[]
}

type Banner = { variant: "success" | "error" | "info"; message: string }

const inputClass =
  "h-11 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export default function AdminSettingsPage() {
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminPassword, setAdminPassword] = useState<string>("")
  const [name, setName] = useState("Администратор")
  const [email, setEmail] = useState("admin@rossel66.com")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [labelName, setLabelName] = useState("ROSSEL 66")
  const [contactEmail, setContactEmail] = useState("contact@rossel66.com")
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; filename: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string } | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    loadBackups()
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      const userStr = localStorage.getItem("user")
      if (userStr) {
        const user = JSON.parse(userStr)

        const response = await fetch(`/api/users?username=${encodeURIComponent(user.username)}&role=admin`)
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
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных администратора:", error)
    }
  }

  const handleProfileSave = async () => {
    try {
      setBanner({ variant: "info", message: "Профиль обновлён (локально, API в разработке)." })
    } catch {
      setBanner({ variant: "error", message: "Ошибка при обновлении профиля" })
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

    if (currentPassword !== adminPassword) {
      setBanner({ variant: "error", message: "Неверный текущий пароль" })
      return
    }

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
        }),
      })

      const result = await response.json()

      if (result.success) {
        setBanner({ variant: "success", message: "Пароль успешно обновлён" })
        setAdminPassword(newPassword)
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

  const handleSystemSettings = async () => {
    try {
      setBanner({ variant: "info", message: "Настройки сохранены (локально, API в разработке)." })
    } catch {
      setBanner({ variant: "error", message: "Ошибка при сохранении настроек" })
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
      const allUsers = await fetchAllUsersFromApi()
      const csvRows = [
        ["ID", "Username", "Имя", "Email", "Роль", "Дата регистрации", "Avatar URL", "VK Music URL", "Yandex Music URL", "Spotify URL"],
        ...allUsers.map((user: Record<string, unknown>) => [
          user.id,
          user.username || "",
          user.name,
          user.email,
          user.role === "admin" ? "Администратор" : "Артист",
          new Date(user.createdAt as string).toLocaleDateString("ru-RU"),
          user.avatarUrl || "",
          user.vkMusicUrl || "",
          user.yandexMusicUrl || "",
          user.spotifyUrl || "",
        ]),
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

  const bannerStyles =
    banner?.variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : banner?.variant === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-white/15 bg-white/5 text-gray-300"

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary cursor-pointer transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Настройки</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">Настройки</h1>
            <p className="text-sm text-gray-400 font-light mt-2">Профиль, система и резервные копии</p>
          </div>
        </div>

        {banner && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${bannerStyles}`} role="status">
            <span className="material-symbols-outlined flex-shrink-0">
              {banner.variant === "success" ? "check_circle" : banner.variant === "error" ? "error" : "info"}
            </span>
            <span>{banner.message}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="ml-auto text-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Закрыть уведомление"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-glass rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              <span className="material-symbols-outlined text-primary text-xl">person</span>
              Профиль
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-mono uppercase text-gray-500">
                  Имя
                </Label>
                <AdminInput id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-mono uppercase text-gray-500">
                  Email
                </Label>
                <AdminInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                  spellCheck={false}
                />
              </div>
              <Button type="button" onClick={handleProfileSave} className="w-full rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold">
                Сохранить
              </Button>
            </div>
          </div>

          <div className="card-glass rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-accent-azure rounded-full" />
              <span className="material-symbols-outlined text-accent-azure text-xl">lock</span>
              Пароль
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-xs font-mono uppercase text-gray-500">
                  Текущий пароль
                </Label>
                <AdminInput
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-mono uppercase text-gray-500">
                  Новый пароль
                </Label>
                <AdminInput
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-mono uppercase text-gray-500">
                  Подтверждение
                </Label>
                <AdminInput
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
              <Button type="button" onClick={handlePasswordChange} className="w-full rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold">
                Обновить пароль
              </Button>
            </div>
          </div>

          <div className="card-glass rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-purple-400 rounded-full opacity-80" />
              <span className="material-symbols-outlined text-purple-400 text-xl">tune</span>
              Система
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label-name" className="text-xs font-mono uppercase text-gray-500">
                  Название лейбла
                </Label>
                <AdminInput id="label-name" value={labelName} onChange={(e) => setLabelName(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email" className="text-xs font-mono uppercase text-gray-500">
                  Контактный email
                </Label>
                <AdminInput
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-between py-2 gap-4">
                <Label htmlFor="maintenance-mode" className="text-sm text-gray-400 flex-1 cursor-pointer">
                  Режим обслуживания
                </Label>
                <Switch
                  id="maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <Button type="button" onClick={handleSystemSettings} className="w-full rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold">
                Сохранить системные
              </Button>
            </div>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            <span className="material-symbols-outlined text-primary text-xl">database</span>
            Управление данными
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-gray-500">Резервное копирование</Label>
                <Button type="button" onClick={handleCreateBackup} className="w-full rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold">
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
                <div className="text-center py-10 text-gray-500 text-sm font-mono">Загрузка...</div>
              ) : backups.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm border border-dashed border-white/10 rounded-xl">
                  Нет резервных копий. Создайте первый бэкап.
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-x-auto table-glass">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-left text-xs font-mono uppercase text-gray-500 border-b border-white/10">
                        <th className="p-3">Дата</th>
                        <th className="p-3">Размер</th>
                        <th className="p-3">Тип</th>
                        <th className="p-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-b border-white/5 hover:bg-white/[0.04] table-row-hover">
                          <td className="p-3 text-white [font-variant-numeric:tabular-nums]">{formatDate(backup.createdAt)}</td>
                          <td className="p-3 text-gray-400">{formatFileSize(backup.size)}</td>
                          <td className="p-3">
                            <span
                              className={`release-status-badge text-[0.65rem] ${
                                backup.type === "auto"
                                  ? "bg-accent-azure/15 text-accent-azure border-accent-azure/30"
                                  : "bg-primary/15 text-primary border-primary/30"
                              } border`}
                            >
                              {backup.type === "auto" ? "Авто" : "Ручной"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                onClick={() => handleDownloadBackup(backup.id)}
                                variant="outline"
                                size="sm"
                                aria-label="Скачать бэкап"
                                className="rounded-lg border-white/15 h-9 w-9 p-0 text-gray-300 hover:bg-white/5"
                              >
                                <span className="material-symbols-outlined text-lg">download</span>
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setRestoreTarget({ id: backup.id, filename: backup.filename })}
                                variant="outline"
                                size="sm"
                                aria-label="Восстановить из бэкапа"
                                className="rounded-lg border-primary/40 h-9 w-9 p-0 text-primary hover:bg-primary/10"
                              >
                                <span className="material-symbols-outlined text-lg">restore</span>
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setDeleteTarget({ id: backup.id, filename: backup.filename })}
                                variant="outline"
                                size="sm"
                                aria-label="Удалить бэкап"
                                className="rounded-lg border-red-500/40 h-9 w-9 p-0 text-red-400 hover:bg-red-500/10"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>

      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
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
              className="bg-primary text-black hover:bg-primary/90"
              onClick={confirmRestore}
              disabled={restoreBusy}
            >
              {restoreBusy ? "Восстановление..." : "Восстановить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
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
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={confirmDeleteBackup}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
