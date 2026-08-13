import { prisma } from "@/lib/prisma"

/**
 * Связанные профили артиста (AKA).
 *
 * У одного человека бывает несколько артист-профилей: парсеры заводят их по
 * разным именам, и каждый живёт своей карточкой. Привязка помечает часть
 * профилей как принадлежащие «главному» — он видит в своём кабинете статистику
 * и отчёты всех своих профилей.
 *
 * Иерархия ровно одноуровневая: главный не может быть привязан сам, а у
 * привязанного не может быть своих привязанных. Без этого пришлось бы обходить
 * дерево при каждом чтении и следить за циклами.
 */

export type LinkCandidate = {
  id: string
  role: string
  mainArtistId?: string | null
}

export type LinkValidationResult = { ok: true } | { ok: false; error: string }

/**
 * Можно ли привязать `linked` к `main`.
 *
 * `linkedChildrenCount` — сколько профилей уже привязано к самому `linked`:
 * если он кому-то главный, привязка создала бы второй уровень.
 */
export function validateLinkPair(
  main: LinkCandidate | null,
  linked: LinkCandidate | null,
  linkedChildrenCount: number
): LinkValidationResult {
  if (!main) return { ok: false, error: "Главный профиль не найден" }
  if (!linked) return { ok: false, error: "Привязываемый профиль не найден" }
  if (main.role !== "artist" || linked.role !== "artist") {
    return { ok: false, error: "Связывать можно только профили артистов" }
  }
  if (main.id === linked.id) {
    return { ok: false, error: "Профиль нельзя привязать к самому себе" }
  }
  if (main.mainArtistId) {
    return {
      ok: false,
      error: "Главный профиль сам привязан к другому — сначала отвяжите его",
    }
  }
  if (linkedChildrenCount > 0) {
    return {
      ok: false,
      error: "У привязываемого профиля есть свои привязанные — сначала отвяжите их",
    }
  }
  if (linked.mainArtistId && linked.mainArtistId !== main.id) {
    return { ok: false, error: "Профиль уже привязан к другому артисту" }
  }
  return { ok: true }
}

/** Профили одной группы: сам артист и всё, что к нему привязано. */
export type ArtistGroupMember = {
  id: string
  username: string
  name: string
  mainArtistId: string | null
}

/**
 * Группа профилей, доступных пользователю: он сам + привязанные к нему.
 *
 * Для привязанного профиля группа состоит из него одного — связь односторонняя,
 * снизу вверх доступа нет.
 */
export async function getArtistGroup(userId: string): Promise<ArtistGroupMember[]> {
  const members = await prisma.user.findMany({
    where: { OR: [{ id: userId }, { mainArtistId: userId }] },
    select: { id: true, username: true, name: true, mainArtistId: true },
    orderBy: { createdAt: "asc" },
  })
  // Главный всегда первым — он и есть точка входа в кабинет.
  return members.sort((a, b) => {
    if (a.id === userId) return -1
    if (b.id === userId) return 1
    return a.name.localeCompare(b.name, "ru")
  })
}

/** Только идентификаторы группы — для where-условий аналитики и отчётов. */
export async function getArtistGroupIds(userId: string): Promise<string[]> {
  const members = await prisma.user.findMany({
    where: { OR: [{ id: userId }, { mainArtistId: userId }] },
    select: { id: true },
  })
  const ids = members.map((m) => m.id)
  return ids.includes(userId) ? ids : [userId, ...ids]
}

/**
 * Может ли пользователь смотреть кабинет этого артиста.
 *
 * Тот же предикат раньше был скопирован в каждой странице кабинета по отдельности.
 */
export function canViewArtistCabinet(
  session: { id: string; role: string } | null,
  artist: { id: string; mainArtistId?: string | null }
): boolean {
  if (!session) return false
  if (session.role === "admin") return true
  if (session.id === artist.id) return true
  return artist.mainArtistId != null && artist.mainArtistId === session.id
}
