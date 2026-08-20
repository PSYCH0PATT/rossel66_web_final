"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { EmptyState } from "@/components/ui/empty-state"
import { FileInput } from "@/components/ui/file-input"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge, type ReleaseStatusVariant } from "@/components/ui/status-badge"
import Image from "next/image"
import Link from "next/link"
import { DashboardFooter } from "@/components/dashboard-footer"
import { buildReleaseArtistSelect } from "@/lib/release-artist-link"

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
      // F-02: постраничный /api/artists отдаёт 20 записей и прячет привязанные
      // профили, поэтому привязанный артист часто в список не попадал и селект
      // показывал пустоту. forPicker=1 — выборка под селект, без пагинации.
      try {
        const ares = await fetch('/api/artists?forPicker=1')
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

  /**
   * C-15: бейдж из кита вместо CSS-классов .release-status-badge--*.
   * Маппинг сохранён местный: здесь «Новый» — это модерация, тогда как в
   * общем releaseStatusVariant он попадает в «драфт». Расхождение данных,
   * а не стиля: молча сводить его к общему нельзя.
   */
  const statusVariant = (s?: string): ReleaseStatusVariant => {
    const key = s || "Доставлен"
    if (["Доставлен", "released", "Одобрен"].includes(key)) return "live"
    if (["В доставке", "delivery"].includes(key)) return "delivered"
    if (["Модерируется", "На модерации", "moderation", "scheduled", "Новый", "новый"].includes(key))
      return "moderation"
    if (["Отклонен", "Отклонён", "Снят"].includes(key)) return "rejected"
    return "draft"
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

  /** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
  const parseIsoDate = (value?: string): Date | undefined => {
    const [year, month, day] = (value || "").slice(0, 10).split("-").map(Number)
    if (!year || !month || !day) return undefined
    return new Date(year, month - 1, day)
  }

  /** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт PUT /api/releases. */
  const toIsoDate = (date?: Date): string => {
    if (!date) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
          <Spinner label="Загрузка…" />
        </div>
      )
  }

  if (isDeleted) {
    return (
      
        <EmptyState
          className="card-glass border border-white/5 p-8 rounded-2xl max-w-lg mx-auto mt-12"
          icon="delete_forever"
          title="Релиз удален"
          description="Данный релиз не найден в базе данных. Возможно, он был удален в процессе очистки дубликатов."
          action={
            <Button asChild variant="cta" className="rounded-lg">
              <Link href="/dashboard/admin/releases">
                <span className="material-symbols-outlined text-lg" aria-hidden>arrow_back</span>
                Вернуться к релизу
              </Link>
            </Button>
          }
        />
      )
  }

  if (!release) {
    return (
      
        <EmptyState className="py-16" title="Релиз не найден" />
      )
  }

  // F-02: селект «Артист» инициализируется текущей связью. Если привязанного
  // артиста нет в загруженном списке, он всё равно попадает в опции — иначе
  // Radix рисует плейсхолдер, связь выглядит отсутствующей и её легко потерять.
  const artistSelect = buildReleaseArtistSelect({
    artistId: release.artistId,
    artistName,
    artists: users,
  })

  const inputCls =
    "h-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  return (
    
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* C-01: H1 = название релиза, «Сохранить» — в слоте actions (F-32) */}
        <PageHeader
          size="md"
          className="pb-6"
          backHref="/dashboard/admin/releases"
          title={release.title}
          subtitle={artistName}
          actions={
            <Button
              onClick={() => void save()}
              disabled={saving}
              variant="cta"
              className="rounded-lg"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden>save</span>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card-glass rounded-2xl border border-white/5 overflow-hidden text-white">
              <div className="aspect-square relative">
                <Image src={release.coverUrl || "/placeholder.svg"} alt={release.title} fill className="object-cover" />
                <StatusBadge
                  className="absolute top-3 right-3"
                  variant={statusVariant(release.status)}
                  withIcon={false}
                >
                  {statusLabels[release.status || "Доставлен"] || release.status || "Доставлен"}
                </StatusBadge>
              </div>
              <div className="p-4 md:p-6 space-y-3">
                <FormField label="Название" htmlFor="release-title">
                  <Input id="release-title" className={inputCls} value={release.title} onChange={(e) => setRelease({ ...release, title: e.target.value })} />
                </FormField>
                <FormField label="UPC" htmlFor="release-upc">
                  <Input id="release-upc" className={inputCls} value={release.upc || ''} onChange={(e) => setRelease({ ...release, upc: e.target.value })} />
                </FormField>
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
                {/* F-12: нативный date-инпут выпадал из тёмной темы */}
                <FormField label="Дата релиза" htmlFor="release-date">
                  <DatePicker
                    id="release-date"
                    value={parseIsoDate(release.releaseDate)}
                    onChange={(date) => setRelease({ ...release, releaseDate: toIsoDate(date) })}
                    placeholder="дд.мм.гггг"
                    className={`${inputCls} w-full justify-start normal-case text-sm text-white`}
                  />
                </FormField>
                <FormField label="Обложка (URL)" htmlFor="release-cover-url">
                  <Input
                    id="release-cover-url"
                    className={inputCls}
                    placeholder="https://..."
                    value={release.coverUrl || ''}
                    onChange={(e) => setRelease({ ...release, coverUrl: e.target.value })}
                  />
                </FormField>
                {/* F-12: нативный file-инпут → кнопка из кита */}
                <FormField label="Загрузить обложку" htmlFor="cover-upload">
                  <FileInput
                    id="cover-upload"
                    accept="image/*"
                    buttonLabel="Выбрать файл"
                    buttonVariant="cta"
                    icon="upload"
                    showFileName={false}
                    containerClassName="w-full"
                    buttonClassName="w-full rounded-lg"
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
                </FormField>
                <FormField label="Статус" htmlFor="release-status">
                  <Select value={release.status || 'Модерируется'} onValueChange={(v) => setRelease({ ...release, status: v })}>
                    <SelectTrigger id="release-status" className={`w-full ${inputCls} h-10`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Модерируется">Модерируется</SelectItem>
                      <SelectItem value="Отклонен">Отклонен</SelectItem>
                      <SelectItem value="В доставке">В доставке</SelectItem>
                      <SelectItem value="Доставлен">Доставлен</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Артист" htmlFor="release-artist">
                  <Select value={artistSelect.value} onValueChange={(v) => setRelease({ ...release, artistId: v })}>
                    <SelectTrigger id="release-artist" className={`w-full ${inputCls} h-10`}>
                      <SelectValue placeholder={artistName || 'Выберите артиста'} />
                    </SelectTrigger>
                    <SelectContent>
                      {artistSelect.options.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card-glass rounded-2xl border border-white/5 text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="p-6 md:p-8">
                <SectionHeader
                  className="mb-6"
                  title={
                    <>
                      <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>queue_music</span>
                      Список треков
                    </>
                  }
                />
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
                          variant="destructive-outline"
                          size="sm"
                          onClick={() =>
                            setRelease({ ...release, tracks: release.tracks.filter((_, i) => i !== index) })
                          }
                        >
                          Удалить
                        </Button>
                      </div>
                      {/* F-82: у полей трека всегда подпись — placeholder исчезал при вводе */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField label="Название" htmlFor={`track-title-${index}`}>
                          <Input
                            id={`track-title-${index}`}
                            className={inputCls}
                            value={track.title}
                            onChange={(e) => {
                              const tracks = [...release.tracks]
                              tracks[index] = { ...track, title: e.target.value }
                              setRelease({ ...release, tracks })
                            }}
                            placeholder="Название"
                          />
                        </FormField>
                        <FormField label="ISRC" htmlFor={`track-isrc-${index}`}>
                          <Input
                            id={`track-isrc-${index}`}
                            className={inputCls}
                            value={track.isrc || ''}
                            onChange={(e) => {
                              const tracks = [...release.tracks]
                              tracks[index] = { ...track, isrc: e.target.value }
                              setRelease({ ...release, tracks })
                            }}
                            placeholder="ISRC"
                          />
                        </FormField>
                        <FormField label="Длительность" htmlFor={`track-duration-${index}`}>
                          <Input
                            id={`track-duration-${index}`}
                            className={inputCls}
                            value={track.duration || ''}
                            onChange={(e) => {
                              const tracks = [...release.tracks]
                              tracks[index] = { ...track, duration: e.target.value }
                              setRelease({ ...release, tracks })
                            }}
                            placeholder="Длительность mm:ss"
                          />
                        </FormField>
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
                                <FormField key={artistName} label={artistName} htmlFor={`share-${index}-${artistName}`} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`share-${index}-${artistName}`}
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
                                </FormField>
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
                            { id: `track_${Date.now()}`, title: '', isrc: '', duration: '' },
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

        <DashboardFooter />
      </div>
    )
}
