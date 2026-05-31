"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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

export function MissingContractBanner() {
  const [state, setState] = useState<LoadState>({ status: "loading" })

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
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-300 mt-0.5">warning</span>
          <p className="text-sm text-amber-100 font-medium">
            Не удалось проверить данные артистов для отчётов
          </p>
        </div>
      </div>
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
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 md:px-6 md:py-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-300 mt-0.5">warning</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-100 font-medium">
            У {incomplete.length} артистов не хватает данных для отчётов в Supabase
          </p>
          <p className="text-xs text-amber-200/70 mt-1 font-light">
            Обязательно: ФИО, номер договора и процент. Без них отчёт не создаётся.
          </p>
          <p className="text-xs text-amber-200/90 mt-2 font-mono uppercase tracking-widest">
            {fieldSummary}
          </p>
          <ul className="mt-3 max-h-40 overflow-y-auto text-xs text-amber-100/90 space-y-1 font-mono">
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
        </div>
      </div>
      <Link
        href="/dashboard/admin/artists"
        className="self-start sm:self-end text-xs font-mono uppercase tracking-widest text-amber-200 hover:text-white border border-amber-500/30 rounded-lg px-3 py-2 whitespace-nowrap transition-colors"
      >
        К списку артистов
      </Link>
    </div>
  )
}
