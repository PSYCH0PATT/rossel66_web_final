"use client"

import React, { useEffect, useState } from "react"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { FileInput } from "@/components/ui/file-input"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fetchAllUsersFromApi } from "@/lib/fetch-all-users"

interface Track {
  title: string
  isrc: string
  duration: string
}

const inputCls =
  "h-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

/** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

/** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт POST /api/releases. */
function toIsoDate(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function AddReleasePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [artists, setArtists] = useState<Array<{ id: string; name: string; username: string; role: string }>>([])

  const [artistId, setArtistId] = useState("")
  const [title, setTitle] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [upc, setUpc] = useState("")
  const [releaseDate, setReleaseDate] = useState("")
  const [status, setStatus] = useState<"Модерируется" | "Отклонен" | "В доставке" | "Доставлен">("Модерируется")
  const [tracks, setTracks] = useState<Track[]>([{ title: "", isrc: "", duration: "" }])

  useEffect(() => {
    const loadArtists = async () => {
      try {
        const all = await fetchAllUsersFromApi({ role: "artist" })
        setArtists(all.map((u: any) => ({ id: u.id, name: u.name, username: u.username, role: u.role })))
      } catch {
        setArtists([])
      }
    }
    loadArtists()
  }, [])

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setCoverPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addTrack = () => {
    setTracks([...tracks, { title: "", isrc: "", duration: "" }])
  }

  const removeTrack = (index: number) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter((_, i) => i !== index))
    }
  }

  const updateTrack = (index: number, field: keyof Track, value: string) => {
    const updatedTracks = tracks.map((track, i) => (i === index ? { ...track, [field]: value } : track))
    setTracks(updatedTracks)
  }

  const validateForm = () => {
    if (!artistId || !title || !upc || !releaseDate || tracks.length === 0) {
      setError("Пожалуйста, заполните все обязательные поля")
      return false
    }

    if (!/^\d{12}$/.test(upc)) {
      setError("UPC должен содержать ровно 12 цифр")
      return false
    }

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      if (!track.title || !track.duration) {
        setError(`Трек ${i + 1}: заполните название и длительность`)
        return false
      }

      if (!/^\d{1,2}:\d{2}$/.test(track.duration)) {
        setError(`Трек ${i + 1}: длительность должна быть в формате MM:SS (например, 3:45)`)
        return false
      }

      if (track.isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(track.isrc)) {
        setError(`Трек ${i + 1}: ISRC должен быть в формате CCOOOYYNNNNN (например, USRC17607839)`)
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const selectedArtist = artists.find((artist) => artist.id === artistId)
      const releaseData = {
        artistId,
        artistName: selectedArtist?.name || "Неизвестный артист",
        title,
        coverUrl: coverPreview || "/placeholder.svg",
        upc,
        releaseDate,
        status,
        tracks: tracks.filter((track) => track.title && track.duration),
      }

      const response = await fetch("/api/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(releaseData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Произошла ошибка при создании релиза")
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/dashboard/admin/releases")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при создании релиза")
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusSelectItems: { value: "Модерируется" | "Отклонен" | "В доставке" | "Доставлен"; label: string }[] = [
    { value: "Модерируется", label: "Модерируется" },
    { value: "Отклонен", label: "Отклонен" },
    { value: "В доставке", label: "В доставке" },
    { value: "Доставлен", label: "Доставлен" },
  ]

  return (
    <div className="space-y-8">
        {/* F-32: primary экрана — в слоте actions шапки, как в карточке релиза;
            «Отмена» рядом ghost-ом. Кнопка вне формы связана с ней по id. */}
        <PageHeader
          backHref="/dashboard/admin/releases"
          title="Добавить релиз"
          subtitle="Заполните карточку релиза, обложку и треклист. UPC — 12 цифр."
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/dashboard/admin/releases")}
                className="rounded-lg font-mono text-xs uppercase tracking-widest text-gray-400 hover:text-white"
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                form="release-add-form"
                variant="cta"
                className="rounded-lg"
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden>add</span>
                {isSubmitting ? "Создание..." : "Создать релиз"}
              </Button>
            </>
          }
        />

        {error && <Banner variant="danger">{error}</Banner>}

        {success && <Banner variant="success">Релиз успешно создан. Перенаправление...</Banner>}

        {/* C-18: одна колонка читаемой ширины — поля во всю ширину экрана
            читаются хуже, чем прежняя сетка. */}
        <form id="release-add-form" onSubmit={handleSubmit} className="max-w-3xl space-y-8">
          {/* C-18/F-10: одна колонка — вторая половина сетки пустовала. */}
          <div className="grid grid-cols-1 gap-6">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <SectionHeader
                className="mb-6"
                title={
                  <>
                    <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>album</span>
                    Информация о релизе
                  </>
                }
              />
              <div className="space-y-4">
                <FormField label="Артист" htmlFor="artist" required>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger id="artist" className={`w-full ${inputCls} h-10`}>
                      <SelectValue placeholder="Выберите артиста" />
                    </SelectTrigger>
                    <SelectContent>
                      {artists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name} (@{artist.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Название релиза" htmlFor="title" required>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputCls}
                    placeholder="Введите название релиза"
                  />
                </FormField>

                <FormField
                  label="UPC"
                  htmlFor="upc"
                  required
                  hint="12-значный универсальный код продукта"
                >
                  <div className="relative">
                    <Input
                      id="upc"
                      value={upc}
                      onChange={(e) => setUpc(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      className={`${inputCls} pl-10`}
                      placeholder="123456789012"
                      maxLength={12}
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
                      barcode_scanner
                    </span>
                  </div>
                </FormField>

                {/* F-12: нативный date-инпут выпадал из тёмной темы */}
                <FormField label="Дата релиза" htmlFor="releaseDate" required>
                  <DatePicker
                    id="releaseDate"
                    value={parseIsoDate(releaseDate)}
                    onChange={(date) => setReleaseDate(toIsoDate(date))}
                    placeholder="дд.мм.гггг"
                    className={`${inputCls} w-full justify-start normal-case text-sm text-white`}
                  />
                </FormField>

                <FormField label="Статус" htmlFor="status" required>
                  <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                    <SelectTrigger id="status" className={`w-full ${inputCls} h-10`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusSelectItems.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-azure/50 to-transparent" />
              <SectionHeader
                className="mb-6"
                accent="azure"
                title={
                  <>
                    <span className="material-symbols-outlined text-accent-azure text-2xl" aria-hidden>upload</span>
                    Обложка релиза
                  </>
                }
              />
              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/15 rounded-xl bg-white/[0.02]">
                {coverPreview ? (
                  <div className="relative w-48 h-48 mb-4 rounded-lg overflow-hidden border border-white/10">
                    <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-48 h-48 mb-4 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-6xl text-gray-600">album</span>
                  </div>
                )}
                {/* F-12: нативный file-инпут → кнопка из кита */}
                <FileInput
                  id="cover-upload"
                  accept="image/*"
                  onChange={handleCoverChange}
                  buttonLabel="Загрузить обложку"
                  buttonVariant="outline"
                  icon="upload"
                  showFileName={false}
                />
                <p className="text-xs text-gray-500 font-mono text-center mt-3 uppercase tracking-wider">
                  Рекомендуемый размер: 3000×3000 px · JPG, PNG
                </p>
              </div>
            </div>
          </div>

          <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <SectionHeader
                className="mb-0"
                title={
                  <>
                    <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>queue_music</span>
                    Треки
                  </>
                }
              />
              <Button type="button" onClick={addTrack} variant="outline" size="sm" className="rounded-lg border-white/15 text-gray-200 hover:bg-white/5">
                <span className="material-symbols-outlined text-lg">add</span>
                Добавить трек
              </Button>
            </div>
            <div className="space-y-4">
              {tracks.map((track, index) => (
                <div key={index} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-mono uppercase tracking-widest text-gray-400">Трек {index + 1}</h4>
                    {tracks.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeTrack(index)}
                        variant="destructive-outline"
                        size="sm"
                        aria-label={`Удалить трек ${index + 1}`}
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden>delete</span>
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField label="Название" htmlFor={`track-title-${index}`} required>
                      <Input
                        id={`track-title-${index}`}
                        value={track.title}
                        onChange={(e) => updateTrack(index, "title", e.target.value)}
                        className={inputCls}
                        placeholder="Название трека"
                      />
                    </FormField>

                    <FormField label="ISRC" htmlFor={`track-isrc-${index}`}>
                      <Input
                        id={`track-isrc-${index}`}
                        value={track.isrc}
                        onChange={(e) => updateTrack(index, "isrc", e.target.value.toUpperCase())}
                        className={inputCls}
                        placeholder="USRC17607839"
                        maxLength={12}
                      />
                    </FormField>

                    <FormField label="Длительность" htmlFor={`track-duration-${index}`} required>
                      <Input
                        id={`track-duration-${index}`}
                        value={track.duration}
                        onChange={(e) => updateTrack(index, "duration", e.target.value)}
                        className={inputCls}
                        placeholder="3:45"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </form>

      </div>
    )
}
