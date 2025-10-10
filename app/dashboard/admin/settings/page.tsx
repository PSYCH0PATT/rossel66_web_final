"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AdminInput } from "@/components/ui/admin-input"
import { User, Lock, Settings, Database, Download, RotateCcw, Trash2 } from "lucide-react"

interface Backup {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'auto' | 'manual'
  filesIncluded: string[]
}

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

  useEffect(() => {
    loadBackups()
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      const userStr = localStorage.getItem("user")
      if (userStr) {
        const user = JSON.parse(userStr)
        
        // Загружаем полные данные админа из API
        const response = await fetch('/api/users')
        const result = await response.json()
        
        if (result.success) {
          const admin = result.users.find((u: any) => u.username === user.username && u.role === 'admin')
          if (admin) {
            setAdminId(admin.id)
            setAdminPassword(admin.password)
            setName(admin.name)
            setEmail(admin.email)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных администратора:', error)
    }
  }

  const handleProfileSave = async () => {
    try {
      // TODO: Implement API call
      alert("Профиль обновлен")
    } catch (error) {
      alert("Ошибка при обновлении профиля")
    }
  }

  const handlePasswordChange = async () => {
    if (!adminId) {
      alert("Ошибка: ID администратора не найден")
      return
    }

    if (!currentPassword) {
      alert("Введите текущий пароль")
      return
    }

    if (currentPassword !== adminPassword) {
      alert("Неверный текущий пароль")
      return
    }

    if (!newPassword) {
      alert("Введите новый пароль")
      return
    }

    if (newPassword.length < 6) {
      alert("Пароль должен содержать минимум 6 символов")
      return
    }

    if (newPassword !== confirmPassword) {
      alert("Пароли не совпадают")
      return
    }

    try {
      const response = await fetch('/api/artists', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: adminId,
          password: newPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert("Пароль успешно обновлен")
        setAdminPassword(newPassword)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        alert("Ошибка при обновлении пароля: " + (result.error || "Неизвестная ошибка"))
      }
    } catch (error) {
      console.error("Error updating password:", error)
      alert("Ошибка при обновлении пароля")
    }
  }

  const handleSystemSettings = async () => {
    try {
      // TODO: Implement API call
      alert("Настройки сохранены")
    } catch (error) {
      alert("Ошибка при сохранении настроек")
    }
  }

  const loadBackups = async () => {
    try {
      setLoadingBackups(true)
      const response = await fetch('/api/backups')
      const data = await response.json()
      
      if (data.success) {
        setBackups(data.backups)
      }
    } catch (error) {
      console.error('Error loading backups:', error)
    } finally {
      setLoadingBackups(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      const response = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(data.message)
        loadBackups()
      } else {
        alert('Ошибка при создании резервной копии')
      }
    } catch (error) {
      alert("Ошибка при создании резервной копии")
    }
  }

  const handleDownloadBackup = async (backupId: string) => {
    try {
      window.open(`/api/backups/download?id=${backupId}`, '_blank')
    } catch (error) {
      alert("Ошибка при скачивании резервной копии")
    }
  }

  const handleRestoreBackup = async (backupId: string, filename: string) => {
    if (!confirm(`Вы уверены, что хотите восстановить данные из бэкапа "${filename}"?\n\nВСЕ ТЕКУЩИЕ ДАННЫЕ БУДУТ ЗАМЕНЕНЫ!`)) {
      return
    }

    try {
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(data.message + '\n\nПерезагрузите страницу для применения изменений.')
        window.location.reload()
      } else {
        alert('Ошибка при восстановлении данных')
      }
    } catch (error) {
      alert("Ошибка при восстановлении данных")
    }
  }

  const handleDeleteBackup = async (backupId: string, filename: string) => {
    if (!confirm(`Вы уверены, что хотите удалить бэкап "${filename}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/backups?id=${backupId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(data.message)
        loadBackups()
      } else {
        alert('Ошибка при удалении резервной копии')
      }
    } catch (error) {
      alert("Ошибка при удалении резервной копии")
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      if (data.success) {
        // Convert to CSV with proper UTF-8 encoding
        const csvRows = [
          ['ID', 'Username', 'Имя', 'Email', 'Роль', 'Дата регистрации', 'Avatar URL', 'VK Music URL', 'Yandex Music URL', 'Spotify URL'],
          ...data.users.map((user: any) => [
            user.id,
            user.username || '',
            user.name,
            user.email,
            user.role === 'admin' ? 'Администратор' : 'Артист',
            new Date(user.createdAt).toLocaleDateString('ru-RU'),
            user.avatarUrl || '',
            user.vkMusicUrl || '',
            user.yandexMusicUrl || '',
            user.spotifyUrl || ''
          ])
        ]
        
        // Escape CSV values and join with semicolons for better Excel compatibility
        const csv = csvRows.map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')
        ).join('\n')
        
        // Add BOM for proper UTF-8 encoding in Excel
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        
        alert("Данные экспортированы")
      }
    } catch (error) {
      alert("Ошибка при экспорте данных")
    }
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Настройки администратора</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-700 text-white" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-500" />
                Профиль администратора
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Имя</Label>
                  <AdminInput 
                    id="name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-slate-600 text-white" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <AdminInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-slate-600 text-white"
                  />
                </div>

                <Button 
                  onClick={handleProfileSave}
                  className="w-full"
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981'
                  }}
                >
                  Сохранить изменения
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 text-white" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-green-500" />
                Изменить пароль
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-slate-300">Текущий пароль</Label>
                  <AdminInput 
                    id="current-password" 
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="border-slate-600 text-white" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-300">Новый пароль</Label>
                  <AdminInput 
                    id="new-password" 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="border-slate-600 text-white" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-300">Подтвердите пароль</Label>
                  <AdminInput 
                    id="confirm-password" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border-slate-600 text-white" 
                  />
                </div>

                <Button 
                  onClick={handlePasswordChange}
                  className="w-full"
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981'
                  }}
                >
                  Обновить пароль
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 text-white" style={{ backgroundColor: '#1a1d24' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-500" />
                Настройки системы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label-name" className="text-slate-300">Название лейбла</Label>
                  <AdminInput 
                    id="label-name" 
                    value={labelName}
                    onChange={(e) => setLabelName(e.target.value)}
                    className="border-slate-600 text-white" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-slate-300">Контактный email</Label>
                  <AdminInput
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="border-slate-600 text-white"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="maintenance-mode" className="flex-1 text-slate-300">
                    Режим обслуживания
                  </Label>
                  <input
                    type="checkbox"
                    id="maintenance-mode"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500 cursor-pointer"
                  />
                </div>

                <Button 
                  onClick={handleSystemSettings}
                  className="w-full"
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981'
                  }}
                >
                  Сохранить настройки
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Блок управления данными на всю ширину */}
        <Card className="border-slate-700 text-white" style={{ backgroundColor: '#1a1d24' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-500" />
              Управление данными
            </CardTitle>
          </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Кнопки действий */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Резервное копирование</Label>
                    <Button 
                      onClick={handleCreateBackup}
                      className="w-full"
                      style={{
                        backgroundColor: '#10b981',
                        color: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#059669'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#10b981'
                      }}
                    >
                      Создать новый бэкап
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Экспорт данных</Label>
                    <Button 
                      onClick={handleExport}
                      className="w-full"
                      style={{
                        backgroundColor: '#10b981',
                        color: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#059669'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#10b981'
                      }}
                    >
                      Экспортировать пользователей
                    </Button>
                  </div>
                </div>

                {/* История бэкапов */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-base">История резервных копий</Label>
                    <Button 
                      onClick={loadBackups}
                      variant="outline"
                      size="sm"
                      className="text-slate-400 border-slate-600 hover:bg-slate-700"
                    >
                      Обновить
                    </Button>
                  </div>
                  
                  {loadingBackups ? (
                    <div className="text-center py-8 text-slate-400">
                      Загрузка...
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Пока нет резервных копий. Создайте первый бэкап.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-2 text-slate-400 font-medium">Дата создания</th>
                            <th className="text-left py-2 px-2 text-slate-400 font-medium">Размер</th>
                            <th className="text-left py-2 px-2 text-slate-400 font-medium">Тип</th>
                            <th className="text-right py-2 px-2 text-slate-400 font-medium">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map((backup) => (
                            <tr key={backup.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                              <td className="py-3 px-2 text-white">{formatDate(backup.createdAt)}</td>
                              <td className="py-3 px-2 text-slate-300">{formatFileSize(backup.size)}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-block px-2 py-1 rounded text-xs ${
                                  backup.type === 'auto' 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'bg-green-500/20 text-green-400'
                                }`}>
                                  {backup.type === 'auto' ? 'Авто' : 'Ручной'}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={() => handleDownloadBackup(backup.id)}
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                    title="Скачать"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => handleRestoreBackup(backup.id, backup.filename)}
                                    variant="outline"
                                    size="sm"
                                    className="border-green-600 text-green-400 hover:bg-green-700 hover:text-white"
                                    title="Восстановить"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteBackup(backup.id, backup.filename)}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-600 text-red-400 hover:bg-red-700 hover:text-white"
                                    title="Удалить"
                                  >
                                    <Trash2 className="h-4 w-4" />
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
                    <div className="space-y-1 mt-2">
                      <p className="text-xs text-slate-500">
                        Автоматически хранятся только последние 10 резервных копий
                      </p>
                      <p className="text-xs text-slate-500">
                        Каждый бэкап содержит: все данные пользователей (включая пароли), релизы, отчеты, личные папки артистов с обложками и плейлистами, базы данных
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
