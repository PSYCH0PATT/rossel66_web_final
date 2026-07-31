import { createHash, randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import {
  buildinAppendBlockChildren,
  buildinCreatePage,
  buildinGetUploadUrl,
  buildinUpdatePage,
  normalizeBuildinUploadContentType,
} from "@/lib/buildin/client"
import { requireBuildinDatabaseId } from "@/lib/buildin/env"
import { upsertExternalId, getExternalId, enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import {
  encryptManifestJson,
  decryptManifestJson,
  hashAccessToken,
  newAccessToken,
} from "@/lib/buildin/form-delivery-crypto"
import {
  assertManifestSize,
  countTracks,
  formSessionManifestSchema,
  sumFileBytes,
  type FormSessionManifest,
} from "@/lib/buildin/form-session-schema"
import {
  FORM_SESSION_ACTIVE_PER_IP,
  FORM_SESSION_MATERIALIZE_BATCH,
  FORM_SESSION_TTL_ABANDONED_DAYS,
  FORM_SESSION_TTL_COMPLETED_DAYS,
  richText,
  selectProp,
  textProp,
  titleProp,
  numberProp,
  emailProp,
  dateProp,
  checkboxProp,
  relationProp,
} from "@/lib/buildin/types"
import { labelFor, SUBMISSION_STATUS_LABELS } from "@/lib/buildin/labels"

function makeIdempotencyKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 48)
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export class FormSessionError extends Error {
  constructor(
    message: string,
    public httpStatus = 400,
    public code = "form_session_error"
  ) {
    super(message)
  }
}

export async function createFormDeliverySession(opts: {
  idempotencySeed: string
  manifest: unknown
  clientIp?: string | null
}): Promise<{
  sessionId: string
  accessToken: string
  status: string
  buildinPageId: string | null
}> {
  const parsed = formSessionManifestSchema.safeParse(opts.manifest)
  if (!parsed.success) {
    throw new FormSessionError(
      parsed.error.issues.map((i) => i.message).join("; ") || "Некорректный manifest",
      400,
      "validation"
    )
  }
  const manifest = parsed.data
  assertManifestSize(manifest)

  if (opts.clientIp) {
    // Drop stale in-flight sessions so a hung materialize cannot permanently
    // block the IP (common after schema/outage glitches and during E2E).
    const staleBefore = new Date(Date.now() - 20 * 60 * 1000)
    await prisma.formDeliverySession.updateMany({
      where: {
        clientIp: opts.clientIp,
        status: { in: ["created", "materializing", "uploading", "finalizing"] },
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: "abandoned",
        lastError: "Авто-очистка: сессия без прогресса >20 мин",
        expiresAt: new Date(),
      },
    })
    const active = await prisma.formDeliverySession.count({
      where: {
        clientIp: opts.clientIp,
        status: { in: ["created", "materializing", "uploading", "finalizing"] },
      },
    })
    if (active >= FORM_SESSION_ACTIVE_PER_IP) {
      throw new FormSessionError(
        "Слишком много активных загрузок с вашего IP. Дождитесь завершения.",
        429,
        "rate_active_sessions"
      )
    }
  }

  const idempotencyKey = makeIdempotencyKey(opts.idempotencySeed)
  const existing = await prisma.formDeliverySession.findUnique({
    where: { idempotencyKey },
  })
  if (existing) {
    // Cannot return original access token; require status with stored hash ownership check separately.
    throw new FormSessionError(
      "Сессия с этим upload_id уже существует. Используйте сохранённый accessToken.",
      409,
      "idempotent_exists"
    )
  }

  const accessToken = newAccessToken()
  const { ciphertext, iv } = encryptManifestJson(manifest)
  const totalTracks = countTracks(manifest)
  const totalBytes = sumFileBytes(manifest)

  const dbId = requireBuildinDatabaseId("submissions")
  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
        Название: titleProp(manifest.title),
        Тип: selectProp(manifest.formType),
        Статус: selectProp(labelFor(SUBMISSION_STATUS_LABELS, "uploading")),
        "ID заявки": textProp(idempotencyKey.slice(0, 16)),
        Email: emailProp(manifest.contactEmail ?? null),
        Telegram: textProp(manifest.contactTelegram || ""),
        Артист: textProp(manifest.artistNickname || ""),
        "Кол-во релизов": numberProp(manifest.releases.length),
        "Кол-во треков": numberProp(totalTracks),
        "Кол-во файлов": numberProp(manifest.files.length),
        Источник: selectProp("site"),
      },
    },
    `form-session:${idempotencyKey}`
  )

  const session = await prisma.formDeliverySession.create({
    data: {
      accessTokenHash: hashAccessToken(accessToken),
      idempotencyKey,
      formType: manifest.formType,
      status: "created",
      title: manifest.title,
      contactEmail: manifest.contactEmail ?? null,
      contactTelegram: manifest.contactTelegram ?? null,
      artistNickname: manifest.artistNickname ?? null,
      clientIp: opts.clientIp ?? null,
      buildinPageId: page.id,
      totalReleases: manifest.releases.length,
      totalTracks,
      totalFiles: manifest.files.length,
      totalBytes: BigInt(totalBytes),
      encryptedManifest: ciphertext as unknown as Uint8Array<ArrayBuffer>,
      manifestIv: iv as unknown as Uint8Array<ArrayBuffer>,
      expiresAt: daysFromNow(FORM_SESSION_TTL_ABANDONED_DAYS),
    },
  })

  await buildinUpdatePage(page.id, {
    properties: {
      "Session ID": textProp(session.id),
      "ID заявки": textProp(session.id),
    },
  }).catch(() => {})

  // Pre-create item rows
  const itemCreates: Array<{
    sessionId: string
    kind: string
    releaseIndex: number
    trackIndex: number | null
    localKey: string
    title: string
  }> = []
  for (let ri = 0; ri < manifest.releases.length; ri++) {
    const release = manifest.releases[ri]
    itemCreates.push({
      sessionId: session.id,
      kind: "release",
      releaseIndex: ri,
      trackIndex: null,
      localKey: `release:${ri}`,
      title: release.releaseTitle,
    })
    for (let ti = 0; ti < release.tracks.length; ti++) {
      itemCreates.push({
        sessionId: session.id,
        kind: "track",
        releaseIndex: ri,
        trackIndex: ti,
        localKey: `track:${ri}:${ti}`,
        title: release.tracks[ti].trackTitle,
      })
    }
  }
  if (itemCreates.length) {
    await prisma.formDeliveryItem.createMany({ data: itemCreates })
  }

  const fileCreates = manifest.files.map((f) => ({
    sessionId: session.id,
    fieldKey: f.fieldKey,
    filename: f.filename,
    contentType: f.contentType,
    sizeBytes: BigInt(f.sizeBytes),
    checksumSha256: f.checksumSha256 ?? null,
  }))
  if (fileCreates.length) {
    await prisma.formDeliveryFile.createMany({ data: fileCreates })
  }

  await enqueueBuildinOutbox({
    eventType: "form_session_materialize",
    entityKey: session.id,
    payload: { sessionId: session.id },
    delayMs: 0,
  })

  return {
    sessionId: session.id,
    accessToken,
    status: session.status,
    buildinPageId: page.id,
  }
}

async function requireOwnedSession(sessionId: string, accessToken: string) {
  const session = await prisma.formDeliverySession.findUnique({
    where: { id: sessionId },
  })
  if (!session) throw new FormSessionError("Сессия не найдена", 404, "not_found")
  if (session.accessTokenHash !== hashAccessToken(accessToken)) {
    throw new FormSessionError("Нет доступа к сессии", 403, "forbidden")
  }
  return session
}

function loadManifest(session: {
  encryptedManifest: Uint8Array | null
  manifestIv: Uint8Array | null
}): FormSessionManifest {
  if (!session.encryptedManifest || !session.manifestIv) {
    throw new FormSessionError("Manifest уже удалён или отсутствует", 409, "no_manifest")
  }
  return decryptManifestJson<FormSessionManifest>(
    new Uint8Array(session.encryptedManifest),
    new Uint8Array(session.manifestIv)
  )
}

export async function materializeFormSession(sessionId: string): Promise<{
  created: number
  remaining: number
}> {
  const session = await prisma.formDeliverySession.findUnique({
    where: { id: sessionId },
  })
  if (!session?.buildinPageId) {
    throw new FormSessionError("Сессия не готова", 404)
  }
  const manifest = loadManifest(session)
  await prisma.formDeliverySession.update({
    where: { id: sessionId },
    data: { status: "materializing" },
  })

  // Retry failed items too (e.g. after Buildin schema fixes); otherwise remaining
  // stucks forever because only "pending" was processed.
  const pending = await prisma.formDeliveryItem.findMany({
    where: { sessionId, status: { in: ["pending", "failed"] } },
    orderBy: [{ kind: "asc" }, { releaseIndex: "asc" }, { trackIndex: "asc" }],
    take: FORM_SESSION_MATERIALIZE_BATCH,
  })

  let created = 0
  const releaseDb = requireBuildinDatabaseId("submission_releases")
  const trackDb = requireBuildinDatabaseId("submission_tracks")

  for (const item of pending) {
    try {
      if (item.kind === "release") {
        const release = manifest.releases[item.releaseIndex]
        if (!release) throw new Error("release missing in manifest")
        const localId = `${sessionId}:release:${item.releaseIndex}`
        const existing = await getExternalId("submission_release", localId)
        let pageId = existing?.buildinPageId
        if (!pageId) {
          const page = await buildinCreatePage(
            {
              parent: { database_id: releaseDb },
              properties: {
                Название: titleProp(release.releaseTitle),
                "Session ID": textProp(sessionId),
                "Release Index": numberProp(item.releaseIndex),
                "Тип релиза": selectProp(release.releaseType || "1"),
                Артисты: textProp(release.artists || ""),
                UPC: textProp(release.upc || ""),
                Жанр: textProp(release.genre || ""),
                "Дата релиза": dateProp(
                  release.releaseDate && /^\d{4}-\d{2}-\d{2}/.test(release.releaseDate)
                    ? release.releaseDate.slice(0, 10)
                    : null
                ),
                "Кол-во треков": numberProp(release.tracks.length),
                ЗаявкаRel: relationProp([session.buildinPageId]),
              },
            },
            `submission:release:${sessionId}:${item.releaseIndex}`
          )
          pageId = page.id
          await upsertExternalId({
            entityType: "submission_release",
            localId,
            buildinPageId: page.id,
            buildinDbKey: "submission_releases",
          })
        }
        await prisma.formDeliveryItem.update({
          where: { id: item.id },
          data: { status: "created", buildinPageId: pageId },
        })
        created++
      } else if (item.kind === "track") {
        const release = manifest.releases[item.releaseIndex]
        const track = release?.tracks[item.trackIndex ?? -1]
        if (!track) throw new Error("track missing in manifest")
        const releaseItem = await prisma.formDeliveryItem.findUnique({
          where: {
            sessionId_localKey: {
              sessionId,
              localKey: `release:${item.releaseIndex}`,
            },
          },
        })
        if (!releaseItem?.buildinPageId) {
          // Wait for parent release page
          continue
        }
        const localId = `${sessionId}:track:${item.releaseIndex}:${item.trackIndex}`
        const existing = await getExternalId("submission_track", localId)
        let pageId = existing?.buildinPageId
        if (!pageId) {
          const page = await buildinCreatePage(
            {
              parent: { database_id: trackDb },
              properties: {
                Название: titleProp(track.trackTitle),
                "Session ID": textProp(sessionId),
                "Release Index": numberProp(item.releaseIndex),
                "Track Index": numberProp(item.trackIndex ?? 0),
                Артисты: textProp(track.artists || ""),
                ISRC: textProp(track.isrc || ""),
                Язык: textProp(track.language || ""),
                Explicit: checkboxProp(track.explicit === true),
                Focus: checkboxProp(track.focus === true),
                "Preview Start": textProp(track.previewStart || ""),
                "Music Author": textProp(track.musicAuthor || ""),
                "Words Author": textProp(track.wordsAuthor || ""),
                РелизЗаявкиRel: relationProp([releaseItem.buildinPageId]),
                ЗаявкаRel: relationProp([session.buildinPageId]),
              },
            },
            `submission:track:${sessionId}:${item.releaseIndex}:${item.trackIndex}`
          )
          pageId = page.id
          await upsertExternalId({
            entityType: "submission_track",
            localId,
            buildinPageId: page.id,
            buildinDbKey: "submission_tracks",
          })
        }
        await prisma.formDeliveryItem.update({
          where: { id: item.id },
          data: { status: "created", buildinPageId: pageId },
        })
        created++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.formDeliveryItem.update({
        where: { id: item.id },
        data: { status: "failed", lastError: message.slice(0, 2000) },
      })
    }
  }

  // Wire parentPageId for files once items exist
  for (const f of manifest.files) {
    let parentPageId = session.buildinPageId
    if (f.parentKind === "release" && f.releaseIndex != null) {
      const it = await prisma.formDeliveryItem.findUnique({
        where: {
          sessionId_localKey: { sessionId, localKey: `release:${f.releaseIndex}` },
        },
      })
      if (it?.buildinPageId) parentPageId = it.buildinPageId
    }
    if (f.parentKind === "track" && f.releaseIndex != null && f.trackIndex != null) {
      const it = await prisma.formDeliveryItem.findUnique({
        where: {
          sessionId_localKey: {
            sessionId,
            localKey: `track:${f.releaseIndex}:${f.trackIndex}`,
          },
        },
      })
      if (it?.buildinPageId) parentPageId = it.buildinPageId
    }
    await prisma.formDeliveryFile.updateMany({
      where: { sessionId, fieldKey: f.fieldKey, parentPageId: null },
      data: { parentPageId },
    })
  }

  const [remainingPending, remainingFailed] = await Promise.all([
    prisma.formDeliveryItem.count({
      where: { sessionId, status: "pending" },
    }),
    prisma.formDeliveryItem.count({
      where: { sessionId, status: "failed" },
    }),
  ])
  const remaining = remainingPending + remainingFailed
  if (remaining === 0) {
    await prisma.formDeliverySession.update({
      where: { id: sessionId },
      data: { status: "uploading", lastError: null },
    })
  } else if (remainingPending === 0 && remainingFailed > 0 && created === 0) {
    // All items failed again this batch — fail the session so IP slots free up.
    const sample = await prisma.formDeliveryItem.findFirst({
      where: { sessionId, status: "failed", lastError: { not: null } },
      select: { lastError: true },
    })
    await prisma.formDeliverySession.update({
      where: { id: sessionId },
      data: {
        status: "failed",
        lastError: (sample?.lastError || "Materialize failed").slice(0, 2000),
      },
    })
  } else {
    await enqueueBuildinOutbox({
      eventType: "form_session_materialize",
      entityKey: sessionId,
      payload: { sessionId },
      delayMs: 2_000,
    })
  }
  return { created, remaining }
}

export async function presignFormSessionFile(opts: {
  sessionId: string
  accessToken: string
  fieldKey: string
}) {
  const session = await requireOwnedSession(opts.sessionId, opts.accessToken)
  const file = await prisma.formDeliveryFile.findUnique({
    where: {
      sessionId_fieldKey: { sessionId: opts.sessionId, fieldKey: opts.fieldKey },
    },
  })
  if (!file) throw new FormSessionError("Файл не найден в сессии", 404)
  if (!file.parentPageId) {
    throw new FormSessionError(
      "Страница для файла ещё не создана. Подождите materialize.",
      409,
      "not_materialized"
    )
  }
  if (Number(file.sizeBytes) > 100 * 1024 * 1024) {
    throw new FormSessionError("Файл превышает лимит Buildin 100 МБ", 413)
  }

  const contentType = normalizeBuildinUploadContentType(
    file.contentType,
    file.filename
  )
  const upload = await buildinGetUploadUrl({
    filename: file.filename,
    content_type: contentType,
    content_length: Number(file.sizeBytes),
    parent: { page_id: file.parentPageId },
  })

  await prisma.formDeliveryFile.update({
    where: { id: file.id },
    data: { status: "presigned", parentPageId: file.parentPageId },
  })

  return {
    fieldKey: file.fieldKey,
    uploadUrl: upload.upload_url,
    method: upload.method || "PUT",
    headers: upload.headers || {},
    ossName: upload.oss_name,
    expiryTime: upload.expiry_time,
    contentType,
    sizeBytes: Number(file.sizeBytes),
    parentPageId: file.parentPageId,
  }
}

export async function completeFormSessionFile(opts: {
  sessionId: string
  accessToken: string
  fieldKey: string
  ossName: string
  sizeBytes?: number
}) {
  const session = await requireOwnedSession(opts.sessionId, opts.accessToken)
  const file = await prisma.formDeliveryFile.findUnique({
    where: {
      sessionId_fieldKey: { sessionId: opts.sessionId, fieldKey: opts.fieldKey },
    },
  })
  if (!file?.parentPageId) {
    throw new FormSessionError("Файл не готов к complete", 409)
  }
  if (opts.sizeBytes != null && BigInt(opts.sizeBytes) !== file.sizeBytes) {
    throw new FormSessionError("Размер файла не совпадает с manifest", 400)
  }
  if (file.buildinOssName === opts.ossName && file.status === "attached") {
    return { ok: true, already: true }
  }

  await buildinAppendBlockChildren(file.parentPageId, [
    {
      type: "file",
      file: {
        type: "file",
        file: {
          oss_name: opts.ossName,
          content_type: normalizeBuildinUploadContentType(
            file.contentType,
            file.filename
          ),
          size: Number(file.sizeBytes),
        },
        caption: richText(`${file.fieldKey}: ${file.filename}`),
      },
    },
  ])

  await prisma.formDeliveryFile.update({
    where: { id: file.id },
    data: {
      status: "attached",
      buildinOssName: opts.ossName,
    },
  })
  const completedFiles = await prisma.formDeliveryFile.count({
    where: { sessionId: session.id, status: "attached" },
  })
  await prisma.formDeliverySession.update({
    where: { id: session.id },
    data: { completedFiles },
  })
  return { ok: true, completedFiles }
}

export async function finalizeFormSession(opts: {
  sessionId: string
  accessToken: string
}) {
  const session = await requireOwnedSession(opts.sessionId, opts.accessToken)
  const pendingItems = await prisma.formDeliveryItem.count({
    where: { sessionId: session.id, status: { not: "created" } },
  })
  if (pendingItems > 0) {
    throw new FormSessionError(
      "Сначала дождитесь создания страниц релизов/треков",
      409,
      "materialize_incomplete"
    )
  }
  const missingFiles = await prisma.formDeliveryFile.count({
    where: { sessionId: session.id, status: { not: "attached" } },
  })
  if (missingFiles > 0) {
    throw new FormSessionError(
      `Не все файлы загружены (${missingFiles} осталось)`,
      409,
      "files_incomplete"
    )
  }

  await prisma.formDeliverySession.update({
    where: { id: session.id },
    data: { status: "finalizing" },
  })

  // Prefer inline finalize so the browser is not racing a slow outbox cron.
  try {
    await runFormSessionFinalize(session.id)
    return { accepted: true, status: "completed" as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await enqueueBuildinOutbox({
      eventType: "form_session_finalize",
      entityKey: session.id,
      payload: { sessionId: session.id },
      delayMs: 0,
    })
    await prisma.formDeliverySession.update({
      where: { id: session.id },
      data: {
        status: "finalizing",
        lastError: message.slice(0, 2000),
      },
    })
    return { accepted: true, status: "finalizing" as const }
  }
}

export async function runFormSessionFinalize(sessionId: string) {
  const session = await prisma.formDeliverySession.findUnique({
    where: { id: sessionId },
  })
  if (!session?.buildinPageId) throw new FormSessionError("Сессия не найдена", 404)

  const missingFiles = await prisma.formDeliveryFile.count({
    where: { sessionId, status: { not: "attached" } },
  })
  if (missingFiles > 0) {
    throw new FormSessionError(`Files incomplete: ${missingFiles}`, 409)
  }

  await buildinUpdatePage(session.buildinPageId, {
    properties: {
      Статус: selectProp(labelFor(SUBMISSION_STATUS_LABELS, "new")),
    },
  })

  await prisma.formDeliverySession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      encryptedManifest: null,
      manifestIv: null,
      expiresAt: daysFromNow(FORM_SESSION_TTL_COMPLETED_DAYS),
      lastError: null,
    },
  })
}

export async function getFormSessionStatus(opts: {
  sessionId: string
  accessToken: string
}) {
  const session = await requireOwnedSession(opts.sessionId, opts.accessToken)
  const [itemsCreated, itemsTotal, filesAttached, filesTotal] = await Promise.all([
    prisma.formDeliveryItem.count({
      where: { sessionId: session.id, status: "created" },
    }),
    prisma.formDeliveryItem.count({ where: { sessionId: session.id } }),
    prisma.formDeliveryFile.count({
      where: { sessionId: session.id, status: "attached" },
    }),
    prisma.formDeliveryFile.count({ where: { sessionId: session.id } }),
  ])
  const pendingFiles = await prisma.formDeliveryFile.findMany({
    where: { sessionId: session.id, status: { not: "attached" } },
    select: { fieldKey: true, filename: true, status: true, lastError: true },
    take: 50,
  })
  return {
    sessionId: session.id,
    status: session.status,
    buildinPageId: session.buildinPageId,
    totalReleases: session.totalReleases,
    totalTracks: session.totalTracks,
    itemsCreated,
    itemsTotal,
    filesAttached,
    filesTotal,
    pendingFiles,
    lastError: session.lastError,
  }
}

export async function cleanupExpiredFormSessions(): Promise<number> {
  const now = new Date()
  const res = await prisma.formDeliverySession.deleteMany({
    where: {
      OR: [
        { status: "completed", expiresAt: { lt: now } },
        {
          status: { in: ["failed", "abandoned", "created", "uploading"] },
          expiresAt: { lt: now },
        },
      ],
    },
  })
  return res.count
}

/** Simple Buildin-only contact/PII path without file session */
export async function createSimpleBuildinSubmission(opts: {
  formType: "contact" | "data_rf" | "data_not_rf"
  title: string
  contactEmail?: string | null
  contactTelegram?: string | null
  artistNickname?: string | null
  payload: Record<string, unknown>
  idempotencySeed: string
}) {
  const { recordAndDualWriteSubmission } = await import("@/lib/buildin/dual-write")
  // Force no Pyrus by caller setting PYRUS_WRITE_DISABLED; dual-write still creates Buildin page
  return recordAndDualWriteSubmission({
    formType: opts.formType,
    title: opts.title,
    payload: opts.payload,
    contactEmail: opts.contactEmail,
    contactTelegram: opts.contactTelegram,
    artistNickname: opts.artistNickname,
    pyrusTaskId: null,
    files: [],
    idempotencySeed: opts.idempotencySeed || randomUUID(),
  })
}
