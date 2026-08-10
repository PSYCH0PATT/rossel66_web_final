/**
 * In-memory Buildin V2 mock for integration tests.
 * Point BUILDIN_API_BASE_URL at this server.
 *
 * Fidelity notes vs real API:
 * - GET /v2/databases/:id returns seeded properties (not empty)
 * - POST /v2/pages ignores inline `children` (must PATCH …/children)
 * - Property writes validate known column names when schema was seeded
 * - Implements /query and /mutate
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "http"
import { randomUUID } from "crypto"

export type MockMode = {
  failNextCreatePage?: number
  failNextUploadUrl?: number
  statusOnFail?: number
  retryAfterSec?: number
  expireUploadUrls?: boolean
}

type PageRec = {
  id: string
  parent_database_id?: string
  properties: Record<string, unknown>
  children: unknown[]
  in_trash?: boolean
  created_time: string
}

type BlockRec = {
  id: string
  parent_id: string
  type: string
  raw: Record<string, unknown>
  children: unknown[]
  has_children: boolean
}

type DbRec = {
  id: string
  title: string
  properties: Record<string, { id: string; name: string; type: string }>
}

const PROP_SHAPES: Record<string, string[]> = {
  title: ["title"],
  rich_text: ["rich_text"],
  number: ["number"],
  select: ["select"],
  multi_select: ["multi_select"],
  date: ["date"],
  email: ["email"],
  url: ["url"],
  checkbox: ["checkbox"],
  files: ["files"],
  people: ["people"],
  relation: ["relation"],
}

export class MockBuildinServer {
  private server: Server | null = null
  private port = 0
  mode: MockMode = {}
  pages = new Map<string, PageRec>()
  blocks = new Map<string, BlockRec>()
  databases = new Map<string, DbRec>()
  uploads = new Map<string, { oss_name: string; size: number; expired?: boolean }>()
  requestLog: Array<{ method: string; path: string; status: number }> = []

  get baseUrl() {
    return `http://127.0.0.1:${this.port}`
  }

  seedDatabase(
    id: string,
    title: string,
    properties?: Record<string, { name?: string; type: string }>
  ) {
    const props: DbRec["properties"] = {}
    for (const [key, schema] of Object.entries(properties || {})) {
      props[key] = {
        id: randomUUID(),
        name: schema.name || key,
        type: schema.type,
      }
    }
    this.databases.set(id, { id, title, properties: props })
  }

  resetMode() {
    this.mode = {}
  }

  async start(preferredPort = 0): Promise<string> {
    this.server = createServer((req, res) => {
      void this.handle(req, res)
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject)
      this.server!.listen(preferredPort, "127.0.0.1", () => resolve())
    })
    const addr = this.server.address()
    if (!addr || typeof addr === "string") throw new Error("no listen address")
    this.port = addr.port
    return this.baseUrl
  }

  async stop() {
    if (!this.server) return
    await new Promise<void>((resolve) => this.server!.close(() => resolve()))
    this.server = null
  }

  private async readBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = []
    for await (const c of req) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)))
    }
    if (!chunks.length) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = Buffer.concat(chunks as any).toString("utf8")
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  private json(res: ServerResponse, status: number, body: unknown) {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...(this.mode.retryAfterSec && status === 429
        ? { "Retry-After": String(this.mode.retryAfterSec) }
        : {}),
    })
    res.end(payload)
  }

  private validateProperties(
    dbId: string | undefined,
    properties: Record<string, unknown> | undefined
  ): string | null {
    if (!properties || !dbId) return null
    const db = this.databases.get(dbId)
    if (!db || Object.keys(db.properties).length === 0) return null
    const byName = new Map(
      Object.values(db.properties).map((p) => [p.name, p] as const)
    )
    for (const [key, value] of Object.entries(properties)) {
      const meta = db.properties[key] || byName.get(key)
      if (!meta) {
        return `unknown property «${key}» on database ${dbId}`
      }
      if (value == null || typeof value !== "object") {
        return `property «${key}» must be an object`
      }
      const allowed = PROP_SHAPES[meta.type]
      if (!allowed) continue
      const keys = Object.keys(value as object)
      if (!keys.some((k) => allowed.includes(k))) {
        return `property «${key}» type ${meta.type} expects one of ${allowed.join(",")}`
      }
    }
    return null
  }

  private matchTitleFilter(
    page: PageRec,
    filter: { property?: string; title?: { contains?: string } } | undefined
  ): boolean {
    if (!filter?.title?.contains) return true
    const propName = filter.property || "Название"
    const prop = page.properties[propName] as
      | { title?: Array<{ plain_text?: string }> }
      | undefined
    const title =
      prop?.title?.map((t) => t.plain_text || "").join("") || ""
    return title.includes(filter.title.contains)
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || "/", this.baseUrl)
    const method = (req.method || "GET").toUpperCase()
    const path = url.pathname

    // Presigned PUT target
    if (path.startsWith("/mock-upload/")) {
      const oss = path.slice("/mock-upload/".length)
      const meta = this.uploads.get(oss)
      if (!meta || meta.expired) {
        this.requestLog.push({ method, path, status: 403 })
        res.writeHead(403)
        res.end("expired")
        return
      }
      const chunks: Buffer[] = []
      for await (const c of req) {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta.size = Buffer.concat(chunks as any).byteLength

      this.requestLog.push({ method, path, status: 200 })
      res.writeHead(200)
      res.end("ok")
      return
    }

    try {
      if (path === "/v2/users/me" && method === "GET") {
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "user",
          id: "mock-user",
          name: "Mock Bot",
          workspace_id: "mock-ws",
          workspace_name: "Mock Workspace",
        })
        return
      }

      if (path.match(/^\/v2\/databases\/[^/]+$/) && method === "GET") {
        const id = path.split("/")[3]
        const db = this.databases.get(id)
        this.requestLog.push({ method, path, status: db ? 200 : 404 })
        if (!db) {
          this.json(res, 404, { message: "not found" })
          return
        }
        const properties: Record<string, unknown> = {}
        for (const [key, p] of Object.entries(db.properties)) {
          properties[key] = {
            id: p.id,
            name: p.name,
            type: p.type,
            [p.type]: {},
          }
        }
        this.json(res, 200, {
          object: "database",
          id: db.id,
          title: [
            {
              plain_text: db.title,
              type: "text",
              text: { content: db.title },
            },
          ],
          properties,
        })
        return
      }

      if (path.match(/^\/v2\/databases\/[^/]+\/query$/) && method === "POST") {
        const id = path.split("/")[3]
        const db = this.databases.get(id)
        if (!db) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        const body = (await this.readBody(req)) as {
          filter?: { property?: string; title?: { contains?: string } }
          page_size?: number
        }
        const results = [...this.pages.values()]
          .filter(
            (p) =>
              p.parent_database_id === id &&
              !p.in_trash &&
              this.matchTitleFilter(p, body.filter)
          )
          .sort((a, b) => b.created_time.localeCompare(a.created_time))
          .slice(0, body.page_size || 50)
          .map((p) => ({
            object: "page",
            id: p.id,
            created_time: p.created_time,
            parent: { database_id: p.parent_database_id },
            properties: p.properties,
          }))
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "list",
          results,
          has_more: false,
          next_cursor: null,
        })
        return
      }

      if (path.match(/^\/v2\/databases\/[^/]+\/mutate$/) && method === "POST") {
        const id = path.split("/")[3]
        const db = this.databases.get(id)
        if (!db) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        const body = (await this.readBody(req)) as {
          properties?: Record<string, { name?: string; type?: string; id?: string } | null>
        }
        for (const [key, val] of Object.entries(body.properties || {})) {
          if (val == null) {
            delete db.properties[key]
            continue
          }
          db.properties[key] = {
            id: val.id || db.properties[key]?.id || randomUUID(),
            name: val.name || key,
            type: val.type || "rich_text",
          }
        }
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, { object: "database", id: db.id })
        return
      }

      if (path === "/v2/pages" && method === "POST") {
        if (this.mode.failNextCreatePage && this.mode.failNextCreatePage > 0) {
          this.mode.failNextCreatePage--
          const status = this.mode.statusOnFail || 500
          this.requestLog.push({ method, path, status })
          this.json(res, status, { message: "mock create fail" })
          return
        }
        const body = (await this.readBody(req)) as {
          parent?: { database_id?: string }
          properties?: Record<string, unknown>
          children?: unknown[]
        }
        const err = this.validateProperties(
          body.parent?.database_id,
          body.properties
        )
        if (err) {
          this.requestLog.push({ method, path, status: 400 })
          this.json(res, 400, { message: err })
          return
        }
        const id = randomUUID()
        // Real Buildin ignores inline children on page create (esp. toggles) —
        // clients must PATCH /v2/blocks/:id/children afterwards.
        const page: PageRec = {
          id,
          parent_database_id: body.parent?.database_id,
          properties: body.properties || {},
          children: [],
          created_time: new Date().toISOString(),
        }
        this.pages.set(id, page)
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "page",
          id,
          url: `https://buildin.ai/${id}`,
        })
        return
      }

      if (path.match(/^\/v2\/pages\/[^/]+$/) && method === "GET") {
        const id = path.split("/")[3]
        const page = this.pages.get(id)
        if (!page) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "page",
          id: page.id,
          properties: page.properties,
          parent: { database_id: page.parent_database_id },
        })
        return
      }

      if (path.match(/^\/v2\/pages\/[^/]+$/) && method === "PATCH") {
        const id = path.split("/")[3]
        const page = this.pages.get(id)
        if (!page) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        const body = (await this.readBody(req)) as {
          properties?: Record<string, unknown>
          in_trash?: boolean
        }
        if (body.properties) {
          const err = this.validateProperties(
            page.parent_database_id,
            body.properties
          )
          if (err) {
            this.requestLog.push({ method, path, status: 400 })
            this.json(res, 400, { message: err })
            return
          }
          page.properties = { ...page.properties, ...body.properties }
        }
        if (body.in_trash != null) page.in_trash = body.in_trash
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, { object: "page", id })
        return
      }

      if (
        (path.match(/^\/v2\/pages\/[^/]+\/children$/) ||
          path.match(/^\/v2\/blocks\/[^/]+\/children$/)) &&
        method === "GET"
      ) {
        const id = path.split("/")[3]
        const kids = [...this.blocks.values()].filter((b) => b.parent_id === id)
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "list",
          results: kids.map((b) => ({
            object: "block",
            id: b.id,
            type: b.type,
            has_children: b.has_children,
            ...b.raw,
          })),
          has_more: false,
        })
        return
      }

      if (
        (path.match(/^\/v2\/pages\/[^/]+\/children$/) ||
          path.match(/^\/v2\/blocks\/[^/]+\/children$/)) &&
        method === "PATCH"
      ) {
        const id = path.split("/")[3]
        const page = this.pages.get(id)
        const parentBlock = this.blocks.get(id)
        if (!page && !parentBlock) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        const body = (await this.readBody(req)) as { children?: unknown[] }
        const created = (body.children || []).map((raw) => {
          const child = raw as {
            type?: string
            children?: unknown[]
            [k: string]: unknown
          }
          const blockId = randomUUID()
          // Nested children on toggle create are ignored by real Buildin —
          // store type only; nested must be appended in a follow-up PATCH.
          const ignoredNested = Array.isArray(child.children)
          const rec: BlockRec = {
            id: blockId,
            parent_id: id,
            type: child.type || "paragraph",
            raw: { ...child, children: undefined },
            children: [],
            has_children: false,
          }
          void ignoredNested
          this.blocks.set(blockId, rec)
          return { object: "block", id: blockId, type: rec.type }
        })
        if (page) page.children.push(...(body.children || []))
        if (parentBlock) {
          parentBlock.children.push(...(body.children || []))
          parentBlock.has_children = true
        }
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, { object: "list", results: created })
        return
      }

      if (path === "/v2/files/upload-url" && method === "POST") {
        if (this.mode.failNextUploadUrl && this.mode.failNextUploadUrl > 0) {
          this.mode.failNextUploadUrl--
          const status = this.mode.statusOnFail || 500
          this.requestLog.push({ method, path, status })
          this.json(res, status, { message: "mock upload-url fail" })
          return
        }
        const body = (await this.readBody(req)) as {
          filename?: string
          content_length?: number
        }
        const oss = `mock-oss-${randomUUID()}`
        this.uploads.set(oss, {
          oss_name: oss,
          size: body.content_length || 0,
          expired: this.mode.expireUploadUrls === true,
        })
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, {
          object: "file_upload",
          id: randomUUID(),
          upload_url: `${this.baseUrl}/mock-upload/${oss}`,
          oss_name: oss,
          size: body.content_length || 0,
          expiry_time: new Date(Date.now() + 3600_000).toISOString(),
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
        })
        return
      }

      this.requestLog.push({ method, path, status: 404 })
      this.json(res, 404, { message: `mock unimplemented ${method} ${path}` })
    } catch (err) {
      this.requestLog.push({ method, path, status: 500 })
      this.json(res, 500, {
        message: err instanceof Error ? err.message : "mock error",
      })
    }
  }
}
