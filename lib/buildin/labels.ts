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

export type SubmissionOpsStatus = keyof typeof SUBMISSION_STATUS_LABELS

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
