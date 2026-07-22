import { createHash, randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import {
  isBuildinDualWriteEnabled,
  isPyrusWriteDisabled,
} from "@/lib/buildin/env"
import {
  createSubmissionInBuildin,
  type PendingFileUpload,
} from "@/lib/buildin/adapters/submissions"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import type { FileMeta, FormType } from "@/lib/buildin/types"

export type DualWriteResult = {
  submissionId: string
  status: string
  pyrusTaskId: string | null
  buildinPageId: string | null
  buildinUrl?: string
  filesMeta: FileMeta[]
  warnings: string[]
}

function makeIdempotencyKey(formType: FormType, seed?: string): string {
  const raw = seed?.trim() || `${formType}:${Date.now()}:${randomUUID()}`
  return createHash("sha256").update(raw).digest("hex").slice(0, 48)
}

/**
 * Persist canonical submission, optionally dual-write to Buildin.
 * Pyrus write is still performed by the caller (legacy adapters) unless PYRUS_WRITE_DISABLED.
 */
export async function recordAndDualWriteSubmission(opts: {
  formType: FormType
  title: string
  payload: Record<string, unknown>
  contactEmail?: string | null
  contactTelegram?: string | null
  artistNickname?: string | null
  pyrusTaskId?: string | null
  files?: PendingFileUpload[]
  /** Client-provided idempotency (upload_id / form hash) */
  idempotencySeed?: string
}): Promise<DualWriteResult> {
  const warnings: string[] = []
  const idempotencyKey = makeIdempotencyKey(opts.formType, opts.idempotencySeed)

  const existing = await prisma.formSubmission.findUnique({
    where: { idempotencyKey },
  })
  if (existing?.status === "completed" && existing.buildinPageId) {
    return {
      submissionId: existing.id,
      status: existing.status,
      pyrusTaskId: existing.pyrusTaskId,
      buildinPageId: existing.buildinPageId,
      filesMeta: (existing.filesMeta as FileMeta[]) || [],
      warnings: ["Идемпотентный повтор: заявка уже сохранена"],
    }
  }

  const submission =
    existing ??
    (await prisma.formSubmission.create({
      data: {
        formType: opts.formType,
        status: "pending",
        idempotencyKey,
        title: opts.title,
        contactEmail: opts.contactEmail ?? null,
        contactTelegram: opts.contactTelegram ?? null,
        artistNickname: opts.artistNickname ?? null,
        payload: opts.payload as Prisma.InputJsonValue,
        filesMeta: [],
        pyrusTaskId: opts.pyrusTaskId ?? null,
      },
    }))

  if (opts.pyrusTaskId && submission.pyrusTaskId !== opts.pyrusTaskId) {
    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { pyrusTaskId: opts.pyrusTaskId },
    })
  }

  let buildinPageId: string | null = submission.buildinPageId
  let buildinUrl: string | undefined
  let filesMeta: FileMeta[] = (submission.filesMeta as FileMeta[]) || []

  if (isBuildinDualWriteEnabled()) {
    try {
      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: { status: "dual_writing" },
      })

      const created = await createSubmissionInBuildin({
        submissionId: submission.id,
        formType: opts.formType,
        title: opts.title,
        contactEmail: opts.contactEmail,
        contactTelegram: opts.contactTelegram,
        artistNickname: opts.artistNickname,
        payload: opts.payload,
        pyrusTaskId: opts.pyrusTaskId ?? submission.pyrusTaskId,
        files: opts.files,
        idempotencyKey,
      })

      buildinPageId = created.pageId
      buildinUrl = created.url
      filesMeta = created.filesMeta

      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: {
          status: "completed",
          buildinPageId,
          filesMeta,
          lastError: null,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      warnings.push(`Buildin dual-write failed: ${message}`)
      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: {
          status: opts.pyrusTaskId || isPyrusWriteDisabled() ? "partial" : "failed",
          lastError: message.slice(0, 4000),
        },
      })
      await enqueueBuildinOutbox({
        eventType: "create_submission",
        submissionId: submission.id,
        payload: {
          submissionId: submission.id,
          formType: opts.formType,
          title: opts.title,
          // files cannot be replayed from outbox without storage — retry metadata-only
          metadataOnly: true,
          pyrusTaskId: opts.pyrusTaskId ?? null,
        },
        delayMs: 30_000,
      })
    }
  } else if (opts.pyrusTaskId) {
    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { status: "completed", pyrusTaskId: opts.pyrusTaskId },
    })
  }

  return {
    submissionId: submission.id,
    status: (await prisma.formSubmission.findUnique({ where: { id: submission.id } }))
      ?.status ?? "pending",
    pyrusTaskId: opts.pyrusTaskId ?? submission.pyrusTaskId,
    buildinPageId,
    buildinUrl,
    filesMeta,
    warnings,
  }
}

export function fileFromFormDataFile(
  fieldKey: string,
  file: File
): Promise<PendingFileUpload> {
  return file.arrayBuffer().then((ab) => ({
    fieldKey,
    filename: file.name || fieldKey,
    contentType: file.type || "application/octet-stream",
    bytes: new Uint8Array(ab),
  }))
}
