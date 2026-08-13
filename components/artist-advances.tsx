"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateRu } from "@/lib/format-date"

type Advance = {
  id: string
  artistId: string
  amount: number
  issuedAt: string
  comment: string | null
  createdBy: string | null
  createdAt: string
}

const fmt = (n: number) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function todayIso() {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10)
}

/**
 * Авансы артиста: выдача, история, удаление.
 *
 * Погашение считается автоматически из квартальных отчётов, пришедших после даты
 * выдачи (lib/advance.ts) — вручную ничего отмечать не нужно. Пока аванс не
 * погашен, у артиста «Доступно к выплате» равно нулю.
 */
export function ArtistAdvances({ artistId }: { artistId: string }) {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState("")
  const [issuedAt, setIssuedAt] = useState(todayIso())
  const [comment, setComment] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/advances?artistId=${encodeURIComponent(artistId)}`)
      if (!res.ok) throw new Error("Не удалось загрузить авансы")
      const data = await res.json()
      setAdvances(Array.isArray(data.advances) ? data.advances : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
      setAdvances([])
    } finally {
      setIsLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    void load()
  }, [load])

  const total = advances.reduce((sum, a) => sum + a.amount, 0)

  const handleAdd = async () => {
    const parsed = Number(amount.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Укажите сумму больше нуля")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          amount: parsed,
          issuedAt,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Не удалось сохранить аванс")
      }
      setAmount("")
      setComment("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (advance: Advance) => {
    if (
      !confirm(
        `Удалить аванс ${fmt(advance.amount)} ₽ от ${formatDateRu(advance.issuedAt)}? Баланс артиста пересчитается.`
      )
    ) {
      return
    }
    try {
      const res = await fetch(`/api/advances?id=${encodeURIComponent(advance.id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Не удалось удалить аванс")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления")
    }
  }

  return (
    <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-wide text-white">
          <span className="h-6 w-1.5 rounded-full bg-orange-400" />
          Авансы
        </h2>
        {total > 0 && (
          <span className="font-mono text-sm text-gray-400 tabular-nums">
            Всего выдано: <span className="text-white">{fmt(total)} ₽</span>
          </span>
        )}
      </div>

      <p className="mb-6 max-w-2xl text-sm font-light text-gray-400">
        Аванс гасится автоматически из отчётов, пришедших после даты выдачи. Пока остаток не
        закрыт, у артиста «Доступно к выплате» равно нулю — отмечать погашение вручную не нужно.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[160px_180px_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="advance-amount" className="text-white">
            Сумма, ₽
          </Label>
          <Input
            id="advance-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50000"
            className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advance-date" className="text-white">
            Дата выдачи
          </Label>
          <Input
            id="advance-date"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advance-comment" className="text-white">
            Комментарий
          </Label>
          <Input
            id="advance-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Необязательно"
            className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          type="button"
          onClick={() => void handleAdd()}
          disabled={isSaving}
          className="h-11 rounded-lg bg-primary font-semibold text-black hover:bg-primary/90"
        >
          {isSaving ? "Сохранение…" : "Выдать аванс"}
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Загрузка…</p>
      ) : advances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <span className="material-symbols-outlined mx-auto mb-3 block text-4xl text-gray-500">
            payments
          </span>
          <p className="text-sm text-gray-400">Авансов не выдавалось</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
          {advances.map((advance) => (
            <div
              key={advance.id}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-white tabular-nums">
                  {fmt(advance.amount)} ₽
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <span className="material-symbols-outlined text-sm text-gray-500">
                      calendar_today
                    </span>
                    {formatDateRu(advance.issuedAt)}
                  </span>
                  {advance.createdBy && <span>завёл: {advance.createdBy}</span>}
                  {advance.comment && <span className="text-gray-300">{advance.comment}</span>}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDelete(advance)}
                className="self-end border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 sm:self-center"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
