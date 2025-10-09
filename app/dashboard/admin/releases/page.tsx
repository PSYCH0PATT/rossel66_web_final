"use client"

import { useState, useEffect, useMemo } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminInput } from "@/components/ui/admin-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AdminSelect, AdminSelectContent, AdminSelectItem, AdminSelectTrigger, AdminSelectValue } from "@/components/ui/admin-select"
import { SelectContent, SelectItem } from "@/components/ui/select"
import Image from "next/image"
import { Music, Calendar, Barcode, Plus, Edit, Trash, Loader2, Filter, Search, X } from "lucide-react"
import Link from "next/link"

interface Release {
  id: string
  artistId: string
  artistName: string
  title: string
  coverUrl: string
  upc: string
  releaseDate: string
  status: 'released' | 'moderation' | 'delivery' | 'scheduled'
  tracks: any[]
  createdAt: string
  updatedAt: string
}

export default function AdminReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterArtist, setFilterArtist] = useState<string>("all")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const fetchReleases = async () => {
    try {
      console.log('Загружаем релизы...')
      const response = await fetch('/api/releases')
      const result = await response.json()
      
      if (result.success) {
        // Загружаем пользователей для получения имен артистов
        const usersResponse = await fetch('/api/users')
        const usersResult = await usersResponse.json()
        
        let allUsers: any[] = []
        if (usersResult?.success && Array.isArray(usersResult.users)) {
          allUsers = usersResult.users
        }
        
        // Удалено смешивание с localStorage: используем только данные из API для консистентности ID
        
        // Добавляем информацию об артисте к каждому релизу (+ фиты с треков)
        const releasesWithArtists = result.releases.map((release: any) => {
          const mainArtist = allUsers.find(user => user.id === release.artistId)

          // Собираем список уникальных фитующих артистов из треков
          const featuredIdSet = new Set<string>()
          if (Array.isArray(release.tracks)) {
            for (const t of release.tracks) {
              if (Array.isArray(t?.featuredArtistIds)) {
                for (const fid of t.featuredArtistIds) {
                  if (fid && fid !== release.artistId) featuredIdSet.add(String(fid))
                }
              }
            }
          }
          const featuredNames = Array.from(featuredIdSet)
            .map(id => allUsers.find(u => u.id === id)?.name)
            .filter(Boolean) as string[]
          // Если по ID никого не нашли, попробуем взять имена соисполнителей из треков
          if (featuredNames.length === 0 && Array.isArray(release.tracks)) {
            for (const t of release.tracks) {
              if (Array.isArray(t?.featuredArtistNames)) {
                for (const n of t.featuredArtistNames) {
                  if (n) featuredNames.push(n)
                }
              }
            }
          }

          const displayName = mainArtist
            ? (featuredNames.length ? `${mainArtist.name}, ${featuredNames.join(', ')}` : mainArtist.name)
            : (release.artistName || (featuredNames.length ? featuredNames.join(', ') : 'Неизвестный артист'))

          return {
            ...release,
            artistName: displayName
          }
        })
        
        console.log('Загружено релизов:', releasesWithArtists.length)
        setReleases(releasesWithArtists)
      }
    } catch (error) {
      console.error('Ошибка при загрузке релизов:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReleases()
  }, [])

  // Получаем уникальных артистов для фильтра
  const uniqueArtists = useMemo(() => {
    const artists = releases.map(r => r.artistName).filter(Boolean)
    return Array.from(new Set(artists)).sort()
  }, [releases])

  // Фильтрация и поиск
  const filteredReleases = useMemo(() => {
    return releases.filter(release => {
      // Поиск по названию или артисту
      const matchesSearch = searchQuery === "" || 
        release.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        release.artistName.toLowerCase().includes(searchQuery.toLowerCase())

      // Фильтр по статусу
      const matchesStatus = filterStatus === "all" || release.status === filterStatus

      // Фильтр по артисту (частичное совпадение)
      const matchesArtist = filterArtist === "all" || 
        (filterArtist && release.artistName.toLowerCase().includes(filterArtist.toLowerCase()))

      // Фильтр по дате
      const releaseDate = new Date(release.releaseDate)
      const matchesDateFrom = !filterDateFrom || releaseDate >= new Date(filterDateFrom)
      const matchesDateTo = !filterDateTo || releaseDate <= new Date(filterDateTo)

      return matchesSearch && matchesStatus && matchesArtist && matchesDateFrom && matchesDateTo
    })
  }, [releases, searchQuery, filterStatus, filterArtist, filterDateFrom, filterDateTo])

  // Счетчик активных фильтров
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterStatus !== "all") count++
    if (filterArtist !== "all") count++
    if (filterDateFrom) count++
    if (filterDateTo) count++
    return count
  }, [filterStatus, filterArtist, filterDateFrom, filterDateTo])

  // Сброс фильтров
  const resetFilters = () => {
    setFilterStatus("all")
    setFilterArtist("all")
    setFilterDateFrom("")
    setFilterDateTo("")
    setSearchQuery("")
  }

  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот релиз?')) {
      return
    }

    try {
      const response = await fetch(`/api/releases/${releaseId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setReleases(releases.filter(r => r.id !== releaseId))
      } else {
        alert('Ошибка при удалении релиза')
      }
    } catch (error) {
      console.error('Ошибка при удалении релиза:', error)
      alert('Ошибка при удалении релиза')
    }
  }

  // Status badge colors
  const statusColors = {
    released: "bg-green-500 hover:bg-green-600 text-white",
    moderation: "bg-orange-500 hover:bg-orange-600 text-white",
    delivery: "bg-blue-500 hover:bg-blue-600 text-white",
    scheduled: "bg-purple-500 hover:bg-purple-600 text-white",
  }

  // Status translations
  const statusLabels = {
    released: "Вышел",
    moderation: "Модерация",
    delivery: "Отгрузка",
    scheduled: "Запланирован",
  }

  if (isLoading) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-400" />
          <span className="ml-2 text-green-400">Загрузка релизов...</span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Релизы ({filteredReleases.length} из {releases.length})</h1>

          <div className="flex gap-3">
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <AdminInput
                type="text"
                placeholder="Поиск по названию или артисту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80 border-slate-600 text-white placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Кнопка фильтров */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="relative"
                  style={{
                    borderColor: '#64748b',
                    color: '#cbd5e1',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#334155'
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#cbd5e1'
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Фильтры
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-2 bg-green-500 text-white h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="border-slate-700 text-white max-w-2xl" style={{ backgroundColor: '#1a1d24' }}>
                <DialogHeader>
                  <DialogTitle className="text-xl text-white">Фильтры релизов</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Статус */}
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-slate-300">Статус</Label>
            <AdminSelect value={filterStatus} onValueChange={setFilterStatus}>
              <AdminSelectTrigger 
                id="status" 
                className="border-slate-600 text-white"
              >
                <AdminSelectValue placeholder="Все статусы" />
              </AdminSelectTrigger>
                      <SelectContent className="border-slate-600 text-white" style={{ backgroundColor: '#1a1d24' }}>
                        <SelectItem value="all" className="hover:bg-slate-700 focus:bg-slate-700">Все статусы</SelectItem>
                        <SelectItem value="released" className="hover:bg-slate-700 focus:bg-slate-700">Вышел</SelectItem>
                        <SelectItem value="moderation" className="hover:bg-slate-700 focus:bg-slate-700">Модерация</SelectItem>
                        <SelectItem value="delivery" className="hover:bg-slate-700 focus:bg-slate-700">Отгрузка</SelectItem>
                        <SelectItem value="scheduled" className="hover:bg-slate-700 focus:bg-slate-700">Запланирован</SelectItem>
                      </SelectContent>
                    </AdminSelect>
                  </div>

                  {/* Артист */}
                  <div className="space-y-2">
                    <Label htmlFor="artist" className="text-slate-300">Артист</Label>
                    <AdminInput
                      id="artist"
                      type="text"
                      placeholder="Введите имя артиста..."
                      value={filterArtist === 'all' ? '' : filterArtist}
                      onChange={(e) => setFilterArtist(e.target.value || 'all')}
                      className="border-slate-600 text-white"
                      list="artists-list"
                    />
                    <datalist id="artists-list">
                      {uniqueArtists.map(artist => (
                        <option key={artist} value={artist} />
                      ))}
                    </datalist>
                  </div>

                  {/* Дата от */}
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom" className="text-slate-300">Дата релиза от</Label>
                    <AdminInput
                      id="dateFrom"
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="border-slate-600 text-white"
                    />
                  </div>

                  {/* Дата до */}
                  <div className="space-y-2">
                    <Label htmlFor="dateTo" className="text-slate-300">Дата релиза до</Label>
                    <AdminInput
                      id="dateTo"
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="border-slate-600 text-white"
                    />
                  </div>

                  {/* Кнопки */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={resetFilters}
                      variant="outline"
                      className="flex-1"
                      style={{
                        borderColor: '#64748b',
                        color: '#cbd5e1',
                        backgroundColor: 'transparent'
                      }}
                    >
                      Сбросить
                    </Button>
                    <Button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1"
                      style={{
                        backgroundColor: '#10b981',
                        color: 'white'
                      }}
                    >
                      Применить
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={resetFilters}
              variant="outline"
              style={{
                borderColor: '#64748b',
                color: '#cbd5e1',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#334155'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#cbd5e1'
              }}
            >
              Сбросить фильтры
            </Button>
            <Link href="/dashboard/admin/releases/add">
              <Button 
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
                <Plus className="h-4 w-4 mr-2" />
                Добавить релиз
              </Button>
            </Link>
          </div>
        </div>

        {filteredReleases.length === 0 && releases.length > 0 ? (
          <div className="bg-transparent border border-slate-600/30 rounded-xl p-8 text-center text-white">
            <h2 className="text-xl font-semibold mb-2">Ничего не найдено</h2>
            <p className="text-slate-400 mb-4">
              Попробуйте изменить параметры поиска или фильтры
            </p>
            <Button
              onClick={resetFilters}
              variant="outline"
              style={{
                borderColor: '#64748b',
                color: '#cbd5e1',
                backgroundColor: 'transparent'
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        ) : releases.length === 0 ? (
          <div className="bg-transparent border border-slate-600/30 rounded-xl p-8 text-center text-white">
            <h2 className="text-xl font-semibold mb-2">Нет релизов</h2>
            <p className="text-slate-400 mb-4">
              Релизы будут отображаться здесь после их добавления артистами или администратором.
            </p>
            <Link href="/dashboard/admin/releases/add">
              <Button 
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
                <Plus className="h-4 w-4 mr-2" />
                Добавить первый релиз
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-transparent border border-slate-600/30 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-600/30 hover:bg-slate-700/20">
                  <TableHead className="text-slate-300">Обложка</TableHead>
                  <TableHead className="text-slate-300">Название</TableHead>
                  <TableHead className="text-slate-300">Артист</TableHead>
                  <TableHead className="text-slate-300">UPC</TableHead>
                  <TableHead className="text-slate-300">Дата релиза</TableHead>
                  <TableHead className="text-slate-300">Треков</TableHead>
                  <TableHead className="text-slate-300">Статус</TableHead>
                  <TableHead className="text-slate-300 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReleases.map((release) => (
                  <TableRow key={release.id} className="border-slate-600/30 hover:bg-slate-700/20">
                    <TableCell>
                      <div className="w-12 h-12 relative rounded-lg overflow-hidden">
                        <Image 
                          src={release.coverUrl || "/placeholder.svg"} 
                          alt={release.title} 
                          fill 
                          className="object-cover" 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-white max-w-[200px]">
                      <div className="truncate" title={release.title}>
                        {release.title}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {release.artistName}
                    </TableCell>
                    <TableCell className="text-slate-400 font-mono text-sm">
                      {release.upc}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(release.releaseDate).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-1">
                        <Music className="h-4 w-4 text-green-400" />
                        {release.tracks.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[release.status]}>
                        {statusLabels[release.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/releases/${release.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{
                              borderColor: '#10b981',
                              color: '#10b981',
                              backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#10b981'
                              e.currentTarget.style.color = 'white'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.color = '#10b981'
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRelease(release.id)}
                          style={{
                            borderColor: '#ef4444',
                            color: '#ef4444',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444'
                            e.currentTarget.style.color = 'white'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = '#ef4444'
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  )
}
