import { buildinCreatePage, buildinUpdatePage } from "@/lib/buildin/client"
import { requireBuildinDatabaseId } from "@/lib/buildin/env"
import {
  checkboxProp,
  dateProp,
  numberProp,
  relationProp,
  selectProp,
  textProp,
  titleProp,
  urlProp,
} from "@/lib/buildin/types"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"
import { REPORT_OPS_STATUS_LABELS, labelFor } from "@/lib/buildin/labels"

export type ReportSyncInput = {
  id: string
  artistId?: string | null
  artistName: string
  quarter: string
  year?: number | null
  totalAmount?: number | null
  totalPlays?: number | null
  isPaid?: boolean | null
  isSigned?: boolean | null
  isAcknowledged?: boolean | null
  isRegistered?: boolean | null
  fileUrl?: string | null
  opsStatus?: string | null
  assignee?: string | null
  notes?: string | null
  version?: number
}

/** Financial flags are mirrored read-only; ops fields are allowlisted for reverse sync later */
export const REPORT_OPS_ALLOWLIST = ["opsStatus", "assignee", "deadline", "notes"] as const

/** Buildin property names owned by ops (never overwritten by forward sync updates). */
export const REPORT_OPS_PROPERTY_KEYS = [
  "Операционный статус",
  "Ответственный",
  "Дедлайн",
  "Заметки",
] as const

async function reportMirrorProperties(report: ReportSyncInput) {
  const title = `${report.artistName} — ${report.quarter} ${report.year ?? ""}`.trim()
  const props: Record<string, unknown> = {
    Название: titleProp(title),
    "Локальный ID": textProp(report.id),
    "ID артиста": textProp(report.artistId || ""),
    Артист: textProp(report.artistName),
    Квартал: textProp(report.quarter),
    Год: numberProp(report.year ?? null),
    Сумма: numberProp(report.totalAmount ?? null),
    Прослушивания: numberProp(report.totalPlays ?? null),
    Оплачен: checkboxProp(report.isPaid === true),
    Подписан: checkboxProp(report.isSigned === true),
    Подтверждён: checkboxProp(report.isAcknowledged === true),
    Зарегистрирован: checkboxProp(report.isRegistered !== false),
    "URL файла": urlProp(report.fileUrl || null),
    "Версия синхр.": numberProp(report.version ?? 1),
  }

  if (report.artistId) {
    const artistPage = await getExternalId("artist", report.artistId)
    if (artistPage) {
      props["АртистRel"] = relationProp([artistPage.buildinPageId])
    }
  }

  return props
}

function reportCreateOpsProperties(report: ReportSyncInput) {
  const machine = report.opsStatus || (report.isPaid ? "paid" : "queue")
  return {
    "Операционный статус": selectProp(labelFor(REPORT_OPS_STATUS_LABELS, machine)),
    Заметки: textProp(report.notes || ""),
  }
}

export async function syncReportToBuildin(report: ReportSyncInput & { archived?: boolean }) {
  const dbId = requireBuildinDatabaseId("reports")
  const existing = await getExternalId("report", report.id)
  const mirror = await reportMirrorProperties(report)

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, {
      properties: mirror,
      ...(report.archived ? { in_trash: true } : {}),
    })
    await upsertExternalId({
      entityType: "report",
      localId: report.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "reports",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  if (report.archived) return null

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: { ...mirror, ...reportCreateOpsProperties(report) },
    },
    `report:${report.id}`
  )
  await upsertExternalId({
    entityType: "report",
    localId: report.id,
    buildinPageId: page.id,
    buildinDbKey: "reports",
    version: 1,
  })
  return page.id
}

export type PlaylistSyncInput = {
  /** placementKey — stable local id for BuildinExternalId */
  id: string
  trackTitle: string
  artistName: string
  playlistName: string
  playlistUrl: string
  firstSeenDate?: string | null
  /** @deprecated ignored — kept for old outbox payloads */
  platform?: string
  artistId?: string | null
  lastSeenDate?: string | null
  coverUrl?: string | null
}

/**
 * Sync one track placement page (slim 5-field schema).
 * entityType: playlist_placement, localId: placementKey
 */
export async function syncPlaylistToBuildin(
  pl: PlaylistSyncInput & { archived?: boolean }
) {
  const dbId = requireBuildinDatabaseId("playlists")
  const localId = pl.id
  const existing =
    (await getExternalId("playlist_placement", localId)) ||
    // Legacy 1:1 playlist-row mappings during migration window
    (await getExternalId("playlist", localId))

  const properties: Record<string, unknown> = {
    Трек: titleProp(pl.trackTitle?.trim() || "Untitled"),
    Артист: textProp(pl.artistName || ""),
    Плейлист: textProp(pl.playlistName || ""),
    URL: urlProp(pl.playlistUrl || null),
    "Впервые обнаружен": dateProp(
      pl.firstSeenDate && /^\d{4}-\d{2}-\d{2}/.test(pl.firstSeenDate)
        ? pl.firstSeenDate.slice(0, 10)
        : null
    ),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, {
      properties,
      ...(pl.archived ? { in_trash: true } : {}),
    })
    await upsertExternalId({
      entityType: "playlist_placement",
      localId,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "playlists",
    })
    return existing.buildinPageId
  }

  if (pl.archived) return null

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
    `playlist_placement:${localId}`
  )
  await upsertExternalId({
    entityType: "playlist_placement",
    localId,
    buildinPageId: page.id,
    buildinDbKey: "playlists",
  })
  return page.id
}

export type ActivitySyncInput = {
  id: string
  type: string
  userId?: string | null
  userRole: string
  title: string
  description: string
  createdAt: Date | string
}

export async function syncActivityToBuildin(a: ActivitySyncInput) {
  const dbId = requireBuildinDatabaseId("activity")
  const existing = await getExternalId("activity", a.id)
  if (existing) return existing.buildinPageId

  const created =
    typeof a.createdAt === "string"
      ? a.createdAt.slice(0, 10)
      : a.createdAt.toISOString().slice(0, 10)

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
        Title: titleProp(a.title),
        "Local ID": textProp(a.id),
        Type: textProp(a.type),
        Role: textProp(a.userRole),
        "User ID": textProp(a.userId || ""),
        Description: textProp(a.description),
        Created: dateProp(created),
      },
    },
    `activity:${a.id}`
  )
  await upsertExternalId({
    entityType: "activity",
    localId: a.id,
    buildinPageId: page.id,
    buildinDbKey: "activity",
  })
  return page.id
}

export type ParserRunSyncInput = {
  platform: string
  status: string
  lastRun?: Date | string | null
  needsNewCookies?: boolean
  failedAttempts?: number
  lastError?: string | null
  adminLink?: string | null
}

export async function syncParserRunToBuildin(run: ParserRunSyncInput) {
  const dbId = requireBuildinDatabaseId("automation_runs")
  const localId = run.platform
  const existing = await getExternalId("parser_run", localId)

  const lastRunDate =
    run.lastRun == null
      ? null
      : typeof run.lastRun === "string"
        ? run.lastRun.slice(0, 10)
        : run.lastRun.toISOString().slice(0, 10)

  const properties = {
    Platform: titleProp(run.platform),
    Status: selectProp(run.status || "idle"),
    "Last Run": dateProp(lastRunDate),
    "Needs Cookies": checkboxProp(run.needsNewCookies === true),
    "Failed Attempts": numberProp(run.failedAttempts ?? 0),
    "Last Error": textProp(run.lastError || ""),
    "Admin Link": urlProp(run.adminLink || null),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
    await upsertExternalId({
      entityType: "parser_run",
      localId,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "automation_runs",
    })
    return existing.buildinPageId
  }

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
    `parser:${localId}`
  )
  await upsertExternalId({
    entityType: "parser_run",
    localId,
    buildinPageId: page.id,
    buildinDbKey: "automation_runs",
  })
  return page.id
}

export type PlaylistHistorySyncInput = {
  id: string
  playlistName: string
  playlistUrl: string
  platform: string
  changeType: string
  changeDate: string
  artistName?: string | null
  trackTitle?: string | null
}

export async function syncPlaylistHistoryToBuildin(h: PlaylistHistorySyncInput) {
  const dbId = requireBuildinDatabaseId("playlist_history")
  const existing = await getExternalId("playlist_history", h.id)
  if (existing) return existing.buildinPageId

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
        Playlist: titleProp(h.playlistName),
        "Local ID": textProp(h.id),
        Platform: textProp(h.platform),
        Change: textProp(h.changeType),
        Date: textProp(h.changeDate),
        Артист: textProp(h.artistName || ""),
        Track: textProp(h.trackTitle || ""),
        URL: urlProp(h.playlistUrl || null),
      },
    },
    `playlist-history:${h.id}`
  )
  await upsertExternalId({
    entityType: "playlist_history",
    localId: h.id,
    buildinPageId: page.id,
    buildinDbKey: "playlist_history",
  })
  return page.id
}
