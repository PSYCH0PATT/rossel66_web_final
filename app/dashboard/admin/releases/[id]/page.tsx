"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

type Release = {
  id: string
  artistId: string
  title: string
  coverUrl: string
  upc?: string
  releaseDate: string
  status?: string
  tracks: any[]
  koalaId?: string
  bandlinkUrl?: string
}

export default function AdminReleaseDetailPage({ params }: { params: { id: string } }) {
  const [release, setRelease] = useState<Release | null>(null)
  const [artistName, setArtistName] = useState<string>("")
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  const fetchRelease = async () => {
    try {
      const res = await fetch(`/api/releases/${params.id}`)
      if (res.status === 404) {
        setIsDeleted(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data?.success && data.release) {
        setRelease(data.release)
        setArtistName(data.release.artistName || "")
      }
      // load artists for artist select (same source as artist profile / list)
      try {
        const ares = await fetch('/api/artists')
        const adata = await ares.json()
        if (adata?.success && Array.isArray(adata.artists)) setUsers(adata.artists)
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRelease()
  }, [params.id])

  const save = async () => {
    if (!release) return
    
    // Auto-inject a default track if tracks array is empty
    let finalTracks = [...release.tracks]
    if (finalTracks.length === 0) {
      finalTracks = [
        {
          id: `track_${Date.now()}_0`,
          title: release.title,
          duration: '', // E2: длительность неизвестна — пусто, а не фиктивное «0:00»
          isrc: ''
        }
      ]
      setRelease({ ...release, tracks: finalTracks })
    }
    
    setSaving(true)
    try {
      const body = {
        title: release.title,
        upc: release.upc,
        releaseDate: release.releaseDate,
        status: release.status,
        coverUrl: release.coverUrl,
        tracks: finalTracks,
        artistId: release.artistId,
        koalaId: release.koalaId,
        bandlinkUrl: release.bandlinkUrl
      }
      await fetch(`/api/releases/${release.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } finally {
      setSaving(false)
    }
  }

  const statusBadgeClass = (s?: string) => {
    const key = s || "Доставлен"
    if (["Доставлен", "released", "Одобрен"].includes(key)) return "release-status-badge release-status-badge--live"
    if (["В доставке", "delivery"].includes(key)) return "release-status-badge release-status-badge--delivered"
    if (["Модерируется", "На модерации", "moderation", "scheduled", "Новый", "новый"].includes(key))
      return "release-status-badge release-status-badge--moderation"
    if (["Отклонен", "Отклонён", "Снят"].includes(key)) return "release-status-badge release-status-badge--rejected"
    return "release-status-badge release-status-badge--draft"
  }

  const statusLabels: Record<string, string> = {
    "Модерируется": "Модерируется",
    "Отклонен": "Отклонен",
    "В доставке": "В доставке",
    "Доставлен": "Доставлен",
    // Legacy статусы (маппинг старых значений)
    "На модерации": "Модерируется",
    "Одобрен": "Модерируется",
    "Отклонён": "Отклонен",
    "Снят": "Отклонен",
    released: "Доставлен",
    moderation: "Модерируется",
    delivery: "В доставке",
    scheduled: "Модерируется",
    "новый": "Модерируется",
    "Новый": "Модерируется",
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-mono uppercase tracking-widest">Загрузка…</p>
        </div>
      )
  }

  if (isDeleted) {
    return (
      
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400 card-glass border border-white/5 p-8 rounded-2xl max-w-lg mx-auto mt-12 text-center">
          <span className="material-symbols-outlined text-destructive text-5xl animate-pulse">delete_forever</span>
          <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">Релиз удален</h2>
          <p className="text-sm text-gray-400 max-w-sm">
            Данный релиз не найден в базе данных. Возможно, он был удален в процессе очистки дубликатов.
          </p>
          <Link href="/dashboard/admin/releases" className="mt-4">
            <Button className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Вернуться к релизу
            </Button>
          </Link>
        </div>
      )
  }

  if (!release) {
    return (
      
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
          <p className="text-sm font-mono uppercase tracking-widest">Релиз не найден</p>
        </div>
      )
  }

  const inputCls =
    "h-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  return (
    
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest flex-wrap gap-x-2 gap-y-1">
              <Link href="/dashboard/admin/dashboard" className="hover:text-primary">
                ДАШБОРД
              </Link>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <Link href="/dashboard/admin/releases" className="hover:text-primary">
                Релизы
              </Link>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-white truncate max-w-[200px]">{release.title}</span>
            </div>
            <div className="border-b border-white/5 pb-6">
              <Link
                href="/dashboard/admin/releases"
                className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest mb-3"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                К списку
              </Link>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase line-clamp-2">
                {release.title}
              </h1>
              <p className="text-sm text-gray-400 mt-2 font-mono">{artistName}</p>
            </div>
          </div>
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold shrink-0 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card-glass rounded-2xl border border-white/5 overflow-hidden text-white">
              <div className="aspect-square relative">
                <Image src={release.coverUrl || "/placeholder.svg"} alt={release.title} fill className="object-cover" />
                <span
                  className={`absolute top-3 right-3 ${statusBadgeClass(release.status)}`}
                >
                  {statusLabels[release.status || "Доставлен"] || release.status || "Доставлен"}
                </span>
              </div>
              <div className="p-4 md:p-6 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Название</div>
                  <Input className={inputCls} value={release.title} onChange={(e) => setRelease({ ...release, title: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">UPC</div>
                  <Input className={inputCls} value={release.upc || ''} onChange={(e) => setRelease({ ...release, upc: e.target.value })} />
                </div>
                {release.koalaId && (
                  <div>
                    <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Koala ID</div>
                    <div className="text-sm text-gray-300 py-2 px-3 rounded-lg border border-white/10 bg-white/5">
                      {release.koalaId}
                    </div>
                  </div>
                )}
                {release.bandlinkUrl && (
                  <div>
                    <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">BandLink</div>
                    <a
                      href={release.bandlinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-accent-azure py-2 px-3 rounded-lg border border-white/10 bg-white/5 hover:border-accent-azure/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base shrink-0">link</span>
                      <span className="truncate min-w-0">{release.bandlinkUrl}</span>
                      <span className="material-symbols-outlined text-base ml-auto shrink-0">open_in_new</span>
                    </a>
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Дата релиза</div>
                  <Input
                    className={inputCls}
                    type="date"
                    value={release.releaseDate?.slice(0, 10)}
                    onChange={(e) => setRelease({ ...release, releaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Обложка (URL)</div>
                  <Input
                    className={inputCls}
                    placeholder="https://..."
                    value={release.coverUrl || ''}
                    onChange={(e) => setRelease({ ...release, coverUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="cover-upload" className="block text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">
                    Загрузить обложку
                  </label>
                  <div className="relative">
                    <input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const formData = new FormData()
                        formData.append('file', file)
                        const res = await fetch('/api/uploads/covers', { method: 'POST', body: formData })
                        const data = await res.json()
                        if (data?.success && data.url) {
                          setRelease((prev) => (prev ? { ...prev, coverUrl: data.url } : null))
                        }
                      }}
                    />
                    <label
                      htmlFor="cover-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-black rounded-lg cursor-pointer bg-primary hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:scale-[1.02] transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">upload</span>
                      Выбрать файл
                    </label>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Статус</div>
                  <Select value={release.status || 'Модерируется'} onValueChange={(v) => setRelease({ ...release, status: v })}>
                    <SelectTrigger className={`w-full ${inputCls} h-10`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Модерируется">Модерируется</SelectItem>
                      <SelectItem value="Отклонен">Отклонен</SelectItem>
                      <SelectItem value="В доставке">В доставке</SelectItem>
                      <SelectItem value="Доставлен">Доставлен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Артист</div>
                  <Select value={release.artistId} onValueChange={(v) => setRelease({ ...release, artistId: v })}>
                    <SelectTrigger className={`w-full ${inputCls} h-10`}>
                      <SelectValue placeholder={artistName || 'Выберите артиста'} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card-glass rounded-2xl border border-white/5 text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="p-6 md:p-8">
                <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
                  <span className="material-symbols-outlined text-primary text-2xl">queue_music</span>
                  Список треков
                </h2>
                <div className="space-y-3">
                  {release.tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="p-4 rounded-xl border border-white/10 hover:border-primary/20 bg-white/[0.02] transition-colors space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-display text-sm">
                            {index + 1}
                          </div>
                          <div className="text-sm text-gray-400 font-mono uppercase tracking-widest">Трек</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRelease({ ...release, tracks: release.tracks.filter((_, i) => i !== index) })
                          }
                          className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                        >
                          Удалить
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input
                          className={inputCls}
                          value={track.title}
                          onChange={(e) => {
                            const tracks = [...release.tracks]
                            tracks[index] = { ...track, title: e.target.value }
                            setRelease({ ...release, tracks })
                          }}
                          placeholder="Название"
                        />
                        <Input
                          className={inputCls}
                          value={track.isrc || ''}
                          onChange={(e) => {
                            const tracks = [...release.tracks]
                            tracks[index] = { ...track, isrc: e.target.value }
                            setRelease({ ...release, tracks })
                          }}
                          placeholder="ISRC"
                        />
                        <Input
                          className={inputCls}
                          value={track.duration || ''}
                          onChange={(e) => {
                            const tracks = [...release.tracks]
                            tracks[index] = { ...track, duration: e.target.value }
                            setRelease({ ...release, tracks })
                          }}
                          placeholder="Длительность mm:ss"
                        />
                      </div>

                      {/* Доли роялти - показываем только если есть несколько артистов */}
                      {(() => {
                        const mainArtist = users.find(u => u.id === release.artistId)
                        const mainArtistName = mainArtist?.name || ''
                        const featuredArtists = [
                          ...(track.featuredArtistIds || []).map((id: string) => {
                            const artist = users.find(u => u.id === id)
                            return artist?.name || id
                          }),
                          ...(track.featuredArtistNames || [])
                        ].filter(Boolean)
                        const allArtists = [mainArtistName, ...featuredArtists].filter(Boolean)
                        const hasMultipleArtists = allArtists.length > 1

                        if (!hasMultipleArtists) return null

                        const royaltyShares = (track.royaltyShares || {}) as Record<string, number>
                        const totalShare = Object.values(royaltyShares).reduce(
                          (sum, val) => sum + (Number(val) || 0),
                          0
                        )
                        const isValid = totalShare === 100 || totalShare === 0

                        return (
                          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="material-symbols-outlined text-primary text-xl">percent</span>
                                <span className="text-sm font-medium text-gray-300">Доли роялти</span>
                                {!isValid && totalShare > 0 && (
                                  <span className="text-xs text-destructive">(Сумма: {totalShare}%, должно быть 100%)</span>
                                )}
                                {isValid && totalShare === 100 && (
                                  <span className="text-xs text-primary font-mono">[OK] 100%</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const equalShare = Math.round(100 / allArtists.length)
                                  const shares: Record<string, number> = {}
                                  allArtists.forEach(artist => {
                                    shares[artist] = equalShare
                                  })
                                  // Корректируем последнего артиста для точности
                                  const lastArtist = allArtists[allArtists.length - 1]
                                  shares[lastArtist] = 100 - (equalShare * (allArtists.length - 1))
                                  
                                  const tracks = [...release.tracks]
                                  tracks[index] = { ...track, royaltyShares: shares }
                                  setRelease({ ...release, tracks })
                                }}
                                className="text-xs border border-white/10 text-gray-400 hover:text-primary"
                              >
                                Распределить поровну
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {allArtists.map((artistName) => (
                                <div key={artistName} className="space-y-1">
                                  <label className="text-xs text-gray-500 font-mono uppercase tracking-widest">{artistName}</label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={royaltyShares[artistName] || ''}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0
                                        const tracks = [...release.tracks]
                                        const newShares = { ...royaltyShares, [artistName]: value }
                                        tracks[index] = { ...track, royaltyShares: newShares }
                                        setRelease({ ...release, tracks })
                                      }}
                                      placeholder="0"
                                      className={`${inputCls} w-20`}
                                    />
                                    <span className="text-sm text-gray-500">%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {totalShare === 0 && (
                              <p className="text-xs text-gray-500 font-mono">
                                Доли не заданы. Используется процент из профиля артиста или равное деление.
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRelease({
                          ...release,
                          tracks: [
                            ...release.tracks,
                            { id: `track_${Date.now()}`, title: '', isrc: '', duration: '00:00' },
                          ],
                        })
                      }
                      className="border-primary/40 text-primary hover:bg-primary hover:text-black font-semibold"
                    >
                      <span className="material-symbols-outlined text-lg mr-1">add</span>
                      Добавить трек
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <span>ROSSEL LABEL ENGINE V2.4 | ADMIN</span>
        </footer>
      </div>
    )
}

