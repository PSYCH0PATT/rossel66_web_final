"use client"

import { useState } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { fetchAllUsersFromApi } from "@/lib/fetch-all-users"

export default function BulkAddArtistsPage() {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [addedArtists, setAddedArtists] = useState<Array<{ name: string; password: string }>>([])
  const [isEditing, setIsEditing] = useState(false)
  const [artistNames, setArtistNames] = useState([
    "передоз",
    "ЭНТЕNДАНS",
    "ASTRODYA",
    "EnellySayk",
    "Etxrnxtx",
    "Jelato",
    "LXNOWER",
    "Makishima",
    "Matcukito Kioto",
    "MEELBRN",
    "MENDXZA",
    "night moral",
    "Nnaia",
    "PLVT",
    "Roudie J.",
    "SLAVKESH",
    "Sour Diesel",
    "Takeda",
    "TXYK",
    "W.1ce3",
    "WIDE PIE",
    "wvlaik",
  ])
  const [editText, setEditText] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newArtistName, setNewArtistName] = useState("")

  const generateRandomDigits = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  const startEditing = () => {
    setEditText(artistNames.join("\n"))
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditText("")
  }

  const saveEditing = () => {
    const newNames = editText
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    setArtistNames(newNames)
    setIsEditing(false)
    setEditText("")
  }

  const removeArtist = (index: number) => {
    setArtistNames(artistNames.filter((_, i) => i !== index))
  }

  const confirmAddArtist = () => {
    const trimmed = newArtistName.trim()
    if (!trimmed) return
    setArtistNames([...artistNames, trimmed])
    setNewArtistName("")
    setAddDialogOpen(false)
  }

  const addAllArtists = async () => {
    setIsAdding(true)
    setError("")
    setAddedArtists([])

    try {
      const existingUsers = await fetchAllUsersFromApi()

      const addedArtistsInfo: Array<{ name: string; password: string }> = []
      let successCount = 0
      let errorCount = 0

      for (const name of artistNames) {
        try {
          const randomDigits = generateRandomDigits()
          const password = `${name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}${randomDigits}`

          const username = name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")

          const existingUser = existingUsers.some(
            (user: { username: string }) => user.username.toLowerCase() === username.toLowerCase(),
          )

          if (!existingUser) {
            const response = await fetch("/api/artists", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                username,
                password,
                name,
                email: undefined,
                avatarUrl: undefined,
                vkMusicUrl: undefined,
                yandexMusicUrl: undefined,
                spotifyUrl: undefined,
              }),
            })

            const result = await response.json()

            if (result.success) {
              addedArtistsInfo.push({ name, password })
              successCount++
            } else {
              errorCount++
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch {
          errorCount++
        }
      }

      setAddedArtists(addedArtistsInfo)

      if (successCount > 0) {
        setSuccess(true)
        if (errorCount > 0) {
          setError(`Создано ${successCount} артистов, ${errorCount} ошибок`)
        }
      } else if (errorCount > 0) {
        setError(`Не удалось создать ни одного артиста. Ошибок: ${errorCount}`)
      } else {
        setError("Все артисты уже существуют в системе")
      }
    } catch {
      setError("Произошла ошибка при добавлении артистов")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary cursor-pointer transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/artists" className="hover:text-primary cursor-pointer transition-colors">
              Артисты
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Массовое добавление</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-8">
            <div className="min-w-0">
              <Link
                href="/dashboard/admin/artists"
                className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest mb-3"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                К списку
              </Link>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">
                Массовое добавление
              </h1>
              <p className="text-sm text-gray-400 font-light mt-2">Создание нескольких артистов по списку имён</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">groups</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2" role="alert">
            <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-start gap-2" role="status">
            <span className="material-symbols-outlined text-emerald-400 flex-shrink-0">check_circle</span>
            Артисты успешно добавлены!
          </div>
        )}

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            Список артистов
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-gray-400">
                Будут добавлены следующие артисты (всего{" "}
                <span className="font-mono text-primary [font-variant-numeric:tabular-nums]">{artistNames.length}</span>
                ):
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setAddDialogOpen(true)}
                      className="rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <span className="material-symbols-outlined text-base mr-1">add</span>
                      Добавить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={startEditing}
                      className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                    >
                      <span className="material-symbols-outlined text-base mr-1">edit</span>
                      Редактировать
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Введите имена артистов, каждое с новой строки..."
                  className="min-h-60 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-500 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  rows={15}
                  spellCheck={false}
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-base mr-1">close</span>
                    Отмена
                  </Button>
                  <Button size="sm" type="button" onClick={saveEditing} className="rounded-lg bg-primary text-black hover:bg-primary/90">
                    <span className="material-symbols-outlined text-base mr-1">check</span>
                    Сохранить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <ul className="space-y-1">
                  {artistNames.map((name, index) => (
                    <li key={`${name}-${index}`} className="flex items-center justify-between text-sm group min-w-0">
                      <span className="truncate pr-2">{name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeArtist(index)}
                        aria-label={`Удалить ${name} из списка`}
                        className="opacity-0 group-hover:opacity-100 motion-safe:transition-opacity h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20 focus-visible:opacity-100"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-sm font-medium text-white mb-2">Примечания</h3>
              <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                <li>Пароль: никнейм + 4 случайных цифры</li>
                <li>Логин: никнейм без пробелов и спецсимволов</li>
                <li>Профили создаются без релизов и прочих данных</li>
              </ul>
            </div>

            {addedArtists.length > 0 && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 overflow-hidden">
                <h3 className="text-sm font-medium mb-3 text-primary">Созданные учётные данные</h3>
                <div className="max-h-60 overflow-auto rounded-lg border border-white/10 table-glass">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-white/10 text-xs font-mono uppercase text-gray-500">
                        <th className="p-3">Артист</th>
                        <th className="p-3">Пароль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addedArtists.map((artist, index) => (
                        <tr key={index} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="p-3 text-white">{artist.name}</td>
                          <td className="p-3 font-mono text-gray-300 [font-variant-numeric:tabular-nums]">{artist.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/artists")}
                className="rounded-lg border-white/20 text-gray-300 hover:bg-white/5 hover:text-white"
                disabled={isAdding}
              >
                Назад к списку
              </Button>
              <Button
                type="button"
                onClick={addAllArtists}
                className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold inline-flex items-center justify-center gap-2"
                disabled={isAdding}
              >
                {isAdding ? (
                  <>
                    <span className="inline-block size-4 border-2 border-black/30 border-t-black rounded-full motion-safe:animate-spin" aria-hidden />
                    Добавление...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">upload</span>
                    Добавить всех артистов
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-tight">Добавить артиста</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="bulk-new-name" className="text-xs font-mono uppercase text-gray-400">
              Имя артиста
            </Label>
            <Input
              id="bulk-new-name"
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              placeholder="Введите имя..."
              className="h-11 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  confirmAddArtist()
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" className="bg-primary text-black hover:bg-primary/90" onClick={confirmAddArtist}>
              Добавить в список
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
