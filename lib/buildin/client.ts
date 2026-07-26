import {
  getBuildinApiBaseUrl,
  getBuildinApiToken,
} from "@/lib/buildin/env"

export class BuildinApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message)
    this.name = "BuildinApiError"
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

/**
 * Low-level Buildin V2 REST client.
 * Auth: Authorization: Bearer <BUILDIN_API_TOKEN>
 */
export async function buildinFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = getBuildinApiToken()
  if (!token) {
    throw new BuildinApiError("BUILDIN_API_TOKEN is not configured", 401, null)
  }

  const base = getBuildinApiBaseUrl().replace(/\/$/, "")
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  if (options.idempotencyKey) {
    // HTTP headers must be ByteString (ASCII); Cyrillic local IDs need encoding.
    const raw = options.idempotencyKey.slice(0, 200)
    headers["Idempotency-Key"] = /^[\x20-\x7E]+$/.test(raw)
      ? raw
      : Buffer.from(raw, "utf8").toString("base64url").slice(0, 200)
  }

  const res = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    const msg =
      typeof parsed === "object" &&
      parsed &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `Buildin API ${res.status}`
    throw new BuildinApiError(msg, res.status, parsed)
  }

  return parsed as T
}

export async function buildinGetMe() {
  return buildinFetch<{
    object: string
    id: string
    name: string
    workspace_id: string
    workspace_name: string
  }>("/v2/users/me")
}

export async function buildinCreateDatabase(body: Record<string, unknown>) {
  return buildinFetch<{ object: string; id: string; url?: string }>(
    "/v2/databases",
    { method: "POST", body }
  )
}

export async function buildinCreatePage(body: Record<string, unknown>, idempotencyKey?: string) {
  return buildinFetch<{
    object: string
    id: string
    url?: string
    properties?: Record<string, unknown>
  }>("/v2/pages", { method: "POST", body, idempotencyKey })
}

export async function buildinUpdatePage(
  pageId: string,
  body: Record<string, unknown>
) {
  return buildinFetch(`/v2/pages/${pageId}`, { method: "PATCH", body })
}

export async function buildinQueryDatabase(
  databaseId: string,
  body: Record<string, unknown> = {}
) {
  return buildinFetch<{
    object: string
    results: Array<{ id: string; properties?: Record<string, unknown> }>
    has_more: boolean
    next_cursor: string | null
  }>(`/v2/databases/${databaseId}/query`, { method: "POST", body })
}

export async function buildinGetDatabase(databaseId: string) {
  return buildinFetch<{
    object: string
    id: string
    properties: Record<string, unknown>
    title?: Array<{ plain_text?: string }>
  }>(`/v2/databases/${databaseId}`)
}

export async function buildinMutateDatabase(
  databaseId: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
) {
  return buildinFetch(`/v2/databases/${databaseId}/mutate`, {
    method: "POST",
    body,
    idempotencyKey,
  })
}

export async function buildinAppendBlockChildren(
  blockId: string,
  children: unknown[]
) {
  return buildinFetch(`/v2/blocks/${blockId}/children`, {
    method: "PATCH",
    body: { children },
  })
}

export type BuildinUploadUrlResponse = {
  object: string
  id: string
  upload_url: string
  oss_name: string
  file_url?: string
  size: number
  expiry_time: string
  method: string
  headers: Record<string, string>
}

export async function buildinGetUploadUrl(body: {
  filename: string
  content_type: string
  content_length: number
  parent: { page_id: string; type?: "page_id" }
}): Promise<BuildinUploadUrlResponse> {
  return buildinFetch<BuildinUploadUrlResponse>("/v2/files/upload-url", {
    method: "POST",
    body: {
      ...body,
      parent: {
        type: "page_id",
        page_id: body.parent.page_id,
      },
    },
  })
}

/** MIME types accepted by Buildin /v2/files/upload-url (OpenAPI enum). */
const BUILDIN_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/json",
  "application/xml",
  "application/octet-stream",
])

/**
 * Map browser/OS MIME to a Buildin-whitelisted content_type.
 * Unknown types fall back to application/octet-stream (allowed).
 */
export function normalizeBuildinUploadContentType(
  contentType: string | null | undefined,
  filename?: string
): string {
  const raw = (contentType || "").split(";")[0].trim().toLowerCase()
  if (raw && BUILDIN_UPLOAD_MIME.has(raw)) return raw

  const name = (filename || "").toLowerCase()
  if (name.endsWith(".wav")) return "audio/wav"
  if (name.endsWith(".mp3")) return "audio/mpeg"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".gif")) return "image/gif"
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".txt") || name.endsWith(".lrc")) return "text/plain"
  if (name.endsWith(".zip")) return "application/zip"

  return "application/octet-stream"
}

/**
 * Upload file bytes to Buildin via presigned PUT.
 * content_length must match exact byte size.
 * Do not set Content-Length manually — let the HTTP client compute it (OpenAPI/MCP guidance).
 */
export async function buildinUploadFileToPage(opts: {
  pageId: string
  filename: string
  contentType: string
  bytes: ArrayBuffer | Buffer | Uint8Array
}): Promise<{ oss_name: string; file_url?: string; size: number }> {
  const buf =
    opts.bytes instanceof ArrayBuffer
      ? new Uint8Array(opts.bytes)
      : opts.bytes instanceof Buffer
        ? new Uint8Array(opts.bytes)
        : opts.bytes

  if (buf.byteLength > 100 * 1024 * 1024) {
    throw new BuildinApiError(
      `Файл ${opts.filename} превышает лимит Buildin 100 МБ (${buf.byteLength} байт)`,
      413,
      null
    )
  }

  const contentType = normalizeBuildinUploadContentType(
    opts.contentType,
    opts.filename
  )

  const upload = await buildinGetUploadUrl({
    filename: opts.filename,
    content_type: contentType,
    content_length: buf.byteLength,
    parent: { page_id: opts.pageId },
  })

  const putHeaders: Record<string, string> = { ...(upload.headers || {}) }
  // Let fetch set Content-Length from body; avoid mismatch.
  delete putHeaders["Content-Length"]
  delete putHeaders["content-length"]

  const putRes = await fetch(upload.upload_url, {
    method: upload.method || "PUT",
    headers: putHeaders,
    body: buf as unknown as BodyInit,
  })

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "")
    throw new BuildinApiError(
      `Buildin file PUT failed for ${opts.filename}: ${putRes.status}`,
      putRes.status,
      errText
    )
  }

  return {
    oss_name: upload.oss_name,
    file_url: upload.file_url,
    size: upload.size,
  }
}
