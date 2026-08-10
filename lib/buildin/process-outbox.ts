import { prisma } from "@/lib/prisma"
import { getBuildinApiToken, getBuildinDatabaseId } from "@/lib/buildin/env"
import {
  claimPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
} from "@/lib/buildin/outbox"
import { createSubmissionInBuildin } from "@/lib/buildin/adapters/submissions"
import { downloadStagedSubmissionFiles } from "@/lib/buildin/file-staging"
import {
  syncArtistToBuildin,
  syncReleaseToBuildin,
  syncTrackToBuildin,
} from "@/lib/buildin/adapters/artists-releases"
import {
  syncActivityToBuildin,
  syncParserRunToBuildin,
  syncPlaylistHistoryToBuildin,
  syncPlaylistToBuildin,
  syncReportToBuildin,
} from "@/lib/buildin/adapters/ops-mirrors"
import type { FileMeta, FormType } from "@/lib/buildin/types"
import type { Prisma } from "@prisma/client"

export type ProcessOutboxResult = {
  processed: number
  done: number
  failed: number
  skipped: number
  errors: string[]
}

export async function processBuildinOutbox(limit = 10): Promise<ProcessOutboxResult> {
  const result: ProcessOutboxResult = {
    processed: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  if (!getBuildinApiToken()) {
    result.skipped = limit
    result.errors.push("BUILDIN_API_TOKEN not configured")
    return result
  }

  const claimed = await claimPendingOutbox(limit)
  for (const row of claimed) {
    result.processed++
    try {
      await handleOutboxEvent(row.eventType, row.payload as Record<string, unknown>)
      await markOutboxDone(row.id)
      result.done++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`${row.id}: ${message}`)
      await markOutboxFailed(row.id, message, row.attempts, row.maxAttempts)
      result.failed++
    }
  }

  return result
}

async function handleOutboxEvent(eventType: string, payload: Record<string, unknown>) {
  switch (eventType) {
    case "create_submission": {
      const submissionId = String(payload.submissionId || "")
      if (!submissionId) throw new Error("missing submissionId")
      if (!getBuildinDatabaseId("submissions")) {
        throw new Error("BUILDIN_DB_SUBMISSIONS missing")
      }
      const submission = await prisma.formSubmission.findUnique({
        where: { id: submissionId },
      })
      if (!submission) throw new Error(`submission ${submissionId} not found`)

      // File-upload forms must never land in the shared submissions inbox.
      // They use /api/forms/sessions → form_* queue DBs.
      if (
        submission.formType === "catalog_upload" ||
        submission.formType === "release_upload" ||
        submission.formType === "distribution"
      ) {
        throw new Error(
          `create_submission outbox refused for file formType «${submission.formType}» — use form session queues, not submissions inbox`
        )
      }

      const existingMeta = (submission.filesMeta as FileMeta[]) || []
      const expectedFileCount =
        typeof payload.expectedFileCount === "number"
          ? payload.expectedFileCount
          : existingMeta.length

      let files = await downloadStagedSubmissionFiles(existingMeta)

      const created = await createSubmissionInBuildin({
        submissionId: submission.id,
        formType: submission.formType as FormType,
        title: submission.title,
        contactEmail: submission.contactEmail,
        contactTelegram: submission.contactTelegram,
        artistNickname: submission.artistNickname,
        payload: submission.payload as Record<string, unknown>,
        pyrusTaskId: submission.pyrusTaskId,
        files,
        expectedFileCount,
      })

      const mergedMeta: FileMeta[] = existingMeta.map((m) => {
        const uploaded = created.filesMeta.find(
          (u) => u.fieldKey === m.fieldKey && u.filename === m.filename
        )
        return uploaded
          ? {
              ...m,
              buildinOssName: uploaded.buildinOssName,
              buildinFileUrl: uploaded.buildinFileUrl,
            }
          : m
      })
      for (const u of created.filesMeta) {
        if (
          !mergedMeta.some(
            (m) => m.fieldKey === u.fieldKey && m.filename === u.filename
          )
        ) {
          mergedMeta.push(u)
        }
      }

      const uploadedCount = mergedMeta.filter((m) => m.buildinOssName).length
      const isPii =
        submission.formType === "data_rf" || submission.formType === "data_not_rf"
      const filesComplete =
        isPii || expectedFileCount === 0 || uploadedCount >= expectedFileCount

      if (!filesComplete) {
        await prisma.formSubmission.update({
          where: { id: submission.id },
          data: {
            buildinPageId: created.pageId,
            status: "partial",
            filesMeta: mergedMeta as unknown as Prisma.InputJsonValue,
            lastError: `Files incomplete: ${uploadedCount}/${expectedFileCount}`,
          },
        })
        throw new Error(
          `Submission files incomplete: ${uploadedCount}/${expectedFileCount}`
        )
      }

      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: {
          buildinPageId: created.pageId,
          status: "completed",
          filesMeta: mergedMeta as unknown as Prisma.InputJsonValue,
          lastError: null,
        },
      })
      return
    }
    case "sync_artist": {
      await syncArtistToBuildin(payload as never)
      return
    }
    case "sync_release": {
      await syncReleaseToBuildin(payload as never)
      return
    }
    case "sync_track": {
      await syncTrackToBuildin(payload as never)
      return
    }
    case "sync_report": {
      await syncReportToBuildin(payload as never)
      return
    }
    case "sync_playlist": {
      await syncPlaylistToBuildin(payload as never)
      return
    }
    case "sync_activity": {
      // Legacy jobs may still be in outbox; process but new enqueues are no-ops
      await syncActivityToBuildin(payload as never)
      return
    }
    case "sync_parser": {
      await syncParserRunToBuildin(payload as never)
      return
    }
    case "sync_playlist_history": {
      await syncPlaylistHistoryToBuildin(payload as never)
      return
    }
    case "archive_artist": {
      const { getExternalId } = await import("@/lib/buildin/outbox")
      const { buildinUpdatePage } = await import("@/lib/buildin/client")
      const existing = await getExternalId("artist", String(payload.id))
      if (existing) await buildinUpdatePage(existing.buildinPageId, { in_trash: true })
      return
    }
    case "archive_release": {
      await syncReleaseToBuildin({
        id: String(payload.id),
        title: String(payload.title || payload.id),
        archived: true,
      })
      return
    }
    case "archive_report": {
      await syncReportToBuildin({
        id: String(payload.id),
        artistName: String(payload.title || "report"),
        quarter: "",
        archived: true,
      })
      return
    }
    case "archive_playlist": {
      await syncPlaylistToBuildin({
        id: String(payload.id),
        trackTitle: String(payload.trackTitle || payload.title || payload.id),
        artistName: String(payload.artistName || ""),
        playlistName: String(payload.playlistName || payload.title || ""),
        playlistUrl: String(payload.playlistUrl || ""),
        firstSeenDate: (payload.firstSeenDate as string) || null,
        archived: true,
      })
      return
    }
    case "archive_track": {
      await syncTrackToBuildin({
        id: String(payload.id),
        title: String(payload.title || payload.id),
        releaseLocalId: "",
        archived: true,
      })
      return
    }
    case "form_session_materialize": {
      const { materializeFormSession } = await import("@/lib/buildin/form-session")
      await materializeFormSession(String(payload.sessionId || ""))
      return
    }
    case "form_session_finalize": {
      const { runFormSessionFinalize } = await import("@/lib/buildin/form-session")
      await runFormSessionFinalize(String(payload.sessionId || ""))
      return
    }
    default:
      throw new Error(`Unknown outbox eventType: ${eventType}`)
  }
}
