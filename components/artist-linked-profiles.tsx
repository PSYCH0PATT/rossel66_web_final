"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type PickerArtist = {
  id: string
  name: string
  username: string
  mainArtistId: string | null
}

/**
 * Связанные профили артиста (AKA).
 *
 * У одного человека бывает несколько карточек — парсеры заводят их по разным
 * именам. Привязка складывает их статистику и отчёты в кабинет главного:
 * квартальный отчёт становится один, а сам главный может переключаться между
 * профилями в своём кабинете.
 */
export function ArtistLinkedProfiles({
  artistId,
  artistName,
}: {
  artistId: string
  artistName: string
}) {
  const [artists, setArtists] = useState<PickerArtist[]>([])
  const [selected, setSelected] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/artists?forPicker=1")
      if (!res.ok) throw new Error("Не удалось загрузить список артистов")
      const data = await res.json()
      setArtists(Array.isArray(data.artists) ? data.artists : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const self = artists.find((a) => a.id === artistId)
  const linked = useMemo(
    () => artists.filter((a) => a.mainArtistId === artistId),
    [artists, artistId]
  )

  // Кандидат должен быть чужим, свободным и сам не быть главным — иначе получился
  // бы второй уровень вложенности.
  const mainIds = useMemo(
    () => new Set(artists.map((a) => a.mainArtistId).filter(Boolean) as string[]),
    [artists]
  )
  const candidates = useMemo(
    () =>
      artists.filter((a) => a.id !== artistId && !a.mainArtistId && !mainIds.has(a.id)),
    [artists, artistId, mainIds]
  )

  const isLinkedItself = Boolean(self?.mainArtistId)
  const mainProfile = isLinkedItself
    ? artists.find((a) => a.id === self?.mainArtistId)
    : undefined

  const handleLink = async () => {
    if (!selected) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/artists/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainArtistId: artistId, linkedArtistId: selected }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Не удалось привязать профиль")
      }
      setSelected("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка привязки")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnlink = async (profile: PickerArtist) => {
    if (!confirm(`Отвязать «${profile.name}» от «${artistName}»?`)) return
    setError(null)
    try {
      const res = await fetch(
        `/api/artists/link?linkedArtistId=${encodeURIComponent(profile.id)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Не удалось отвязать профиль")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отвязки")
    }
  }

  return (
    <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-wide text-white">
        <span className="h-6 w-1.5 rounded-full bg-sky-400" />
        Связанные профили
      </h2>

      {isLinkedItself ? (
        <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-sm text-gray-300">
          Этот профиль привязан к «{mainProfile?.name ?? "другому артисту"}». Вся статистика и
          отчёты собираются в кабинете главного профиля — отвязать можно в его карточке.
        </p>
      ) : (
        <>
          <p className="mb-6 max-w-2xl text-sm font-light text-gray-400">
            Если у артиста несколько карточек под разными именами, привяжите их сюда. Статистика
            привязанных профилей будет видна в кабинете этого артиста, а квартальный отчёт станет
            один — на его реквизиты. Между профилями он сможет переключаться сам.
          </p>

          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="link-candidate" className="text-white">
                Профиль для привязки
              </Label>
              <select
                id="link-candidate"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={isLoading}
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white focus:border-primary/40 focus:outline-none"
              >
                <option value="" className="bg-black">
                  {isLoading ? "Загрузка…" : "Выберите артиста"}
                </option>
                {candidates.map((a) => (
                  <option key={a.id} value={a.id} className="bg-black">
                    {a.name} ({a.username})
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              onClick={() => void handleLink()}
              disabled={!selected || isSaving}
              className="h-11 rounded-lg bg-primary font-semibold text-black hover:bg-primary/90"
            >
              {isSaving ? "Привязка…" : "Привязать"}
            </Button>
          </div>

          {linked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <span className="material-symbols-outlined mx-auto mb-3 block text-4xl text-gray-500">
                link
              </span>
              <p className="text-sm text-gray-400">Привязанных профилей нет</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
              {linked.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-sky-400">link</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{profile.name}</p>
                    <p className="truncate text-xs text-gray-400">{profile.username}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUnlink(profile)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  >
                    Отвязать
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
