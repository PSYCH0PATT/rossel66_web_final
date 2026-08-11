/**
 * Mapping layer: machine enums in code → Russian labels in Buildin UI.
 * Forward sync always writes Russian option names when defined here.
 */

export const SUBMISSION_STATUS_LABELS = {
  uploading: "Загружается",
  new: "Новая",
  in_review: "В работе",
  needs_info: "Ждём артиста",
  approved: "Одобрена",
  rejected: "Отклонена",
  done: "Готово",
} as const
/** Machine formType → ops-facing Russian label */
export const FORM_TYPE_LABELS = {
  catalog_upload: "Бэк-каталог",
  release_upload: "Загрузка релиза",
  distribution: "Дистрибуция",
  data_rf: "Анкета РФ",
  data_not_rf: "Анкета не РФ",
  contact: "Обращение",
} as const

/** Catalog form (Pyrus 2312633): 1=single, 2=album */
export const CATALOG_RELEASE_TYPE_LABELS: Record<string, string> = {
  "1": "Сингл",
  "2": "Альбом",
}

/** Release upload / distribution: 1–4 */
export const RELEASE_UPLOAD_TYPE_LABELS: Record<string, string> = {
  "1": "Сингл (1 трек)",
  "2": "Макси-сингл (2-3 трека)",
  "3": "EP (2-7 треков)",
  "4": "Альбом (8 и более треков)",
}

export const GENRE_LABELS: Record<string, string> = {
  "1": "Hip Hop/Rap",
  "2": "Phonk",
  "3": "Electronic",
  "4": "Pop",
  "5": "Dance",
  "6": "Rock",
  "7": "Другой",
}

export const LANGUAGE_LABELS: Record<string, string> = {
  "1": "Русский",
  "2": "Английский",
  "3": "Без слов",
}

export const YES_NO_LABELS: Record<string, string> = {
  "1": "Да",
  "2": "Нет",
}

export const SOURCE_LABELS = {
  site: "Сайт",
  dual_write: "Двойная запись",
  manual: "Вручную",
} as const

/** Machine source → Russian select option */
export function sourceLabel(machine: keyof typeof SOURCE_LABELS | string): string {
  return labelFor(SOURCE_LABELS, machine, machine)
}

export const ARTIST_OPS_STATUS_LABELS = {
  active: "Активен",
  onboarding: "Онбординг",
  paused: "Пауза",
  archived: "Архив",
} as const

export const RELEASE_OPS_STATUS_LABELS = {
  intake: "Приёмка",
  prep: "Подготовка",
  ready: "Готов",
  delivered: "Доставлен",
  blocked: "Блок",
} as const

export const REPORT_OPS_STATUS_LABELS = {
  queue: "Очередь",
  review: "Проверка",
  ready_to_pay: "К выплате",
  paid: "Выплачен",
  blocked: "Блок",
} as const

export function labelFor(
  map: Record<string, string>,
  machine: string | null | undefined,
  fallback?: string
): string {
  if (!machine) return fallback || ""
  return map[machine] || machine
}

export function releaseTypeLabel(
  formType: string,
  releaseType: string | null | undefined
): string {
  if (!releaseType || releaseType === "0") return ""
  if (formType === "catalog_upload") {
    return labelFor(CATALOG_RELEASE_TYPE_LABELS, releaseType, releaseType)
  }
  return labelFor(RELEASE_UPLOAD_TYPE_LABELS, releaseType, releaseType)
}

export function genreLabel(
  genre: string | null | undefined,
  otherGenre?: string | null
): string {
  if (!genre || genre === "0") return otherGenre?.trim() || ""
  // Catalog uses free-text genre; release/distribution use choice ids
  if (/^\d+$/.test(genre)) {
    const base = labelFor(GENRE_LABELS, genre, genre)
    if (genre === "7" && otherGenre?.trim()) return `${base}: ${otherGenre.trim()}`
    return base
  }
  return genre
}

export function languageLabel(language: string | null | undefined): string {
  if (!language || language === "0") return ""
  return labelFor(LANGUAGE_LABELS, language, language)
}

export function yesNoLabel(value: string | null | undefined): string {
  if (!value || value === "0") return ""
  return labelFor(YES_NO_LABELS, value, value)
}
