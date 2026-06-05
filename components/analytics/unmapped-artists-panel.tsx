"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { revalidateStreamAnalytics } from "@/lib/hooks/use-dashboard-fetch"

type UnmappedArtist = {
  trackArtist: string
  totalStreams: number
  rowCount: number
  isCollaboration: boolean
}

type RosterArtist = {
  id: string
  name: string
  username: string
}

interface UnmappedArtistsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked?: () => void
}

export function UnmappedArtistsPanel({ open, onOpenChange, onLinked }: UnmappedArtistsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)
  const [unmapped, setUnmapped] = useState<UnmappedArtist[]>([])
  const [roster, setRoster] = useState<RosterArtist[]>([])
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [unmappedRes, artistsRes] = await Promise.all([
        fetch("/api/analytics/unmapped-artists?take=500"),
        fetch("/api/artists?take=500"),
      ])
      const unmappedJson = await unmappedRes.json()
      const artistsJson = await artistsRes.json()

      if (unmappedJson.success) {
        setUnmapped(unmappedJson.artists)
      } else {
        setError(unmappedJson.error || "Не удалось загрузить список")
      }

      if (artistsJson.artists) {
        setRoster(
          artistsJson.artists.map((a: { id: string; name: string; username: string }) => ({
            id: a.id,
            name: a.name,
            username: a.username,
          }))
        )
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  const handleLink = async (trackArtist: string) => {
    const artistId = selection[trackArtist]
    if (!artistId) return

    setLinking(trackArtist)
    setError(null)
    try {
      const res = await fetch("/api/analytics/link-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackArtist, artistId }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || "Ошибка привязки")
        return
      }
      revalidateStreamAnalytics()
      setUnmapped((prev) => prev.filter((u) => u.trackArtist !== trackArtist))
      onLinked?.()
    } catch (e) {
      setError(String(e))
    } finally {
      setLinking(null)
    }
  }

  const handleRematch = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/analytics/rematch", { method: "POST" })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || "Ошибка пересопоставления")
        return
      }
      revalidateStreamAnalytics()
      await loadData()
      onLinked?.()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border border-white/10 bg-[#141414] text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:rounded-2xl [&>button]:text-gray-400 [&>button]:hover:text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-tight text-white">
            Несопоставленные артисты
          </DialogTitle>
          <DialogDescription className="text-left text-xs font-mono uppercase tracking-widest text-gray-500">
            Имена из CSV без привязки к профилю. После привязки данные попадут в кабинет артиста.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
            {loading ? "Загрузка…" : `${unmapped.length} без профиля`}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-primary"
            onClick={() => void handleRematch()}
            disabled={loading}
          >
            Авто-пересопоставить
          </Button>
        </div>

        {error ? (
          <p className="text-xs text-red-400 font-mono">{error}</p>
        ) : null}

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {loading && unmapped.length === 0 ? (
            <p className="text-sm text-gray-500 font-mono uppercase tracking-widest py-8 text-center">
              Загрузка…
            </p>
          ) : unmapped.length === 0 ? (
            <p className="text-sm text-gray-500 font-mono uppercase tracking-widest py-8 text-center">
              Все исполнители из аналитики сопоставлены
            </p>
          ) : (
            unmapped.map((row) => (
              <div
                key={row.trackArtist}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">{row.trackArtist}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mt-0.5">
                      {row.totalStreams.toLocaleString("ru-RU")} стримов · {row.rowCount} строк
                    </p>
                    {row.isCollaboration ? (
                      <p className="text-[10px] text-amber-500/90 font-mono mt-1">
                        Коллаб — привязка целиком к одному профилю
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={selection[row.trackArtist] || ""}
                    onValueChange={(v) =>
                      setSelection((prev) => ({ ...prev, [row.trackArtist]: v }))
                    }
                  >
                    <SelectTrigger className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 text-xs text-gray-300">
                      <SelectValue placeholder="Выберите профиль" />
                    </SelectTrigger>
                    <SelectContent>
                      {roster.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.name} (@{a.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="h-9 shrink-0 bg-[#10b981] hover:bg-emerald-400 text-black font-bold text-[10px] uppercase tracking-widest"
                    disabled={!selection[row.trackArtist] || linking === row.trackArtist}
                    onClick={() => void handleLink(row.trackArtist)}
                  >
                    {linking === row.trackArtist ? "…" : "Привязать"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface UnmappedArtistsTriggerProps {
  count: number | null
  onOpen: () => void
}

export function UnmappedArtistsTrigger({ count, onOpen }: UnmappedArtistsTriggerProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="relative text-[10px] text-gray-500 hover:text-white hover:bg-[#141414] uppercase font-bold tracking-wider px-2 h-7 font-mono"
      onClick={onOpen}
    >
      <span className="material-symbols-outlined text-sm mr-1 align-middle">link</span>
      Сопоставить
      {count != null && count > 0 ? (
        <span className="ml-1.5 inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  )
}
