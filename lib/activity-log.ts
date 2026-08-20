/**
 * Журнал событий: дедуп и подпись актора (F-03), лента артиста (F-04).
 *
 * F-03. Каждое добавление релиза писалось парой строк одним таймстампом —
 * уведомление артисту (`userId` = id артиста) и уведомление админу
 * (`userId: "system"`). В общем журнале /activity видны обе, причём вторая
 * без имени: колонка «КТО» показывала сырой «1782822801744», потому что имя
 * искали в подгруженной странице списка пользователей. Пара writer'ов
 * исправлена в местах записи, но 473 строки уже в базе — поэтому дедуп ещё и
 * на чтении.
 *
 * F-04. События про релизы и отчёты пишет система (`userId: "system"`,
 * артист — в `metadata.artistId`), а лента кабинета фильтровала строго по
 * `userId`. Артист видел только то, что записано лично на него, — «показано
 * событий: 1» при четырёх релизах и двух отчётах.
 */

export type ActivityLike = {
  id: string
  type: string
  userId: string
  userRole: "artist" | "admin"
  title: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export const SYSTEM_ACTOR_ID = "system"

/** Ключи metadata, по которым событие относится к конкретному объекту. */
const SUBJECT_KEYS = [
  "releaseId",
  "playlistId",
  "reportId",
  "advanceId",
  "trackId",
] as const

function subjectOf(activity: ActivityLike): string | null {
  const metadata = activity.metadata
  if (!metadata) return null
  for (const key of SUBJECT_KEYS) {
    const value = metadata[key]
    if (typeof value === "string" && value) return `${key}:${value}`
    if (typeof value === "number") return `${key}:${value}`
  }
  return null
}

/** Секунда события: пара пишется подряд и делит таймстамп. */
function secondOf(createdAt: string): string {
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return createdAt
  return String(Math.floor(ts / 1000))
}

/**
 * Схлопывает пары «уведомление артисту + уведомление админу» об одном объекте.
 *
 * Дедупим только события с явным объектом в metadata: без него две записи в
 * одну секунду могут быть двумя разными событиями, и терять одну нельзя.
 * Порядок исходного списка сохраняется, из пары остаётся запись с более
 * подробным описанием — в админской копии есть имя артиста.
 */
export function dedupeActivities<T extends ActivityLike>(activities: T[]): T[] {
  const keptIndexByKey = new Map<string, number>()
  const kept: Array<T | null> = []

  for (const activity of activities) {
    const subject = subjectOf(activity)
    if (!subject) {
      kept.push(activity)
      continue
    }
    const key = `${activity.type}|${subject}|${secondOf(activity.createdAt)}`
    const seenAt = keptIndexByKey.get(key)
    if (seenAt === undefined) {
      keptIndexByKey.set(key, kept.length)
      kept.push(activity)
      continue
    }
    const previous = kept[seenAt]
    if (previous && activity.description.length > previous.description.length) {
      kept[seenAt] = activity
    }
  }

  return kept.filter((a): a is T => a !== null)
}

/**
 * Подпись актора события. Сырой id на экран не попадает никогда: либо имя,
 * либо «Система», либо честное «Профиль удалён».
 */
export function activityActorLabel(
  activity: Pick<ActivityLike, "userId">,
  namesById: Map<string, string>
): string {
  if (!activity.userId || activity.userId === SYSTEM_ACTOR_ID) return "Система"
  const name = namesById.get(activity.userId)?.trim()
  return name || "Профиль удалён"
}

/**
 * Относится ли событие к кабинету этой группы профилей (AKA).
 *
 * Кабинет у группы один, поэтому проверяем все её id — и как актора события,
 * и как артиста в metadata: системные события про релизы и отчёты записаны
 * на «system», а артист указан только там.
 */
export function artistActivityMatches(
  activity: Pick<ActivityLike, "userId" | "metadata">,
  groupIds: readonly string[]
): boolean {
  if (groupIds.includes(activity.userId)) return true
  const artistId = activity.metadata?.artistId
  return typeof artistId === "string" && groupIds.includes(artistId)
}
