"use client"

import React, { useEffect, useState } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
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
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-8 max-w-7xl mx-auto pb-8">
        <div className="space-y-4">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest flex-wrap gap-x-2 gap-y-1">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/releases" className="hover:text-primary">
              Релизы
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Новый релиз</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <Link
              href="/dashboard/admin/releases"
              className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest mb-3"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              К списку
            </Link>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white uppercase tracking-tight">
              Добавить релиз
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md mt-2">
              Заполните карточку релиза, обложку и треклист. UPC — 12 цифр.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="card-glass rounded-2xl border border-destructive/30 p-4 flex items-start gap-3"
          >
            <span className="material-symbols-outlined text-destructive shrink-0">error</span>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="card-glass rounded-2xl border border-primary/30 p-4 flex items-start gap-3"
          >
            <span className="material-symbols-outlined text-primary shrink-0">check_circle</span>
            <p className="text-sm text-gray-300">Релиз успешно создан. Перенаправление...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
                <span className="material-symbols-outlined text-primary text-2xl">album</span>
                Информация о релизе
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artist" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Артист <span className="text-destructive">*</span>
                  </Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger className={`w-full ${inputCls} h-10`}>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Название релиза <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputCls}
                    placeholder="Введите название релиза"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upc" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    UPC <span className="text-destructive">*</span>
                  </Label>
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
                  <p className="text-xs text-gray-500 font-mono">12-значный универсальный код продукта</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="releaseDate" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Дата релиза <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="releaseDate"
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
                      calendar_month
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Статус <span className="text-destructive">*</span>
                  </Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                    <SelectTrigger className={`w-full ${inputCls} h-10`}>
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
                </div>
              </div>
            </div>

            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-azure/50 to-transparent" />
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
                <span className="w-1.5 h-6 rounded-full bg-accent-azure shrink-0" />
                <span className="material-symbols-outlined text-accent-azure text-2xl">upload</span>
                Обложка релиза
              </h2>
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
                <label
                  htmlFor="cover-upload"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer bg-primary text-black font-semibold hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:scale-[1.02] transition-all"
                >
                  <span className="material-symbols-outlined text-lg">upload</span>
                  Загрузить обложку
                </label>
                <input id="cover-upload" type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                <p className="text-xs text-gray-500 font-mono text-center mt-3 uppercase tracking-wider">
                  Рекомендуемый размер: 3000×3000 px · JPG, PNG
                </p>
              </div>
            </div>
          </div>

          <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
                <span className="material-symbols-outlined text-primary text-2xl">queue_music</span>
                Треки
              </h2>
              <Button
                type="button"
                onClick={addTrack}
                className="rounded-lg bg-primary text-black hover:bg-emerald-400 font-semibold inline-flex items-center gap-2"
                size="sm"
              >
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
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                        Название <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={track.title}
                        onChange={(e) => updateTrack(index, "title", e.target.value)}
                        className={inputCls}
                        placeholder="Название трека"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 font-mono uppercase tracking-widest">ISRC</Label>
                      <Input
                        value={track.isrc}
                        onChange={(e) => updateTrack(index, "isrc", e.target.value.toUpperCase())}
                        className={inputCls}
                        placeholder="USRC17607839"
                        maxLength={12}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                        Длительность <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={track.duration}
                        onChange={(e) => updateTrack(index, "duration", e.target.value)}
                        className={inputCls}
                        placeholder="3:45"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/admin/releases")}
              className="border border-white/10 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 hover:text-primary"
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="rounded-lg bg-primary text-black hover:bg-emerald-400 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Создание..." : "Создать релиз"}
            </Button>
          </div>
        </form>

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
    </Layout>
  )
}
