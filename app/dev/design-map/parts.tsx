/**
 * Общие куски витрины «Карта фактического дизайна».
 * Только отображение: все числа приходят из design-map.json.
 */
import * as React from "react"

import type { ClassEntry, Counted, Guard, GuardRef, Sample, Zone } from "./types"

export const ZONE_SHORT: Record<Zone, string> = {
  page: "экраны",
  "cabinet-component": "компоненты ЛК",
  "landing-component": "вне ЛК",
  kit: "кит",
}

// ---------------------------------------------------------------------------
// Каркас
// ---------------------------------------------------------------------------

export function Section({
  n,
  id,
  title,
  lead,
  guard,
  guards,
  children,
}: {
  n: number
  id: string
  title: string
  lead?: React.ReactNode
  guard?: GuardRef
  guards: Guard[]
  children: React.ReactNode
}) {
  // Не <section>: глобальный CSS лендинга (globals.css) вешает на голый section
  // флекс с центровкой по вертикали и scroll-snap, а на `section > div` — свои
  // поля и `margin: 0 auto`. Витрина от этого складывается друг на друга.
  return (
    <div id={id} className="scroll-mt-4 space-y-5 border-t border-white/10 pt-10 first:border-t-0 first:pt-0">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs tracking-widest text-gray-600">{String(n).padStart(2, "0")}</span>
          <h2 className="text-xl font-bold uppercase tracking-tight text-white md:text-2xl">{title}</h2>
        </div>
        {lead && <p className="max-w-3xl text-sm leading-relaxed text-gray-400">{lead}</p>}
        {guard && <GuardBadge guard={guard} guards={guards} />}
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  )
}

export function Block({
  title,
  note,
  right,
  children,
}: {
  title: string
  note?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-300">{title}</h3>
        {right}
      </div>
      {note && <p className="max-w-3xl text-xs leading-relaxed text-gray-500">{note}</p>}
      {children}
    </div>
  )
}

/** Сетка образцов. `min` — минимальная ширина карточки в пикселях. */
export function Grid({ min = 240, children }: { min?: number; children: React.ReactNode }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))` }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Статус канона
// ---------------------------------------------------------------------------

const GUARD_TONE: Record<GuardRef["status"], { label: string; box: string }> = {
  canon: { label: "Канон, охраняется", box: "border-status-success/40 bg-status-success/10 text-emerald-300" },
  partial: { label: "Канон частичный", box: "border-status-warning/40 bg-status-warning/10 text-amber-200" },
  none: { label: "Канона нет", box: "border-white/15 bg-white/[0.04] text-gray-300" },
}

export function GuardBadge({ guard, guards }: { guard: GuardRef; guards: Guard[] }) {
  const tone = GUARD_TONE[guard.status]
  const named = guard.guards.map((id) => guards.find((g) => g.id === id)).filter(Boolean) as Guard[]
  return (
    <div className={`max-w-3xl rounded-xl border p-3 text-xs leading-relaxed ${tone.box}`}>
      <div className="mb-1 font-semibold uppercase tracking-widest">{tone.label}</div>
      <p className="text-gray-300">{guard.note}</p>
      {named.length > 0 && (
        <ul className="mt-2 space-y-1">
          {named.map((g) => (
            <li key={g.id} className="text-gray-400">
              <span className="font-mono text-[11px] text-gray-200">{g.command}</span>{" "}
              <span className="text-gray-500">— {g.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Компактная версия для строк таблиц и отдельных значений. */
export function GuardTag({ status, children }: { status: GuardRef["status"]; children?: React.ReactNode }) {
  const tone = GUARD_TONE[status]
  return (
    <span className={`inline-flex w-fit self-start items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone.box}`}>
      {children ?? tone.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Числа и подписи
// ---------------------------------------------------------------------------

export function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-gray-500">{label}</div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-gray-500">{hint}</div>}
    </div>
  )
}

export function Mono({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "muted" }) {
  return (
    // `min-w-0 break-all`: строки классов бывают длиннее экрана 390, и без
    // переноса они выталкивают из карточки соседний счётчик.
    <code
      className={`inline-block min-w-0 max-w-full break-all font-mono text-[11px] ${
        tone === "muted" ? "text-gray-500" : "text-emerald-200"
      }`}
    >
      {children}
    </code>
  )
}

export function CountBadge({ n, of }: { n: number; of?: string }) {
  return (
    <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
      {n}
      {of ? ` ${of}` : "×"}
    </span>
  )
}

export function ZoneLine({ byZone }: { byZone: Partial<Record<Zone, number>> }) {
  const parts = (Object.keys(byZone) as Zone[]).filter((z) => byZone[z])
  if (parts.length === 0) return null
  return (
    <div className="text-[10px] text-gray-500">
      {parts.map((z, i) => (
        <span key={z}>
          {i > 0 && " · "}
          {ZONE_SHORT[z]} {byZone[z]}
        </span>
      ))}
    </div>
  )
}

export function KindLine({ kinds }: { kinds: Counted[] }) {
  if (kinds.length === 0) return null
  return (
    <div className="text-[10px] leading-snug text-gray-500">
      {kinds
        .slice(0, 5)
        .map((k) => `${k.name} ${k.count}`)
        .join(" · ")}
      {kinds.length > 5 && ` · ещё ${kinds.length - 5}`}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Файлы и строки
// ---------------------------------------------------------------------------

export function FileList({
  items,
  more = 0,
  label = "файлы и строки",
}: {
  items: { file: string; line: number; extra?: string }[]
  more?: number
  label?: string
}) {
  if (items.length === 0) return null
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-gray-600 transition-colors hover:text-gray-300">
        <span className="group-open:hidden">▸ {label} ({items.length}{more > 0 ? `+${more}` : ""})</span>
        <span className="hidden group-open:inline">▾ {label}</span>
      </summary>
      <ul className="mt-1.5 space-y-0.5 border-l border-white/10 pl-2">
        {items.map((s, i) => (
          <li key={`${s.file}:${s.line}:${i}`} className="break-all font-mono text-[10px] leading-snug text-gray-500">
            {s.file}:{s.line}
            {s.extra && <span className="text-gray-600"> — {s.extra}</span>}
          </li>
        ))}
        {more > 0 && <li className="font-mono text-[10px] text-gray-600">…и ещё {more}</li>}
      </ul>
    </details>
  )
}

export function samplesToFiles(samples: Sample[]): { file: string; line: number; extra?: string }[] {
  return samples.map((s) => ({ file: s.file, line: s.line, extra: `<${s.tag}> — ${s.kind}` }))
}

// ---------------------------------------------------------------------------
// Карточка значения: образец + имя + частота + файлы
// ---------------------------------------------------------------------------

export function ValueCard({
  entry,
  preview,
  footer,
}: {
  entry: ClassEntry
  preview: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      {/*
        `transform-gpu` здесь не украшение: часть настоящих классов кабинета —
        `position: fixed` и `absolute` (шумовая накладка, оверлей загрузки).
        Трансформация делает эту рамку системой координат для потомков, и
        образец остаётся внутри своей карточки, а не растекается по странице.
      */}
      <div className="relative flex min-h-[64px] transform-gpu items-center justify-center overflow-hidden rounded-lg bg-black/30 p-3">
        {preview}
      </div>
      <div className="flex items-start justify-between gap-2">
        <Mono>{entry.name}</Mono>
        <CountBadge n={entry.count} />
      </div>
      <KindLine kinds={entry.kinds} />
      <ZoneLine byZone={entry.byZone} />
      {footer}
      <FileList items={samplesToFiles(entry.samples)} more={entry.more} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Таблица
// ---------------------------------------------------------------------------

export function DataGrid({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-widest text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-white/5 align-top last:border-b-0">{children}</tr>
}

export function Cell({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-gray-300 ${className}`}>{children}</td>
}
