"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

/**
 * Списки треков в карточках аналитики — C-11 (F-38/F-39).
 *
 * Обе аналитики (админ 1.2 и артист 3.5) рисовали вложенные скролл-списки на
 * 179 и 16 позиций: курсор над карточкой перехватывал колесо, и страница
 * переставала прокручиваться. Вместо скролла — топ-10 и раскрытие по кнопке;
 * клик по строке выставляет трек в фильтр экрана, то есть показывает
 * статистику одного трека (решение 0-д п.5).
 *
 * Компоненты жили копией в админ-аналитике; вынесены сюда, когда тот же
 * вердикт дошёл до артист-аналитики.
 */

/** Сколько треков видно до раскрытия — вердикт 1.2/3.5 «top-10 + все треки». */
export const TOP_TRACKS = 10

/** Видимая часть списка: топ-10 или всё, если список уже раскрыт. */
export function visibleTracks<T>(items: T[], expanded: boolean): T[] {
  return expanded ? items : items.slice(0, TOP_TRACKS)
}

/**
 * Строка трека. У строки без ISRC фильтровать нечего — она остаётся
 * неинтерактивной, а не притворяется кнопкой.
 */
export function TrackRowButton({
  isrc,
  label,
  onSelect,
  children,
}: {
  isrc?: string | null
  label: string
  onSelect: (isrc: string) => void
  children: React.ReactNode
}) {
  if (!isrc) {
    return <div className="group border-b border-white/[0.03] last:border-0">{children}</div>
  }
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(isrc)}
      title={`Показать статистику: ${label}`}
      className="group h-auto w-full justify-start rounded-none border-b border-white/[0.03] px-0 py-0 text-left last:border-0 hover:bg-white/[0.03] max-md:h-auto"
    >
      {children}
    </Button>
  )
}

/** «Все треки (N)» — раскрытие полного списка вместо вложенного скролла. */
export function AllTracksToggle({
  total,
  expanded,
  onToggle,
}: {
  total: number
  expanded: boolean
  onToggle: () => void
}) {
  if (total <= TOP_TRACKS) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="mt-2 self-start rounded-lg px-2 font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-white"
    >
      <span className="material-symbols-outlined text-base" aria-hidden>
        {expanded ? "expand_less" : "expand_more"}
      </span>
      {expanded ? `Топ-${TOP_TRACKS}` : `Все треки (${total})`}
    </Button>
  )
}
