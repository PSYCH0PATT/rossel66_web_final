"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { users } from "@/lib/data"
import { User, Edit, Trash, Plus, Users, Music, FileText, DollarSign, MoreVertical } from "lucide-react"
import Link from "next/link"

export default function ArtistsPage() {
  const [allArtists, setAllArtists] = useState<any[]>([])
  const [gridCols, setGridCols] = useState<number>(2)
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({})

  // Функция для расчета адаптивных размеров (обратная логика для маленьких экранов)
  const getAdaptiveSize = (baseSize: number) => {
    // Чем меньше колонок, тем меньше элементы (обратная пропорция)
    if (gridCols <= 2) return Math.round(baseSize * 0.5)   // Мобильные - 50%
    if (gridCols <= 3) return Math.round(baseSize * 0.6)   // Уменьшаем на 40%
    if (gridCols <= 4) return Math.round(baseSize * 0.7)   // Уменьшаем на 30%
    if (gridCols <= 5) return Math.round(baseSize * 0.85)  // Уменьшаем на 15%
    if (gridCols <= 6) return baseSize                     // Базовый размер
    if (gridCols <= 7) return Math.round(baseSize * 1.1)   // Увеличиваем на 10%
    return Math.round(baseSize * 1.2)                      // Увеличиваем на 20% для 8+ колонок
  }

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

  const verifyArtist = async (artistId: string, artistName: string) => {
    setIsVerifying(prev => ({ ...prev, [artistId]: true }))
    
    try {
      const response = await fetch('/api/artists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: artistId, verified: true })
      })

      const result = await response.json()

      if (result.success) {
        // Обновляем локальное состояние
        setAllArtists(prev => prev.map(artist => 
          artist.id === artistId ? { ...artist, verified: true } : artist
        ))
        console.log(`✅ Артист ${artistName} подтвержден`)
      } else {
        alert(`Ошибка при подтверждении артиста: ${result.error}`)
        console.error('Ошибка подтверждения:', result.error)
      }
    } catch (error) {
      console.error('Ошибка при подтверждении артиста:', error)
      alert('Произошла ошибка при подтверждении артиста')
    } finally {
      setIsVerifying(prev => ({ ...prev, [artistId]: false }))
    }
  }

  useEffect(() => {

    const computeCols = () => {
      if (typeof window === 'undefined') return 2
      const w = window.innerWidth
      if (w >= 2560) return 8        // 2K и выше
      if (w >= 1920) return 7        // Full HD
      if (w >= 1600) return 6        // >= 1600px
      if (w >= 1280) return 5        // >= 1280px
      if (w >= 1080) return 5        // >= 1080px
      if (w >= 768)  return 4        // планшеты
      if (w >= 640)  return 3        // большие телефоны
      return 2                       // мобильные - строго 2 колонки
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

  // Фильтрация артистов по статусу подтверждения
  const filteredArtists = allArtists.filter(artist => {
    if (filter === 'verified') return artist.verified ?? true
    if (filter === 'unverified') return !(artist.verified ?? true)
    return true
  })

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">Артисты</h1>
            <p className="text-slate-400">
              {filter === 'all' && `Всего: ${allArtists.length} артистов`}
              {filter === 'verified' && `Подтвержденные: ${filteredArtists.length} из ${allArtists.length}`}
              {filter === 'unverified' && `Неподтвержденные: ${filteredArtists.length} из ${allArtists.length}`}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link href="/dashboard/admin/artists/bulk-add">
              <Button
                className="text-white border transition-all duration-200 flex items-center gap-0 sm:gap-2"
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
                <Users className="h-4 w-4 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Массовое добавление</span>
              </Button>
            </Link>
            <Link href="/dashboard/admin/artists/add">
              <Button
                className="text-white border-2 transition-all duration-200 flex items-center gap-0 sm:gap-2"
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
                <Plus className="h-4 w-4 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Добавить артиста</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Табы фильтрации */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === 'all' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Все ({allArtists.length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === 'verified' ? 'text-white border-b-2 border-green-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Подтвержденные ({allArtists.filter(a => a.verified ?? true).length})
          </button>
          <button
            onClick={() => setFilter('unverified')}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === 'unverified' ? 'text-white border-b-2 border-yellow-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Неподтвержденные ({allArtists.filter(a => !(a.verified ?? true)).length})
          </button>
        </div>

        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
          {filteredArtists.map((artist) => (
            <div key={artist.id} className="relative group">
              {/* Бейдж неподтвержденного артиста */}
              {!(artist.verified ?? true) && (
                <div 
                  className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'rgba(234, 179, 8, 0.9)', color: 'white' }}
                >
                  Новый
                </div>
              )}
              
              {/* Кнопки действий (удаление + подтверждение) */}
              <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Кнопка подтверждения для неподтвержденных артистов */}
                {!(artist.verified ?? true) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      verifyArtist(artist.id, artist.name)
                    }}
                    disabled={isVerifying[artist.id]}
                    className="rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.9)',
                      padding: `${getAdaptiveSize(8)}px`,
                      width: `${getAdaptiveSize(36)}px`,
                      height: `${getAdaptiveSize(36)}px`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(22, 163, 74, 1)'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.9)'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    title="Подтвердить артиста"
                  >
                    {isVerifying[artist.id] ? (
                      <div 
                        className="animate-spin rounded-full border-2 border-white border-t-transparent"
                        style={{
                          width: `${getAdaptiveSize(16)}px`,
                          height: `${getAdaptiveSize(16)}px`
                        }}
                      />
                    ) : (
                      <svg 
                        className="text-white"
                        style={{
                          width: `${getAdaptiveSize(16)}px`,
                          height: `${getAdaptiveSize(16)}px`
                        }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}
                
                {/* Кнопка удаления */}
                <button
                onClick={(e) => {
                  e.preventDefault()
                    e.stopPropagation()
                    deleteArtist(artist.id, artist.name)
                  }}
                  disabled={isDeleting[artist.id]}
                  className="rounded-full transition-all duration-200"
                  title="Удалить артиста"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  padding: `${getAdaptiveSize(8)}px`,
                  width: `${getAdaptiveSize(36)}px`,
                  height: `${getAdaptiveSize(36)}px`
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
                      width: `${getAdaptiveSize(16)}px`,
                      height: `${getAdaptiveSize(16)}px`
                    }}
                  />
                ) : (
                  <Trash 
                    className="text-white"
                    style={{
                      width: `${getAdaptiveSize(16)}px`,
                      height: `${getAdaptiveSize(16)}px`
                    }}
                  />
                )}
              </button>
            </div>

              <Link href={`/dashboard/admin/artists/${artist.id}`} className="block">
                <div 
                  className="artist-card-container rounded-xl w-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden"
                  style={{
                    backgroundColor: 'transparent',
                    borderWidth: '1px',
                    borderColor: 'rgba(71, 85, 105, 0.3)',
                    padding: 'max(8px, 0.6vw)',
                    borderRadius: '12px',
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
                {/* Avatar - резиновый, % от ширины карточки */}
                <div 
                  className="flex-shrink-0 flex items-center justify-center w-full"
                  style={{ marginBottom: 'max(4px, 0.4vw)' }}
                >
                  {artist.avatarUrl ? (
                    <div 
                      className="rounded-full overflow-hidden transition-all duration-200 flex-shrink-0 w-[45.5%] aspect-square border-2 border-solid border-emerald-500 hover:border-emerald-400"
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
                      className="rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 w-[45.5%] aspect-square border-2 border-solid border-emerald-500 hover:border-emerald-400 bg-transparent"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#34d399'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#10b981'
                      }}
                    >
                      <User className="text-white w-1/2 h-1/2" />
                    </div>
                  )}
                </div>

                {/* Name & Username - резиновый текст по vw */}
                <div 
                  className="mt-auto text-center w-full overflow-hidden"
                  style={{ marginBottom: 'max(4px, 0.5vw)' }}
                >
                  <h3 
                    className="artist-card-name font-semibold truncate transition-colors w-full overflow-hidden text-ellipsis"
                    style={{ 
                      color: 'white',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#93c5fd' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'white' }}
                    title={artist.name}
                  >
                    {artist.name}
                  </h3>
                  <p 
                    className="artist-card-username truncate transition-colors w-full overflow-hidden text-ellipsis"
                    style={{ 
                      color: '#94a3b8',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#cbd5e1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
                    title={`@${artist.username}`}
                  >
                    @{artist.username}
                  </p>
                  
                  {artist.fioShort && (
                    <p 
                      className="artist-card-meta truncate transition-colors w-full overflow-hidden text-ellipsis"
                      style={{ color: '#64748b', marginBottom: '1px' }}
                      title={artist.fio}
                    >
                      {artist.fioShort}
                    </p>
                  )}
                  
                  {artist.percentage && (
                    <p 
                      className="artist-card-meta truncate transition-colors w-full overflow-hidden text-ellipsis"
                      style={{ color: '#10b981', marginBottom: '1px' }}
                    >
                      {artist.percentage}%
                    </p>
                  )}
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
