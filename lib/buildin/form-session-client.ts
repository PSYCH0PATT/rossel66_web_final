/**
 * Browser client for Buildin form delivery sessions.
 * Binaries go direct to Buildin/S3 via presigned PUT — never through Next.js heap.
 */
import {
  FORM_SESSION_CLIENT_PUT_CONCURRENCY,
  FORM_SESSION_MAX_FILE_BYTES,
} from "@/lib/buildin/types"

export type FormSessionFileInput = {
  fieldKey: string
  file: File
  parentKind: "release" | "track" | "submission"
  releaseIndex?: number
  trackIndex?: number
}

export type FormSessionManifestInput = {
  formType:
    | "catalog_upload"
    | "release_upload"
    | "distribution"
    | "data_rf"
    | "data_not_rf"
    | "contact"
  title: string
  contactEmail?: string | null
  contactTelegram?: string | null
  artistNickname?: string | null
  payload?: Record<string, unknown>
  releases: Array<{
    releaseTitle: string
    artists?: string
    releaseType?: string
    upc?: string
    genre?: string
    otherGenre?: string
    releaseDate?: string
    tracks: Array<{
      trackTitle: string
      artists?: string
      isrc?: string
      language?: string
      explicit?: boolean
      focus?: boolean
      lyrics?: string
      previewStart?: string
      musicAuthor?: string
      wordsAuthor?: string
    }>
  }>
  files: FormSessionFileInput[]
}

export type SessionProgress = {
  phase: "create" | "materialize" | "upload" | "finalize" | "done"
  percent: number
  message: string
  pendingFiles?: Array<{ fieldKey: string; filename: string; status: string }>
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function assertClientFileQuotas(files: FormSessionFileInput[]) {
  if (files.length > 500) {
    throw new Error("Слишком много файлов (макс. 500 на сессию)")
  }
  let total = 0
  for (const f of files) {
    if (f.file.size > FORM_SESSION_MAX_FILE_BYTES) {
      throw new Error(
        `Файл «${f.file.name}» превышает лимит Buildin ${formatMb(FORM_SESSION_MAX_FILE_BYTES)}`
      )
    }
    total += f.file.size
  }
  if (total > 30 * 1024 * 1024 * 1024) {
    throw new Error("Суммарный объём файлов превышает 30 ГБ")
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function submitFormSession(opts: {
  uploadId: string
  manifest: FormSessionManifestInput
  onProgress?: (p: SessionProgress) => void
}): Promise<{ sessionId: string; buildinPageId: string | null }> {
  const { uploadId, manifest, onProgress } = opts
  assertClientFileQuotas(manifest.files)

  onProgress?.({
    phase: "create",
    percent: 2,
    message: "Создание сессии доставки…",
  })

  const body = {
    uploadId,
    manifest: {
      formType: manifest.formType,
      title: manifest.title,
      contactEmail: manifest.contactEmail ?? null,
      contactTelegram: manifest.contactTelegram ?? null,
      artistNickname: manifest.artistNickname ?? null,
      payload: manifest.payload ?? {},
      releases: manifest.releases,
      files: manifest.files.map((f) => ({
        fieldKey: f.fieldKey,
        filename: f.file.name,
        contentType: f.file.type || "application/octet-stream",
        sizeBytes: f.file.size,
        parentKind: f.parentKind,
        releaseIndex: f.releaseIndex,
        trackIndex: f.trackIndex,
      })),
    },
  }

  const createRes = await fetch("/api/forms/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const createJson = await createRes.json().catch(() => ({}))
  if (!createRes.ok) {
    throw new Error(createJson.message || "Не удалось создать сессию")
  }
  const sessionId = String(createJson.sessionId)
  const accessToken = String(createJson.accessToken)

  try {
    sessionStorage.setItem(
      `form-session:${uploadId}`,
      JSON.stringify({ sessionId, accessToken })
    )
  } catch {
    /* ignore */
  }

  onProgress?.({
    phase: "materialize",
    percent: 8,
    message: "Подготовка страниц релизов и треков…",
  })

  // Wait until materialize created parent pages for files
  let materialized = false
  for (let attempt = 0; attempt < 90; attempt++) {
    const matRes = await fetch(`/api/forms/sessions/${sessionId}/materialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    })
    const matJson = await matRes.json().catch(() => ({}))
    if (matRes.status === 429) {
      throw new Error(
        matJson.message || "Слишком много запросов при подготовке сессии"
      )
    }
    if (!matRes.ok && matRes.status !== 409) {
      throw new Error(matJson.message || "Не удалось подготовить страницы Buildin")
    }
    if (matRes.ok && matJson.remaining === 0) {
      materialized = true
      break
    }
    const st = await fetch(
      `/api/forms/sessions/${sessionId}?accessToken=${encodeURIComponent(accessToken)}`
    )
    if (st.ok) {
      const status = await st.json()
      if (status.status === "failed" || status.status === "abandoned") {
        throw new Error(
          status.lastError || "Сессия загрузки завершилась с ошибкой"
        )
      }
      if (
        status.status === "uploading" ||
        (status.itemsTotal > 0 && status.itemsCreated === status.itemsTotal)
      ) {
        materialized = true
        break
      }
    }
    await sleep(1000 + Math.min(attempt * 200, 3000))
  }
  if (!materialized) {
    throw new Error("Таймаут подготовки страниц Buildin. Попробуйте снова.")
  }

  const files = manifest.files
  let done = 0
  onProgress?.({
    phase: "upload",
    percent: 15,
    message: `Загрузка файлов (0/${files.length})…`,
  })

  await mapPool(files, FORM_SESSION_CLIENT_PUT_CONCURRENCY, async (f) => {
    let lastErr: Error | null = null
    for (let tryN = 0; tryN < 4; tryN++) {
      try {
        const presignRes = await fetch(
          `/api/forms/sessions/${sessionId}/files/presign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, fieldKey: f.fieldKey }),
          }
        )
        const presign = await presignRes.json().catch(() => ({}))
        if (presignRes.status === 409 && presign.code === "not_materialized") {
          await sleep(1500)
          continue
        }
        if (!presignRes.ok) {
          throw new Error(presign.message || `Presign failed: ${f.fieldKey}`)
        }

        const putRes = await fetch(String(presign.uploadUrl), {
          method: "PUT",
          headers: {
            "Content-Type":
              f.file.type ||
              String(presign.contentType || "application/octet-stream"),
          },
          body: f.file,
        })
        if (!putRes.ok) {
          throw new Error(
            `Ошибка загрузки файла «${f.file.name}» (HTTP ${putRes.status})`
          )
        }

        const completeRes = await fetch(
          `/api/forms/sessions/${sessionId}/files/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken,
              fieldKey: f.fieldKey,
              ossName: presign.ossName || presign.oss_name,
              sizeBytes: f.file.size,
            }),
          }
        )
        const completeJson = await completeRes.json().catch(() => ({}))
        if (!completeRes.ok) {
          throw new Error(
            completeJson.message || `Complete failed: ${f.fieldKey}`
          )
        }

        done++
        const pct = 15 + Math.round((done / Math.max(files.length, 1)) * 70)
        onProgress?.({
          phase: "upload",
          percent: pct,
          message: `Загрузка файлов (${done}/${files.length})…`,
        })
        return
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err))
        await sleep(500 * (tryN + 1))
      }
    }
    throw lastErr || new Error(`Не удалось загрузить ${f.fieldKey}`)
  })

  onProgress?.({
    phase: "finalize",
    percent: 92,
    message: "Финализация заявки…",
  })

  const finRes = await fetch(`/api/forms/sessions/${sessionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  })
  const finJson = await finRes.json().catch(() => ({}))
  if (!finRes.ok) {
    throw new Error(finJson.message || "Ошибка финализации")
  }
  if (finJson.status === "completed") {
    onProgress?.({
      phase: "done",
      percent: 100,
      message: "Готово",
    })
    return {
      sessionId,
      buildinPageId: createJson.buildinPageId ?? null,
    }
  }

  // Poll until completed (outbox fallback) — do not fail-fast on transient states
  let failStreak = 0
  for (let i = 0; i < 90; i++) {
    const st = await fetch(
      `/api/forms/sessions/${sessionId}?accessToken=${encodeURIComponent(accessToken)}`
    )
    if (st.ok) {
      const status = await st.json()
      if (status.status === "completed") {
        onProgress?.({
          phase: "done",
          percent: 100,
          message: "Готово",
        })
        return {
          sessionId,
          buildinPageId: status.buildinPageId ?? createJson.buildinPageId,
        }
      }
      if (status.status === "failed") {
        failStreak++
        if (failStreak >= 5) {
          throw new Error(status.lastError || "Финализация не удалась")
        }
      } else {
        failStreak = 0
      }
      onProgress?.({
        phase: "finalize",
        percent: 94 + Math.min(i, 5),
        message: "Ожидание подтверждения Buildin…",
        pendingFiles: status.pendingFiles,
      })
    }
    await sleep(1500)
  }

  // Accepted into outbox — treat as success with resume possible
  onProgress?.({
    phase: "done",
    percent: 100,
    message: "Заявка принята в обработку",
  })
  return {
    sessionId,
    buildinPageId: createJson.buildinPageId ?? null,
  }
}
