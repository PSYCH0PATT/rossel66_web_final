"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"
import { Music, Calendar, Barcode, Clock, ArrowLeft, Save, User, Link as LinkIcon, ExternalLink, Percent, Users } from "lucide-react"
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

  const fetchRelease = async () => {
    try {
      const res = await fetch(`/api/releases/${params.id}`)
      if (res.status === 404) {
        notFound()
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
    setSaving(true)
    try {
      const body = {
        title: release.title,
        upc: release.upc,
        releaseDate: release.releaseDate,
        status: release.status,
        coverUrl: release.coverUrl,
        tracks: release.tracks,
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

  const statusColors: Record<string, string> = {
    "Модерируется": "bg-orange-500 text-white",
    "Отклонен": "bg-red-500 text-white",
    "В доставке": "bg-purple-500 text-white",
    "Доставлен": "bg-green-500 text-white",
    // Legacy статусы (маппинг старых значений)
    "На модерации": "bg-orange-500 text-white",
    "Одобрен": "bg-blue-500 text-white",
    "Отклонён": "bg-red-500 text-white",
    "Снят": "bg-gray-500 text-white",
    released: "bg-green-500 text-white",
    moderation: "bg-orange-500 text-white",
    delivery: "bg-purple-500 text-white",
    scheduled: "bg-orange-500 text-white",
    "новый": "bg-gray-500 text-white",
    "Новый": "bg-gray-500 text-white",
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

  if (loading || !release) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center py-16 text-slate-300">Загрузка…</div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/admin/releases" className="text-slate-400 hover:text-white text-sm flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Назад к релизам
          </Link>

          <Button onClick={save} disabled={saving}
            style={{ backgroundColor: '#10b981', color: 'white' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981' }}
          >
            <Save className="h-4 w-4 mr-2" /> Сохранить
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="bg-card border-border text-white overflow-hidden">
              <div className="aspect-square relative">
                <Image src={release.coverUrl || "/placeholder.svg"} alt={release.title} fill className="object-cover" />
                <Badge className={`absolute top-2 right-2 ${statusColors[release.status || 'Доставлен'] || 'bg-gray-500 text-white'}`}>
                  {statusLabels[release.status || 'Доставлен'] || release.status || 'Доставлен'}
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Название</div>
                  <Input value={release.title} onChange={(e) => setRelease({ ...release, title: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">UPC</div>
                  <Input value={release.upc || ''} onChange={(e) => setRelease({ ...release, upc: e.target.value })} />
                </div>
                {release.koalaId && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Koala ID</div>
                    <div className="text-sm text-slate-300 py-2 px-3 bg-slate-800 rounded-md">
                      {release.koalaId}
                    </div>
                  </div>
                )}
                {release.bandlinkUrl && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">BandLink</div>
                    <a 
                      href={release.bandlinkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 py-2 px-3 bg-slate-800 rounded-md"
                    >
                      <LinkIcon className="h-4 w-4" />
                      {release.bandlinkUrl}
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Дата релиза</div>
                  <Input type="date" value={release.releaseDate?.slice(0,10)} onChange={(e) => setRelease({ ...release, releaseDate: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Обложка (URL)</div>
                  <Input placeholder="https://..." value={release.coverUrl || ''} onChange={(e) => setRelease({ ...release, coverUrl: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="cover-upload" className="block text-sm font-medium text-gray-400 mb-2">Загрузить обложку</label>
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
                          setRelease(prev => prev ? { ...prev, coverUrl: data.url } : null)
                        }
                      }}
                    />
                    <label
                      htmlFor="cover-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: '#10b981',
                        border: '1px solid #10b981'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#059669'
                        e.currentTarget.style.borderColor = '#059669'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#10b981'
                        e.currentTarget.style.borderColor = '#10b981'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Выбрать файл
                    </label>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Статус</div>
                  <Select value={release.status || 'Модерируется'} onValueChange={(v) => setRelease({ ...release, status: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Модерируется">Модерируется</SelectItem>
                      <SelectItem value="Отклонен">Отклонен</SelectItem>
                      <SelectItem value="В доставке">В доставке</SelectItem>
                      <SelectItem value="Доставлен">Доставлен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Артист</div>
                  <Select value={release.artistId} onValueChange={(v) => setRelease({ ...release, artistId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={artistName || 'Выберите артиста'} /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-card border-border text-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-green-400" /> Список треков
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {release.tracks.map((track, index) => (
                    <div key={track.id} className="p-4 rounded-lg bg-transparent border border-slate-600/30 hover:border-slate-500/60 transition-colors space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-medium">{index + 1}</div>
                          <div className="text-slate-300">Трек</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setRelease({ ...release, tracks: release.tracks.filter((_, i) => i !== index) })}
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                        >Удалить</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input value={track.title} onChange={(e) => {
                          const tracks = [...release.tracks]; tracks[index] = { ...track, title: e.target.value }; setRelease({ ...release, tracks })
                        }} placeholder="Название" />
                        <Input value={track.isrc || ''} onChange={(e) => {
                          const tracks = [...release.tracks]; tracks[index] = { ...track, isrc: e.target.value }; setRelease({ ...release, tracks })
                        }} placeholder="ISRC" />
                        <Input value={track.duration || ''} onChange={(e) => {
                          const tracks = [...release.tracks]; tracks[index] = { ...track, duration: e.target.value }; setRelease({ ...release, tracks })
                        }} placeholder="Длительность mm:ss" />
                      </div>

                      {/* Доли роялти - показываем только если есть несколько артистов */}
                      {(() => {
                        const mainArtist = users.find(u => u.id === release.artistId)
                        const mainArtistName = mainArtist?.name || ''
                        const featuredArtists = [
                          ...(track.featuredArtistIds || []).map(id => {
                            const artist = users.find(u => u.id === id)
                            return artist?.name || id
                          }),
                          ...(track.featuredArtistNames || [])
                        ].filter(Boolean)
                        const allArtists = [mainArtistName, ...featuredArtists].filter(Boolean)
                        const hasMultipleArtists = allArtists.length > 1

                        if (!hasMultipleArtists) return null

                        const royaltyShares = track.royaltyShares || {}
                        const totalShare = Object.values(royaltyShares).reduce((sum, val) => sum + (Number(val) || 0), 0)
                        const isValid = totalShare === 100 || totalShare === 0

                        return (
                          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Percent className="h-4 w-4 text-green-400" />
                                <span className="text-sm font-medium text-slate-300">Доли роялти</span>
                                {!isValid && totalShare > 0 && (
                                  <span className="text-xs text-red-400">(Сумма: {totalShare}%, должно быть 100%)</span>
                                )}
                                {isValid && totalShare === 100 && (
                                  <span className="text-xs text-green-400">✓ 100%</span>
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
                                className="text-xs"
                              >
                                Распределить поровну
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {allArtists.map((artistName) => (
                                <div key={artistName} className="space-y-1">
                                  <label className="text-xs text-slate-400">{artistName}</label>
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
                                      className="w-20"
                                    />
                                    <span className="text-sm text-slate-400">%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {totalShare === 0 && (
                              <p className="text-xs text-slate-500">Доли не заданы. Используется процент из профиля артиста или равное деление.</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button variant="outline" onClick={() => setRelease({ ...release, tracks: [...release.tracks, { id: `track_${Date.now()}`, title: '', isrc: '', duration: '00:00' }] })}
                      style={{ borderColor: '#10b981', color: '#10b981' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.color = 'white' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#10b981' }}
                    >Добавить трек</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}

