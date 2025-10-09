"use client"

import React, { useEffect, useState } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Plus, Trash2, Upload, Music, Calendar, Barcode, User, Check, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { users as staticUsers } from "@/lib/data"
import Image from "next/image"

interface Track {
  title: string
  isrc: string
  duration: string
}

export default function AddReleasePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [artists, setArtists] = useState<Array<{ id: string; name: string; username: string; role: string }>>([])

  // Form fields
  const [artistId, setArtistId] = useState("")
  const [title, setTitle] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [upc, setUpc] = useState("")
  const [releaseDate, setReleaseDate] = useState("")
  const [status, setStatus] = useState<"released" | "moderation" | "delivery" | "scheduled">("moderation")
  const [tracks, setTracks] = useState<Track[]>([
    { title: "", isrc: "", duration: "" }
  ])

  // Загружаем список артистов из API (единый источник)
  useEffect(() => {
    const loadArtists = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (res.ok && data?.success && Array.isArray(data.users)) {
          setArtists(data.users.filter((u: any) => u.role === 'artist'))
        } else {
          setArtists([])
        }
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
    const updatedTracks = tracks.map((track, i) => 
      i === index ? { ...track, [field]: value } : track
    )
    setTracks(updatedTracks)
  }

  const validateForm = () => {
    if (!artistId || !title || !upc || !releaseDate || tracks.length === 0) {
      setError("Пожалуйста, заполните все обязательные поля")
      return false
    }

    // Validate UPC (should be 12 digits)
    if (!/^\d{12}$/.test(upc)) {
      setError("UPC должен содержать ровно 12 цифр")
      return false
    }

    // Validate tracks
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      if (!track.title || !track.duration) {
        setError(`Трек ${i + 1}: заполните название и длительность`)
        return false
      }

      // Validate duration format (MM:SS)
      if (!/^\d{1,2}:\d{2}$/.test(track.duration)) {
        setError(`Трек ${i + 1}: длительность должна быть в формате MM:SS (например, 3:45)`)
        return false
      }

      // Validate ISRC format if provided
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
      const selectedArtist = artists.find(artist => artist.id === artistId)
      const releaseData = {
        artistId,
        artistName: selectedArtist?.name || "Неизвестный артист",
        title,
        coverUrl: coverPreview || "/placeholder.svg",
        upc,
        releaseDate,
        status,
        tracks: tracks.filter(track => track.title && track.duration) // Only include valid tracks
      }

      const response = await fetch("/api/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(releaseData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Произошла ошибка при создании релиза")
      }

      // Релиз уже сохранен в базе данных через API, localStorage не используем

      setSuccess(true)
      
      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/admin/releases")
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при создании релиза")
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusLabels = {
    released: "Вышел",
    moderation: "Модерация",
    delivery: "Отгрузка",
    scheduled: "Запланирован"
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard/admin/releases"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад к списку релизов</span>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white">Добавить релиз</h1>

        {error && (
          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald/20 border-emerald/50 text-white">
            <Check className="h-4 w-4 text-green-400" />
            <AlertDescription>Релиз успешно создан! Перенаправление...</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Release Info */}
            <Card className="bg-card border-border text-card-foreground">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-green-400" />
                  Информация о релизе
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artist" className="text-white">
                    Артист <span className="text-red-500">*</span>
                  </Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors">
                      <SelectValue placeholder="Выберите артиста" />
                    </SelectTrigger>
                    <SelectContent>
                      {artists.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {artist.name} (@{artist.username})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white">
                    Название релиза <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-accent/50 border-gray-700 text-white"
                    placeholder="Введите название релиза"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upc" className="text-white">
                    UPC <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="upc"
                      value={upc}
                      onChange={(e) => setUpc(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="bg-accent/50 border-gray-700 text-white pl-10"
                      placeholder="123456789012"
                      maxLength={12}
                    />
                    <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400">12-значный универсальный код продукта</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="releaseDate" className="text-white">
                    Дата релиза <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="releaseDate"
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="bg-accent/50 border-gray-700 text-white pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-white">
                    Статус <span className="text-red-500">*</span>
                  </Label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger className="bg-accent/50 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Cover */}
            <Card className="bg-card border-border text-card-foreground">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-green-400" />
                  Обложка релиза
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-700 rounded-xl bg-accent/20">
                  {coverPreview ? (
                    <div className="relative w-48 h-48 mb-4">
                      <Image
                        src={coverPreview}
                        alt="Cover preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 mb-4 rounded-lg bg-accent/30 flex items-center justify-center">
                      <Music className="h-24 w-24 text-gray-400" />
                    </div>
                  )}
                  <label
                    htmlFor="cover-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Загрузить обложку</span>
                  </label>
                  <input
                    id="cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Рекомендуемый размер: 3000x3000 пикселей<br />
                    Форматы: JPG, PNG
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tracks Section */}
          <Card className="bg-card border-border text-card-foreground">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-green-400" />
                  Треки
                </CardTitle>
                <Button
                  type="button"
                  onClick={addTrack}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить трек
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tracks.map((track, index) => (
                <div key={index} className="p-4 bg-accent/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-white">Трек {index + 1}</h4>
                    {tracks.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeTrack(index)}
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-white text-sm">
                        Название <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={track.title}
                        onChange={(e) => updateTrack(index, "title", e.target.value)}
                        className="bg-accent/50 border-gray-700 text-white"
                        placeholder="Название трека"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white text-sm">ISRC</Label>
                      <Input
                        value={track.isrc}
                        onChange={(e) => updateTrack(index, "isrc", e.target.value.toUpperCase())}
                        className="bg-accent/50 border-gray-700 text-white"
                        placeholder="USRC17607839"
                        maxLength={12}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white text-sm">
                        Длительность <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={track.duration}
                        onChange={(e) => updateTrack(index, "duration", e.target.value)}
                        className="bg-accent/50 border-gray-700 text-white"
                        placeholder="3:45"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/admin/releases")}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Создание..." : "Создать релиз"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
