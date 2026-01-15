"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { users } from "@/lib/data"
import { User, Edit, Trash, Plus, Users, Eye, EyeOff, Music, FileText, DollarSign, MoreVertical } from "lucide-react"
import Link from "next/link"

export default function ArtistsPage() {
  const [allArtists, setAllArtists] = useState<any[]>([])
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [gridCols, setGridCols] = useState<number>(2)
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})

  // Функция для расчета адаптивных размеров (обратная логика для маленьких экранов)
  const getAdaptiveSize = (baseSize: number) => {
    // Чем меньше колонок, тем меньше элементы (обратная пропорция)
    if (gridCols <= 3) return Math.round(baseSize * 0.7)  // Уменьшаем на 30%
    if (gridCols <= 4) return Math.round(baseSize * 0.8)  // Уменьшаем на 20%
    if (gridCols <= 5) return Math.round(baseSize * 0.9)  // Уменьшаем на 10%
    if (gridCols <= 6) return baseSize                    // Базовый размер
    if (gridCols <= 7) return Math.round(baseSize * 1.1)  // Увеличиваем на 10%
    return Math.round(baseSize * 1.2)                     // Увеличиваем на 20% для 8+ колонок
  }

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const response = await fetch('/api/artists')
        const result = await response.json()
        if (result.success) {
          setAllArtists(result.artists)
        }
      } catch (error) {
        console.error('Ошибка при загрузке артистов:', error)
        // Fallback к статичным артистам
        const staticArtists = users.filter((user) => user.role === "artist")
        setAllArtists(staticArtists)
      }
    }

    const computeCols = () => {
      if (typeof window === 'undefined') return 3
      const w = window.innerWidth
      if (w >= 2560) return 8        // 2K и выше
      if (w >= 1920) return 7        // Full HD
      if (w >= 1600) return 6        // >= 1600px
      if (w >= 1280) return 5        // >= 1280px
      if (w >= 1080) return 5        // >= 1080px
      if (w >= 768)  return 4        // планшеты
      if (w >= 640)  return 3        // большие телефоны
      return 3                       // маленькие экраны
    }

    const updateCols = () => {
      const cols = computeCols()
      if (cols) setGridCols(cols)
    }

    fetchArtists()
    updateCols()
    window.addEventListener('resize', updateCols)
    return () => window.removeEventListener('resize', updateCols)
  }, [])

  const handleDeleteArtist = (id: string) => {
    // Получаем динамически добавленных пользователей
    const dynamicUsersStr = localStorage.getItem("dynamicUsers")
    const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []

    // Удаляем артиста из списка
    const updatedUsers = dynamicUsers.filter((user: any) => user.id !== id)

    // Сохраняем обновленный список
    localStorage.setItem("dynamicUsers", JSON.stringify(updatedUsers))

    // Обновляем список артистов
    const staticArtists = users.filter((user) => user.role === "artist")
    const dynamicArtists = updatedUsers.filter((user: any) => user.role === "artist")
    setAllArtists([...staticArtists, ...dynamicArtists])
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const deleteArtist = async (artistId: string, artistName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить артиста "${artistName}"?\n\nЭто действие нельзя отменить.`)) {
      return
    }

    setIsDeleting(prev => ({ ...prev, [artistId]: true }))

    try {
      const response = await fetch(`/api/artists?id=${artistId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // Удаляем артиста из локального состояния
        setAllArtists(prev => prev.filter(artist => artist.id !== artistId))
        console.log(`✅ Артист ${artistName} успешно удален`)
      } else {
        alert(`Ошибка при удалении артиста: ${result.error}`)
        console.error('Ошибка удаления:', result.error)
      }
    } catch (error) {
      console.error('Ошибка при удалении артиста:', error)
      alert('Произошла ошибка при удалении артиста')
    } finally {
      setIsDeleting(prev => ({ ...prev, [artistId]: false }))
    }
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Артисты</h1>
            <p className="text-slate-400">Всего: {allArtists.length} артистов</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/artists/bulk-add">
              <Button 
                className="text-white border transition-all duration-200"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#6b7280'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#60a5fa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#6b7280'
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Массовое добавление
              </Button>
            </Link>
            <Link href="/dashboard/admin/artists/add">
              <Button 
                className="text-white border-2 transition-all duration-200"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#10b981'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#34d399'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#10b981'
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить артиста
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
          {allArtists.map((artist) => (
            <div key={artist.id} className="relative group">
              {/* Кнопка удаления */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  deleteArtist(artist.id, artist.name)
                }}
                disabled={isDeleting[artist.id]}
                className="absolute top-2 right-2 z-10 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  padding: `${getAdaptiveSize(6)}px`,
                  width: `${getAdaptiveSize(28)}px`,
                  height: `${getAdaptiveSize(28)}px`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 1)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {isDeleting[artist.id] ? (
                  <div 
                    className="animate-spin rounded-full border-2 border-white border-t-transparent"
                    style={{
                      width: `${getAdaptiveSize(12)}px`,
                      height: `${getAdaptiveSize(12)}px`
                    }}
                  />
                ) : (
                  <Trash 
                    className="text-white"
                    style={{
                      width: `${getAdaptiveSize(12)}px`,
                      height: `${getAdaptiveSize(12)}px`
                    }}
                  />
                )}
              </button>

              <Link href={`/dashboard/admin/artists/${artist.id}`} className="block">
                <div 
                  className="rounded-xl w-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: 'transparent',
                    borderWidth: `${getAdaptiveSize(1)}px`,
                    borderColor: 'rgba(71, 85, 105, 0.3)',
                    padding: `${getAdaptiveSize(12)}px`,
                    borderRadius: `${getAdaptiveSize(12)}px`,
                    aspectRatio: '1 / 1',
                    minHeight: '0',
                    height: 'auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                  }}
                >
                {/* Avatar - большая и адаптивная */}
                <div 
                  className="flex-1 flex items-center justify-center"
                  style={{ marginBottom: `${getAdaptiveSize(8)}px` }}
                >
                  {artist.avatarUrl ? (
                    <div 
                      className="rounded-full overflow-hidden transition-all duration-200"
                      style={{
                        width: `${getAdaptiveSize(70)}px`,
                        height: `${getAdaptiveSize(70)}px`,
                        borderWidth: `${getAdaptiveSize(3)}px`,
                        borderColor: '#10b981'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#34d399'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#10b981'
                      }}
                    >
                      <img
                        src={artist.avatarUrl || "/placeholder.svg"}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div 
                      className="rounded-full flex items-center justify-center transition-all duration-200"
                      style={{
                        width: `${getAdaptiveSize(70)}px`,
                        height: `${getAdaptiveSize(70)}px`,
                        backgroundColor: 'transparent',
                        borderWidth: `${getAdaptiveSize(3)}px`,
                        borderColor: '#10b981'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#34d399'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#10b981'
                      }}
                    >
                      <User 
                        className="text-white" 
                        style={{
                          width: `${getAdaptiveSize(35)}px`,
                          height: `${getAdaptiveSize(35)}px`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Name & Username - в нижней части */}
                <div 
                  className="mt-auto text-center w-full"
                  style={{ marginBottom: `${getAdaptiveSize(6)}px` }}
                >
                  <h3 
                    className="font-semibold truncate transition-colors w-full"
                    style={{ 
                      color: 'white',
                      fontSize: `${Math.round(getAdaptiveSize(14) * 1.25)}px`,
                      marginBottom: `${getAdaptiveSize(3)}px`
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#93c5fd' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'white' }}
                    title={artist.name}
                  >
                    {artist.name}
                  </h3>
                  <p 
                    className="truncate transition-colors w-full"
                    style={{ 
                      color: '#94a3b8',
                      fontSize: `${Math.round(getAdaptiveSize(11) * 1.3)}px`,
                      marginBottom: `${getAdaptiveSize(3)}px`
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#cbd5e1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
                    title={`@${artist.username}`}
                  >
                    @{artist.username}
                  </p>
                  
                  {/* Новые поля */}
                  {artist.fioShort && (
                    <p 
                      className="truncate transition-colors w-full"
                      style={{ 
                        color: '#64748b',
                        fontSize: `${Math.round(getAdaptiveSize(10) * 1.2)}px`,
                        marginBottom: `${getAdaptiveSize(2)}px`
                      }}
                      title={artist.fio}
                    >
                      {artist.fioShort}
                    </p>
                  )}
                  
                  {artist.percentage && (
                    <p 
                      className="truncate transition-colors w-full"
                      style={{ 
                        color: '#10b981',
                        fontSize: `${Math.round(getAdaptiveSize(10) * 1.2)}px`,
                        marginBottom: `${getAdaptiveSize(2)}px`
                      }}
                    >
                      {artist.percentage}%
                    </p>
                  )}
                </div>

                {/* Password - в самом низу */}
                <div 
                  className="flex items-center justify-center rounded-full transition-all duration-200 w-full"
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.3)',
                    borderWidth: `${getAdaptiveSize(1)}px`,
                    borderColor: 'rgba(71, 85, 105, 0.3)',
                    maxWidth: `${Math.round(getAdaptiveSize(120) * 1.5)}px`,
                    gap: `${Math.round(getAdaptiveSize(4) * 1.5)}px`,
                    padding: `${Math.round(getAdaptiveSize(4) * 1.5)}px ${Math.round(getAdaptiveSize(10) * 1.5)}px`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#34d399'
                    e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                    e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)'
                  }}
                >
                  <div 
                    className="rounded-full transition-colors flex-shrink-0"
                    style={{ 
                      backgroundColor: '#34d399',
                      width: `${Math.round(getAdaptiveSize(6) * 1.5)}px`,
                      height: `${Math.round(getAdaptiveSize(6) * 1.5)}px`
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#6ee7b7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#34d399' }}
                  ></div>
                  <span 
                    className="transition-colors truncate flex-1 min-w-0"
                    style={{ 
                      color: '#cbd5e1',
                      fontSize: `${Math.round(getAdaptiveSize(10) * 1.5)}px`
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'white' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1' }}
                  >
                    {showPasswords[artist.id] ? artist.password : "••••••"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      togglePasswordVisibility(artist.id)
                    }}
                    className="rounded transition-colors flex-shrink-0"
                    style={{ 
                      color: '#94a3b8',
                      padding: `${Math.round(getAdaptiveSize(3) * 1.5)}px`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#34d399'
                      e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8'
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Eye 
                      className={showPasswords[artist.id] ? "hidden" : "block"} 
                      style={{
                        width: `${Math.round(getAdaptiveSize(12) * 1.5)}px`,
                        height: `${Math.round(getAdaptiveSize(12) * 1.5)}px`
                      }}
                    />
                    <EyeOff 
                      className={showPasswords[artist.id] ? "block" : "hidden"} 
                      style={{
                        width: `${Math.round(getAdaptiveSize(12) * 1.5)}px`,
                        height: `${Math.round(getAdaptiveSize(12) * 1.5)}px`
                      }}
                    />
                  </button>
                </div>
              </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
