/**
 * Правило отображаемого статуса релиза (F-14).
 *
 * В списке релизов и на карточке стоял бейдж «ДОСТАВЛЕН» у записей с нулём
 * треков, пустым ISRC и длительностью «0:00»: экран утверждал доставку там,
 * где подтверждать её нечем — данные релиза не приехали. Статус «доставлен»
 * теперь требует хотя бы одного трека; незавершённые статусы (модерация,
 * доставка, отказ) пустой треклист не меняет — на этих стадиях его и ждут.
 *
 * Заодно здесь единственное место, где решается, что показывать вместо
 * неизвестной длительности: «—», а не выдуманный ноль.
 */

export type ReleaseStatusVariant =
  | "live"
  | "delivered"
  | "moderation"
  | "rejected"
  | "draft"
  | "warning"

/** Контекст целостности данных релиза. */
export interface ReleaseStatusContext {
  /** Сколько треков реально известно. */
  trackCount: number
}

type TrackLike = { title?: string | null; isrc?: string | null; duration?: string | number | null }

const EMPTY_DURATIONS = new Set(["", "0:00", "00:00", "0:00:00", "00:00:00", "0"])

/** Треки, о которых хоть что-то известно: пустые болванки не считаются. */
export function releaseTrackCount(tracks?: TrackLike[] | null): number {
  if (!Array.isArray(tracks)) return 0
  return tracks.filter((track) => {
    if (!track) return false
    const title = String(track.title ?? "").trim()
    const isrc = String(track.isrc ?? "").trim()
    const duration = String(track.duration ?? "").trim()
    return Boolean(title || isrc || (duration && !EMPTY_DURATIONS.has(duration)))
  }).length
}

/** Длительность трека для экрана: неизвестная — «—», не «0:00». */
export function trackDurationText(duration?: string | number | null): string {
  const text = String(duration ?? "").trim()
  if (!text || EMPTY_DURATIONS.has(text)) return "—"
  return text
}

function isDeliveredStatus(status?: string): boolean {
  return status === "Доставлен" || status === "released" || status === "Одобрен"
}

export function releaseStatusVariant(
  status?: string,
  context?: ReleaseStatusContext
): ReleaseStatusVariant {
  // F-14: доставки без треклиста не бывает — это дыра в данных, а не статус.
  if (context && context.trackCount <= 0 && isDeliveredStatus(status)) {
    return "warning"
  }
  switch (status) {
    case "Доставлен":
    case "released":
    case "Одобрен":
      return "live"
    case "В доставке":
    case "delivery":
      return "delivered"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "moderation"
    case "Отклонен":
    case "Отклонён":
    case "Снят":
      return "rejected"
    default:
      return "draft"
  }
}

export function releaseStatusLabel(
  status?: string,
  context?: ReleaseStatusContext
): string {
  switch (releaseStatusVariant(status, context)) {
    case "live":
      return "Доставлен"
    case "delivered":
      return "В доставке"
    case "moderation":
      return "Модерируется"
    case "rejected":
      return "Отклонен"
    case "warning":
      return "Нет данных"
    default:
      return status || "Драфт"
  }
}
