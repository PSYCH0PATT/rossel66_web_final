/**
 * Сопоставление trackArtist из rossel_flash с профилями артистов.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeArtistName } from '@/lib/storage'
import { tokenizeCollaborationArtistField } from '@/lib/playlist-artist-match'
import { splitCollaboratingArtistDisplayNames } from '@/lib/split-artist-names'

export const ANALYTICS_ALIAS_MIGRATION_MESSAGE =
  'Миграция БД не применена: отсутствует таблица AnalyticsArtistAlias. Выполните pnpm db:migrate на Supabase (DIRECT_URL, порт 5432).'

export class AnalyticsAliasTableMissingError extends Error {
  constructor() {
    super(ANALYTICS_ALIAS_MIGRATION_MESSAGE)
    this.name = 'AnalyticsAliasTableMissingError'
  }
}

export function isAnalyticsAliasTableMissingError(error: unknown): boolean {
  if (error instanceof AnalyticsAliasTableMissingError) return true
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2021') return false
  const table = String((error.meta as { table?: string } | undefined)?.table ?? '')
  return table.includes('AnalyticsArtistAlias')
}

const LOOKALIKE_REPLACEMENTS: [RegExp, string][] = [
  [/ø/g, 'o'],
  [/Ø/g, 'o'],
  [/ö/g, 'o'],
  [/Ö/g, 'o'],
  [/ä/g, 'a'],
  [/Ä/g, 'a'],
  [/ü/g, 'u'],
  [/Ü/g, 'u'],
  [/ß/g, 'ss'],
]

/** Нормализация для сравнения (не для записи в БД). */
export function normalizeAnalyticsArtistKey(name: string): string {
  let s = normalizeArtistName(name)
  for (const [re, rep] of LOOKALIKE_REPLACEMENTS) {
    s = s.replace(re, rep)
  }
  try {
    s = s.normalize('NFD').replace(/\p{M}/gu, '')
  } catch {
    // ignore if Unicode property escapes unsupported
  }
  return s
}

export type AnalyticsArtistUser = {
  id: string
  name: string
  username: string
}

export type AnalyticsArtistAliasRow = {
  trackArtist: string
  artistId: string
}

export type AnalyticsArtistLookup = {
  aliasExact: Map<string, string>
  aliasNormalized: Map<string, string>
  userExact: Map<string, string>
  userNormalized: Map<string, string>
  rosterNormalizedToId: Map<string, string>
}

export function buildAnalyticsArtistLookup(
  users: AnalyticsArtistUser[],
  aliases: AnalyticsArtistAliasRow[]
): AnalyticsArtistLookup {
  const aliasExact = new Map<string, string>()
  const aliasNormalized = new Map<string, string>()
  const userExact = new Map<string, string>()
  const userNormalized = new Map<string, string>()
  const rosterNormalizedToId = new Map<string, string>()

  for (const a of aliases) {
    aliasExact.set(a.trackArtist, a.artistId)
    const norm = normalizeAnalyticsArtistKey(a.trackArtist)
    if (norm) aliasNormalized.set(norm, a.artistId)
  }

  for (const u of users) {
    for (const label of [u.name, u.username]) {
      if (!label) continue
      userExact.set(label, u.id)
      const norm = normalizeAnalyticsArtistKey(label)
      if (norm) {
        userNormalized.set(norm, u.id)
        rosterNormalizedToId.set(norm, u.id)
      }
    }
  }

  return { aliasExact, aliasNormalized, userExact, userNormalized, rosterNormalizedToId }
}

function resolveSingleToken(token: string, lookup: AnalyticsArtistLookup): string | null {
  if (lookup.aliasExact.has(token)) return lookup.aliasExact.get(token)!
  const norm = normalizeAnalyticsArtistKey(token)
  if (norm && lookup.aliasNormalized.has(norm)) return lookup.aliasNormalized.get(norm)!
  if (lookup.userExact.has(token)) return lookup.userExact.get(token)!
  if (norm && lookup.userNormalized.has(norm)) return lookup.userNormalized.get(norm)!
  return null
}

/** Определяет artistId для строки trackArtist из CSV. */
export function resolveArtistId(
  trackArtist: string,
  lookup: AnalyticsArtistLookup
): string | null {
  const raw = trackArtist.trim()
  if (!raw) return null

  const direct = resolveSingleToken(raw, lookup)
  if (direct) return direct

  const tokens = tokenizeCollaborationArtistField(raw)
  if (tokens.length <= 1) {
    const norm = normalizeAnalyticsArtistKey(raw)
    if (norm && lookup.userNormalized.has(norm)) return lookup.userNormalized.get(norm)!
    return null
  }

  const matched = new Set<string>()
  for (const token of tokens) {
    const id = resolveSingleToken(token, lookup)
    if (id) matched.add(id)
  }
  if (matched.size === 1) return [...matched][0]
  return null
}

export function isCollaborationTrackArtist(trackArtist: string): boolean {
  return splitCollaboratingArtistDisplayNames(trackArtist).length > 1
}

/** Коллаб, у которого каждый токен матчится на артиста в ростере — ручная привязка не нужна. */
export function isCollabFullyResolvedInRoster(
  trackArtist: string,
  lookup: AnalyticsArtistLookup
): boolean {
  const parts = splitCollaboratingArtistDisplayNames(trackArtist.trim())
  if (parts.length <= 1) return false
  for (const part of parts) {
    if (!resolveSingleToken(part, lookup)) return false
  }
  return true
}

/** Имя из CSV без artistId, требующее ручного сопоставления (исключая полностью разрешённые коллабы). */
export function needsManualUnmappedMapping(
  trackArtist: string,
  lookup: AnalyticsArtistLookup
): boolean {
  return !isCollabFullyResolvedInRoster(trackArtist, lookup)
}

async function loadAnalyticsAliasRows(): Promise<AnalyticsArtistAliasRow[]> {
  try {
    return await prisma.analyticsArtistAlias.findMany({
      select: { trackArtist: true, artistId: true },
    })
  } catch (error) {
    if (isAnalyticsAliasTableMissingError(error)) {
      console.warn(
        '⚠️ AnalyticsArtistAlias table missing; using User-only artist matching until migrate deploy'
      )
      return []
    }
    throw error
  }
}

export async function loadAnalyticsArtistLookup(): Promise<AnalyticsArtistLookup> {
  const [users, aliases] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'artist' },
      select: { id: true, name: true, username: true },
    }),
    loadAnalyticsAliasRows(),
  ])
  return buildAnalyticsArtistLookup(users, aliases)
}

export async function resolveArtistIdFromDb(trackArtist: string): Promise<string | null> {
  const lookup = await loadAnalyticsArtistLookup()
  return resolveArtistId(trackArtist, lookup)
}

/** Создаёт алиасы и backfill StreamAnalytics для имён артиста. */
export async function assignAnalyticsToArtist(
  artistId: string,
  names: string[]
): Promise<{ aliasesCreated: number; rowsUpdated: number }> {
  const trimmedNames = names.map((n) => n?.trim()).filter((n): n is string => Boolean(n))
  const trackArtistsToLink = new Set<string>(trimmedNames)
  const lookup = await loadAnalyticsArtistLookup()

  const unmapped = await prisma.streamAnalytics.findMany({
    where: { artistId: null },
    select: { trackArtist: true },
    distinct: ['trackArtist'],
  })

  for (const row of unmapped) {
    if (resolveArtistId(row.trackArtist, lookup) === artistId) {
      trackArtistsToLink.add(row.trackArtist)
    }
    for (const name of trimmedNames) {
      if (row.trackArtist === name) trackArtistsToLink.add(row.trackArtist)
      if (normalizeAnalyticsArtistKey(row.trackArtist) === normalizeAnalyticsArtistKey(name)) {
        trackArtistsToLink.add(row.trackArtist)
      }
    }
  }

  if (trackArtistsToLink.size > 0) {
    try {
      for (const trackArtist of trackArtistsToLink) {
        await prisma.analyticsArtistAlias.upsert({
          where: { trackArtist },
          create: { trackArtist, artistId },
          update: { artistId },
        })
      }
    } catch (error) {
      if (!isAnalyticsAliasTableMissingError(error)) throw error
      console.warn('⚠️ AnalyticsArtistAlias missing; backfill StreamAnalytics without alias rows')
    }
  }

  const trackArtistList = [...trackArtistsToLink]
  let rowsUpdated = 0
  if (trackArtistList.length > 0) {
    const result = await prisma.streamAnalytics.updateMany({
      where: {
        trackArtist: { in: trackArtistList },
        OR: [{ artistId: null }, { artistId }],
      },
      data: { artistId },
    })
    rowsUpdated = result.count
  }

  return { aliasesCreated: trackArtistsToLink.size, rowsUpdated }
}

/** Ручная привязка CSV-имени к профилю. */
export async function linkTrackArtistToProfile(
  trackArtist: string,
  artistId: string
): Promise<{ rowsUpdated: number }> {
  const trimmed = trackArtist.trim()
  if (!trimmed) return { rowsUpdated: 0 }

  try {
    await prisma.analyticsArtistAlias.upsert({
      where: { trackArtist: trimmed },
      create: { trackArtist: trimmed, artistId },
      update: { artistId },
    })
  } catch (error) {
    if (isAnalyticsAliasTableMissingError(error)) {
      throw new AnalyticsAliasTableMissingError()
    }
    throw error
  }

  const result = await prisma.streamAnalytics.updateMany({
    where: { trackArtist: trimmed },
    data: { artistId },
  })

  return { rowsUpdated: result.count }
}

export type UnmappedTrackArtist = {
  trackArtist: string
  totalStreams: number
  rowCount: number
  isCollaboration: boolean
}

export async function listUnmappedTrackArtists(opts?: {
  take?: number
  skip?: number
}): Promise<UnmappedTrackArtist[]> {
  const take = Math.min(opts?.take ?? 500, 2000)
  const skip = Math.max(0, opts?.skip ?? 0)
  const lookup = await loadAnalyticsArtistLookup()

  const grouped = await prisma.streamAnalytics.groupBy({
    by: ['trackArtist'],
    where: { artistId: null },
    _sum: { streams: true },
    _count: { _all: true },
    orderBy: { _sum: { streams: 'desc' } },
  })

  const filtered = grouped.filter((g) => needsManualUnmappedMapping(g.trackArtist, lookup))
  const sliced = filtered.slice(skip, skip + take)

  return sliced.map((g) => ({
    trackArtist: g.trackArtist,
    totalStreams: g._sum.streams ?? 0,
    rowCount: g._count._all,
    isCollaboration: isCollaborationTrackArtist(g.trackArtist),
  }))
}

export async function countUnmappedTrackArtists(): Promise<number> {
  const lookup = await loadAnalyticsArtistLookup()
  const rows = await prisma.streamAnalytics.groupBy({
    by: ['trackArtist'],
    where: { artistId: null },
  })
  return rows.filter((r) => needsManualUnmappedMapping(r.trackArtist, lookup)).length
}

/** Rematch всех строк с artistId IS NULL. */
export async function rematchUnmappedAnalytics(): Promise<{
  trackArtistsProcessed: number
  rowsUpdated: number
  stillUnmapped: number
}> {
  const lookup = await loadAnalyticsArtistLookup()

  const distinct = await prisma.streamAnalytics.findMany({
    where: { artistId: null },
    select: { trackArtist: true },
    distinct: ['trackArtist'],
  })

  let rowsUpdated = 0
  for (const { trackArtist } of distinct) {
    const artistId = resolveArtistId(trackArtist, lookup)
    if (!artistId) continue
    const result = await prisma.streamAnalytics.updateMany({
      where: { trackArtist, artistId: null },
      data: { artistId },
    })
    rowsUpdated += result.count
  }

  const stillUnmapped = await countUnmappedTrackArtists()
  return {
    trackArtistsProcessed: distinct.length,
    rowsUpdated,
    stillUnmapped,
  }
}

/**
 * Видимость строки аналитики в кабинете артиста (коллабы без artistId).
 */
export function analyticsRowVisibleToCabinetUser(
  row: { trackArtist: string; artistId: string | null },
  userId: string,
  displayName: string,
  username: string,
  aliasTrackArtists: Set<string>
): boolean {
  if (row.artistId === userId) return true
  if (row.artistId != null) return false
  if (aliasTrackArtists.has(row.trackArtist)) return true

  const normDisplay = normalizeAnalyticsArtistKey(displayName || '')
  const normUser = normalizeAnalyticsArtistKey(username || '')
  const norms = new Set<string>()
  if (normDisplay) norms.add(normDisplay)
  if (normUser) norms.add(normUser)

  for (const t of tokenizeCollaborationArtistField(row.trackArtist)) {
    if (norms.has(normalizeAnalyticsArtistKey(t))) return true
  }
  return norms.has(normalizeAnalyticsArtistKey(row.trackArtist))
}

/** Prisma where для кабинета артиста. */
export async function buildCabinetStreamAnalyticsWhere(
  userId: string,
  displayName: string,
  username: string
): Promise<Record<string, unknown>> {
  let aliasSet = new Set<string>()
  try {
    const aliases = await prisma.analyticsArtistAlias.findMany({
      where: { artistId: userId },
      select: { trackArtist: true },
    })
    aliasSet = new Set(aliases.map((a) => a.trackArtist))
  } catch (error) {
    if (!isAnalyticsAliasTableMissingError(error)) throw error
  }

  const unmappedDistinct = await prisma.streamAnalytics.findMany({
    where: { artistId: null },
    select: { trackArtist: true },
    distinct: ['trackArtist'],
  })

  const matchingUnmapped = unmappedDistinct
    .filter((r) =>
      analyticsRowVisibleToCabinetUser(
        { trackArtist: r.trackArtist, artistId: null },
        userId,
        displayName,
        username,
        aliasSet
      )
    )
    .map((r) => r.trackArtist)

  const orClauses: Record<string, unknown>[] = [{ artistId: userId }]
  if (matchingUnmapped.length > 0) {
    orClauses.push({ artistId: null, trackArtist: { in: matchingUnmapped } })
  }

  return { OR: orClauses }
}
