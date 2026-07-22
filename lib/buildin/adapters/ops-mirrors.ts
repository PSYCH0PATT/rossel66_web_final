import { buildinCreatePage, buildinUpdatePage } from "@/lib/buildin/client"
import { requireBuildinDatabaseId } from "@/lib/buildin/env"
import {
  checkboxProp,
  dateProp,
  numberProp,
  selectProp,
  textProp,
  titleProp,
  urlProp,
} from "@/lib/buildin/types"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"

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

export async function syncReportToBuildin(report: ReportSyncInput) {
  const dbId = requireBuildinDatabaseId("reports")
  const existing = await getExternalId("report", report.id)
  const title = `${report.artistName} — ${report.quarter} ${report.year ?? ""}`.trim()

  const properties = {
    Название: titleProp(title),
    "Local ID": textProp(report.id),
    "Artist ID": textProp(report.artistId || ""),
    Артист: textProp(report.artistName),
    Quarter: textProp(report.quarter),
    Year: numberProp(report.year ?? null),
    Amount: numberProp(report.totalAmount ?? null),
    Plays: numberProp(report.totalPlays ?? null),
    Paid: checkboxProp(report.isPaid === true),
    Signed: checkboxProp(report.isSigned === true),
    Acknowledged: checkboxProp(report.isAcknowledged === true),
    Registered: checkboxProp(report.isRegistered !== false),
    "Ops Status": selectProp(report.opsStatus || (report.isPaid ? "paid" : "queue")),
    Assignee: textProp(report.assignee || ""),
    Notes: textProp(report.notes || ""),
    "File URL": urlProp(report.fileUrl || null),
    "Sync Version": numberProp(report.version ?? 1),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
    await upsertExternalId({
      entityType: "report",
      localId: report.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "reports",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
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
  id: string
  playlistName: string
  playlistUrl: string
  platform: string
  artistId?: string | null
  artistName?: string | null
  firstSeenDate?: string | null
  lastSeenDate?: string | null
  coverUrl?: string | null
}

export async function syncPlaylistToBuildin(pl: PlaylistSyncInput) {
  const dbId = requireBuildinDatabaseId("playlists")
  const existing = await getExternalId("playlist", pl.id)
  const properties = {
    Название: titleProp(pl.playlistName),
    "Local ID": textProp(pl.id),
    Platform: textProp(pl.platform),
    "Artist ID": textProp(pl.artistId || ""),
    Артист: textProp(pl.artistName || ""),
    URL: urlProp(pl.playlistUrl || null),
    "First Seen": textProp(pl.firstSeenDate || ""),
    "Last Seen": textProp(pl.lastSeenDate || ""),
    Cover: urlProp(pl.coverUrl || null),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
    await upsertExternalId({
      entityType: "playlist",
      localId: pl.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "playlists",
    })
    return existing.buildinPageId
  }

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
    `playlist:${pl.id}`
  )
  await upsertExternalId({
    entityType: "playlist",
    localId: pl.id,
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
