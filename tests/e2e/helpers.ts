import { randomBytes } from "crypto"
import path from "path"
import { formTypeToDatabaseKey, type BuildinDbKey } from "@/lib/buildin/env"
import { FORM_QUEUE_CONTRACTS, isFileFormType, type FileFormType } from "@/lib/buildin/form-contracts"

export function e2eRunId() {
  return (
    process.env.E2E_RUN_ID?.trim() ||
    `e2e-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`
  )
}

export const fixturesDir = path.join(process.cwd(), "tests/fixtures")

/** Verify is ON by default; only explicit `0`/`false`/`off` disables it. */
export function isE2eVerifyBuildinEnabled(): boolean {
  const v = (process.env.E2E_VERIFY_BUILDIN || "1").trim().toLowerCase()
  return v !== "0" && v !== "false" && v !== "off"
}

export async function drainOutbox(baseURL: string) {
  const secret = process.env.E2E_CRON_SECRET || process.env.CRON_SECRET
  if (!secret) {
    if (!isE2eVerifyBuildinEnabled()) return
    throw new Error(
      "drainOutbox requires E2E_CRON_SECRET or CRON_SECRET when E2E_VERIFY_BUILDIN is enabled"
    )
  }
  const url = new URL("/api/cron/buildin-outbox?limit=50", baseURL)
  let lastErr: Error | null = null
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      if (!res.ok && res.status !== 404) {
        lastErr = new Error(`drainOutbox HTTP ${res.status}`)
      } else {
        lastErr = null
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  if (lastErr && isE2eVerifyBuildinEnabled()) {
    throw lastErr
  }
}

const ENV_FOR_KEY: Record<string, string> = {
  submissions: "BUILDIN_DB_SUBMISSIONS",
  form_back_catalog: "BUILDIN_DB_FORM_BACK_CATALOG",
  form_release_upload: "BUILDIN_DB_FORM_RELEASE_UPLOAD",
  form_distribution: "BUILDIN_DB_FORM_DISTRIBUTION",
}

function requireBuildinEnv(formType?: string): {
  token: string
  db: string
  base: string
  envName: string
} {
  const token = process.env.BUILDIN_API_TOKEN?.trim()
  const dbKey = formType
    ? formTypeToDatabaseKey(formType)
    : ("submissions" as BuildinDbKey)
  const envName = ENV_FOR_KEY[dbKey] || "BUILDIN_DB_SUBMISSIONS"
  const db = process.env[envName]?.trim()
  const base =
    process.env.BUILDIN_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.buildin.ai"

  if (!token) {
    throw new Error(
      `E2E Buildin verify requires BUILDIN_API_TOKEN (missing; env ${envName})`
    )
  }
  if (!db) {
    throw new Error(`E2E Buildin verify requires ${envName}`)
  }

  return { token, db, base, envName }
}

type BlockNode = Record<string, unknown> & {
  id?: string
  has_children?: boolean
  type?: string
}

async function collectBlocksRecursive(
  base: string,
  token: string,
  blockId: string,
  depth = 0
): Promise<BlockNode[]> {
  if (depth > 8) return []
  const res = await fetch(`${base}/v2/blocks/${blockId}/children?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Buildin children failed: ${res.status}`)
  }
  const json = (await res.json()) as { results?: BlockNode[] }
  const out: BlockNode[] = []
  for (const block of json.results || []) {
    out.push(block)
    if (block.has_children && block.id) {
      out.push(...(await collectBlocksRecursive(base, token, block.id, depth + 1)))
    }
  }
  return out
}

function propText(
  p:
    | {
        title?: Array<{ plain_text?: string }>
        select?: { name?: string }
        rich_text?: Array<{ plain_text?: string }>
        number?: number | null
        email?: string | null
        date?: { start?: string | null } | null
        checkbox?: boolean
      }
    | undefined
): string {
  if (!p) return ""
  if (typeof p.checkbox === "boolean") return p.checkbox ? "true" : "false"
  return (
    p.rich_text?.map((t) => t.plain_text || "").join("") ||
    p.select?.name ||
    (p.number != null ? String(p.number) : "") ||
    p.title?.map((t) => t.plain_text || "").join("") ||
    p.email ||
    p.date?.start ||
    ""
  )
}

export async function assertLiveFormSchema(formType: FileFormType) {
  if (!isE2eVerifyBuildinEnabled()) return
  const { token, db, base, envName } = requireBuildinEnv(formType)
  const res = await fetch(`${base}/v2/databases/${db}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Buildin database ${envName} fetch failed: ${res.status}`)
  }
  const json = (await res.json()) as {
    properties?: Record<string, { name?: string }>
  }
  const names = new Set(
    Object.values(json.properties || {}).map((p) => p.name || "")
  )
  const contract = FORM_QUEUE_CONTRACTS[formType]
  for (const bad of contract.forbiddenColumns) {
    if (names.has(bad)) {
      throw new Error(
        `Live ${envName} still has forbidden column «${bad}» for ${formType}`
      )
    }
  }
  for (const col of contract.userColumns) {
    if (!names.has(col)) {
      throw new Error(
        `Live ${envName} missing expected column «${col}» for ${formType}`
      )
    }
  }
}

export type BuildinPageAssertResult = {
  pageId: string
  status: string
  properties: Record<string, string>
  fileBlockCount: number
}

export async function assertBuildinSubmissionExists(opts: {
  /** Matches title: «Артист» on file queues, «Название» on submissions inbox */
  titleNeedle: string
  formType?: string
  /** Optional: assert page children contain text (UPC, ISRC, promo…) */
  bodyNeedles?: string[]
  /** Optional: property rich_text / select / date / checkbox values */
  propertyNeedles?: Record<string, string>
  /** Columns that must be absent from the live schema */
  forbiddenPropertyNeedles?: string[]
  /** File queues only: require «Обработана» checkbox (default false) */
  expectProcessed?: boolean
  /** Submissions inbox only: optional status select check */
  expectStatus?: string | null
  /** Require at least N file-type blocks in the page tree */
  minFileBlocks?: number
}): Promise<BuildinPageAssertResult | null> {
  if (!isE2eVerifyBuildinEnabled()) return null
  const { token, db, base, envName } = requireBuildinEnv(opts.formType)
  const isFileQueue = Boolean(opts.formType && isFileFormType(opts.formType))
  const titleProperty = isFileQueue ? "Артист" : "Название"

  let page: {
    id?: string
    properties?: Record<
      string,
      {
        title?: Array<{ plain_text?: string }>
        select?: { name?: string }
        rich_text?: Array<{ plain_text?: string }>
        number?: number | null
        email?: string | null
        date?: { start?: string | null } | null
        checkbox?: boolean
      }
    >
  } | null = null

  const needBody = Boolean(opts.bodyNeedles?.length || opts.minFileBlocks)
  const expectProcessed = opts.expectProcessed ?? false

  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${base}/v2/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 50,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        filter: {
          property: titleProperty,
          title: { contains: opts.titleNeedle },
        },
      }),
    })
    if (!res.ok) throw new Error(`Buildin query failed: ${res.status}`)
    const json = (await res.json()) as {
      results?: typeof page[]
    }
    const hit = (json.results || []).find((p) => {
      const title =
        p?.properties?.[titleProperty]?.title
          ?.map((t) => t.plain_text || "")
          .join("") || ""
      return title.includes(opts.titleNeedle)
    })
    if (hit?.id) {
      page = hit
      if (!isFileQueue) {
        const status = hit.properties?.["Статус"]?.select?.name || ""
        if (status === "Загружается") {
          // keep polling
        } else if (
          opts.expectStatus != null &&
          status &&
          status !== opts.expectStatus
        ) {
          // keep polling
        } else if (needBody) {
          const blocks = await collectBlocksRecursive(base, token, hit.id)
          const blob = blocks.map((b) => JSON.stringify(b)).join("\n")
          const files = blocks.filter((b) => b.type === "file").length
          const bodyOk =
            !opts.bodyNeedles?.length ||
            opts.bodyNeedles.every((n) => blob.includes(n))
          const filesOk = !opts.minFileBlocks || files >= opts.minFileBlocks
          if (bodyOk && filesOk) break
        } else {
          break
        }
      } else if (needBody) {
        const blocks = await collectBlocksRecursive(base, token, hit.id)
        const blob = blocks.map((b) => JSON.stringify(b)).join("\n")
        const files = blocks.filter((b) => b.type === "file").length
        const bodyOk =
          !opts.bodyNeedles?.length ||
          opts.bodyNeedles.every((n) => blob.includes(n))
        const filesOk = !opts.minFileBlocks || files >= opts.minFileBlocks
        if (bodyOk && filesOk) break
      } else {
        break
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  if (!page?.id) {
    throw new Error(
      `Buildin submission not found in ${envName} for ${titleProperty} containing ${opts.titleNeedle}`
    )
  }

  const properties: Record<string, string> = {}
  for (const [key, val] of Object.entries(page.properties || {})) {
    properties[key] = propText(val)
  }

  let statusLabel = ""
  if (isFileQueue) {
    const processed = page.properties?.["Обработана"]?.checkbox === true
    if (processed !== expectProcessed) {
      throw new Error(
        `Buildin page ${page.id} Обработана=${processed}, expected ${expectProcessed}`
      )
    }
    statusLabel = processed ? "Обработана" : "Новая"
  } else {
    statusLabel = page.properties?.["Статус"]?.select?.name || ""
    if (opts.expectStatus != null && statusLabel !== opts.expectStatus) {
      throw new Error(
        `Buildin page ${page.id} status «${statusLabel}», expected «${opts.expectStatus}»`
      )
    }
  }

  if (opts.propertyNeedles) {
    for (const [prop, needle] of Object.entries(opts.propertyNeedles)) {
      const text = properties[prop] || ""
      if (!text.includes(needle)) {
        throw new Error(
          `Buildin page ${page.id} property «${prop}» missing «${needle}» (got «${text}»)`
        )
      }
    }
  }

  if (opts.forbiddenPropertyNeedles?.length) {
    const schemaRes = await fetch(`${base}/v2/databases/${db}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (schemaRes.ok) {
      const schemaJson = (await schemaRes.json()) as {
        properties?: Record<string, { name?: string }>
      }
      const names = new Set(
        Object.values(schemaJson.properties || {}).map((p) => p.name || "")
      )
      for (const bad of opts.forbiddenPropertyNeedles) {
        if (names.has(bad)) {
          throw new Error(
            `Buildin page ${page.id}: forbidden column «${bad}» still exists on ${envName}`
          )
        }
      }
    }
  }

  let fileBlockCount = 0
  if (opts.bodyNeedles?.length || opts.minFileBlocks) {
    const blocks = await collectBlocksRecursive(base, token, page.id)
    const blob = blocks.map((b) => JSON.stringify(b)).join("\n")
    fileBlockCount = blocks.filter((b) => b.type === "file").length
    for (const needle of opts.bodyNeedles || []) {
      if (!blob.includes(needle)) {
        throw new Error(
          `Buildin page ${page.id} missing expected content (recursive): ${needle}`
        )
      }
    }
    if (opts.minFileBlocks && fileBlockCount < opts.minFileBlocks) {
      throw new Error(
        `Buildin page ${page.id} has ${fileBlockCount} file blocks, expected ≥ ${opts.minFileBlocks}`
      )
    }
  }

  return {
    pageId: page.id,
    status: statusLabel,
    properties,
    fileBlockCount,
  }
}

/**
 * Poll session status until completed (file forms).
 * Prefer this over UI-only success when verifying delivery.
 */
export async function waitForSessionCompleted(
  baseURL: string,
  sessionId: string,
  accessToken: string,
  timeoutMs = 120_000
): Promise<{ status: string; buildinPageId?: string | null }> {
  const deadline = Date.now() + timeoutMs
  let last: { status: string; buildinPageId?: string | null } = {
    status: "unknown",
  }
  while (Date.now() < deadline) {
    const url = new URL(`/api/forms/sessions/${sessionId}`, baseURL)
    url.searchParams.set("accessToken", accessToken)
    const res = await fetch(url)
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string
        buildinPageId?: string | null
        lastError?: string
      }
      last = {
        status: json.status || "unknown",
        buildinPageId: json.buildinPageId,
      }
      if (json.status === "completed") return last
      if (json.status === "failed" || json.status === "abandoned") {
        throw new Error(
          json.lastError || `Session ${sessionId} ended as ${json.status}`
        )
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    `Session ${sessionId} did not reach completed (last=${last.status})`
  )
}
