"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ARTIST_REPORT_FIELD_LABELS,
  ARTIST_REPORT_REQUIRED_FIELDS,
  type ArtistReportRequiredField,
  type IncompleteReportArtist,
} from "@/lib/artist-report-requirements"

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; incomplete: IncompleteReportArtist[] }

/**
 * Предупреждение о неполных данных артистов — 1.3/0-а (docs/ia-decisions.md).
 *
 * Баннер занимал весь первый экран /reports и нёс собственный скролл на 67
 * строк (F-44), а текст ссылался на Supabase — имя хранилища, которое админу
 * ничего не говорит (F-45). Теперь это свёрнутая строка со счётчиком, детали —
 * по развороту, и стоит она ПОСЛЕ шапки и фильтров.
 */
export function MissingContractBanner() {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/artists?incompleteReportData=1", {
          credentials: "include",
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { artists?: IncompleteReportArtist[] }
        if (cancelled) return
        setState({
          status: "ready",
          incomplete: data.artists ?? [],
        })
      } catch {
        if (!cancelled) setState({ status: "error" })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === "loading") return null

  if (state.status === "error") {
    return (
      <Banner variant="warning" className="rounded-2xl md:px-6 md:py-4">
        <p className="text-sm text-amber-100 font-medium">
          Не удалось проверить данные артистов для отчётов
        </p>
      </Banner>
    )
  }

  const incomplete = state.incomplete
  if (incomplete.length === 0) return null

  const missingByField = Object.fromEntries(
    ARTIST_REPORT_REQUIRED_FIELDS.map((f) => [f, 0])
  ) as Record<ArtistReportRequiredField, number>

  for (const row of incomplete) {
    for (const field of row.missingFields) {
      missingByField[field] += 1
    }
  }

  const fieldSummary = ARTIST_REPORT_REQUIRED_FIELDS.filter((f) => missingByField[f] > 0)
    .map((f) => `${ARTIST_REPORT_FIELD_LABELS[f]}: ${missingByField[f]}`)
    .join(" · ")

  return (
    <Banner variant="warning" className="rounded-2xl md:px-6 md:py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* F-45: без «Supabase» — админу важно, что данных нет, а не где они лежат */}
        <p className="text-sm text-amber-100 font-medium">
          У {incomplete.length} артистов не хватает данных для отчётов
        </p>
        <Button
          type="button"
          variant="warning-outline"
          aria-expanded={open}
          aria-controls="missing-contract-details"
          onClick={() => setOpen((prev) => !prev)}
          className="h-auto rounded-lg px-3 py-1.5 text-xs font-mono uppercase tracking-widest"
        >
          {open ? "Свернуть" : "Подробнее"}
        </Button>
      </div>

      {open && (
        <div id="missing-contract-details">
          <p className="text-xs text-amber-200/70 mt-1 font-light">
            Обязательно: ФИО, номер договора и процент. Без них отчёт не создаётся.
          </p>
          <p className="text-xs text-amber-200/90 mt-2 font-mono uppercase tracking-widest">
            {fieldSummary}
          </p>
          {/* F-44: список артистов скроллится с видимым скроллбаром и фейдом —
              раньше это был скролл-в-скролле без единого аффорданса. */}
          <ScrollArea
            className="mt-3"
            viewportClassName="max-h-40"
            fadeClassName="from-status-warning/10"
          >
            <ul className="text-xs text-amber-100/90 space-y-1 font-mono">
              {incomplete.slice(0, 15).map((a) => (
                <li key={a.id}>
                  {a.name} — нет:{" "}
                  {a.missingFields.map((f) => ARTIST_REPORT_FIELD_LABELS[f]).join(", ")}
                </li>
              ))}
              {incomplete.length > 15 && (
                <li className="text-amber-200/60">…и ещё {incomplete.length - 15}</li>
              )}
            </ul>
          </ScrollArea>
          <Button
            asChild
            variant="warning-outline"
            className="mt-3 h-auto self-start rounded-lg px-3 py-2 text-xs font-mono uppercase tracking-widest sm:self-end"
          >
            <Link href="/dashboard/admin/artists">К списку артистов</Link>
          </Button>
        </div>
      )}
    </Banner>
  )
}
