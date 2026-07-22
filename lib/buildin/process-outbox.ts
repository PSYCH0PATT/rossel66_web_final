import { prisma } from "@/lib/prisma"
import { getBuildinApiToken, getBuildinDatabaseId } from "@/lib/buildin/env"
import {
  claimPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
} from "@/lib/buildin/outbox"
import { createSubmissionInBuildin } from "@/lib/buildin/adapters/submissions"
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
import type { FormType } from "@/lib/buildin/types"

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
      if (submission.buildinPageId) return

      const created = await createSubmissionInBuildin({
        submissionId: submission.id,
        formType: submission.formType as FormType,
        title: submission.title,
        contactEmail: submission.contactEmail,
        contactTelegram: submission.contactTelegram,
        artistNickname: submission.artistNickname,
        payload: submission.payload as Record<string, unknown>,
        pyrusTaskId: submission.pyrusTaskId,
        files: [], // binary replay not available; metadata-only recovery
        idempotencyKey: `${submission.idempotencyKey}:retry`,
      })
      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: {
          buildinPageId: created.pageId,
          status: "completed",
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
    default:
      throw new Error(`Unknown outbox eventType: ${eventType}`)
  }
}
