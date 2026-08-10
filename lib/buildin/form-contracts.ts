/**
 * Frontend form contracts — single source of truth for Buildin queue schemas.
 * Only fields that exist on the live website forms (or intentional ops metadata)
 * may appear in Buildin. Pyrus is not authoritative for structure.
 */

/** Shared list columns for catalog / release upload / distribution queues */
export const FORM_QUEUE_COLUMNS = [
  "Артист",
  "Название релиза",
  "Дата заявки",
  "Обработана",
] as const

/** Columns that must never appear on the three file-form queues */
export const FORM_QUEUE_FORBIDDEN_COLUMNS = [
  "Название",
  "Артисты",
  "Статус",
  "Приоритет",
  "Дедлайн",
  "Ответственный",
  "Источник",
  "Технический ID",
  "Email",
  "Telegram",
  "Контакт",
  "UPC",
  "Дата релиза",
  "Жанр",
  "Тип релиза",
  "Промо",
  "Видео-сниппет",
  "Кол-во релизов",
  "Кол-во треков",
  "Кол-во файлов",
  "Session ID",
  "Release Index",
  "Track Index",
] as const

/** Promo / streaming / comments shared by release_upload + distribution */
export const PROMO_PAYLOAD_KEYS = [
  "videoSnippetNeeded",
  "submitToPromo",
  "artistInfo",
  "releaseInfo",
  "releaseSupport",
  "artistPhotosLink",
  "specifySocialMedia",
  "vkLink",
  "tiktokLink",
  "youtubeLink",
  "instagramLink",
  "soundcloudLink",
  "specifyStreamingLinks",
  "yandexMusicLink",
  "spotifyLink",
  "appleMusicLink",
  "vkMusicLink",
  "otherComments",
] as const

export type PromoPayloadKey = (typeof PROMO_PAYLOAD_KEYS)[number]

export const FORM_QUEUE_CONTRACTS = {
  catalog_upload: {
    formType: "catalog_upload" as const,
    dbKey: "form_back_catalog" as const,
    title: "ROSSEL — Бэк-каталог",
    userColumns: FORM_QUEUE_COLUMNS,
    forbiddenColumns: FORM_QUEUE_FORBIDDEN_COLUMNS,
    hasContact: false,
    hasPromo: false,
    multiRelease: true,
    hasUpc: true,
    hasIsrc: true,
  },
  release_upload: {
    formType: "release_upload" as const,
    dbKey: "form_release_upload" as const,
    title: "ROSSEL — Загрузка релиза",
    userColumns: FORM_QUEUE_COLUMNS,
    forbiddenColumns: FORM_QUEUE_FORBIDDEN_COLUMNS,
    hasContact: false,
    hasPromo: true,
    multiRelease: false,
    hasUpc: false,
    hasIsrc: false,
  },
  distribution: {
    formType: "distribution" as const,
    dbKey: "form_distribution" as const,
    title: "ROSSEL — Дистрибуция",
    userColumns: FORM_QUEUE_COLUMNS,
    forbiddenColumns: FORM_QUEUE_FORBIDDEN_COLUMNS,
    hasContact: true,
    hasPromo: true,
    multiRelease: false,
    hasUpc: false,
    hasIsrc: false,
  },
} as const

export type FileFormType = keyof typeof FORM_QUEUE_CONTRACTS

export function isFileFormType(formType: string): formType is FileFormType {
  return formType in FORM_QUEUE_CONTRACTS
}

export function pickPromoPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of PROMO_PAYLOAD_KEYS) {
    const v = raw[key]
    if (v == null || v === "" || v === "0") continue
    out[key] = v
  }
  return out
}

/** Honest catalog list title */
export function catalogApplicationTitle(
  releases: Array<{ releaseTitle: string }>
): string {
  if (releases.length === 0) return "Бэк-каталог"
  if (releases.length === 1) return releases[0].releaseTitle.trim() || "Бэк-каталог"
  return `Бэк-каталог — ${releases.length} релизов`
}

/** Unique artist nicknames across releases */
export function catalogArtistSummary(
  releases: Array<{ artists?: string }>
): string {
  const set = new Set<string>()
  for (const r of releases) {
    for (const part of (r.artists || "").split(",")) {
      const t = part.trim()
      if (t) set.add(t)
    }
  }
  return [...set].join(", ")
}
