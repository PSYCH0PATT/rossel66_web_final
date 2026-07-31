/**
 * In-memory Buildin V2 mock for integration tests.
 * Point BUILDIN_API_BASE_URL at this server.
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
}

export class MockBuildinServer {
  private server: Server | null = null
  private port = 0
  mode: MockMode = {}
  pages = new Map<string, PageRec>()
  databases = new Map<string, { id: string; title: string }>()
  uploads = new Map<string, { oss_name: string; size: number; expired?: boolean }>()
  requestLog: Array<{ method: string; path: string; status: number }> = []

  get baseUrl() {
    return `http://127.0.0.1:${this.port}`
  }

  seedDatabase(id: string, title: string) {
    this.databases.set(id, { id, title })
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

      if (path.startsWith("/v2/databases/") && method === "GET") {
        const id = path.split("/")[3]
        const db = this.databases.get(id)
        this.requestLog.push({ method, path, status: db ? 200 : 404 })
        if (!db) {
          this.json(res, 404, { message: "not found" })
          return
        }
        this.json(res, 200, {
          object: "database",
          id: db.id,
          title: [{ plain_text: db.title, type: "text", text: { content: db.title } }],
          properties: {},
        })
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
        }
        const id = randomUUID()
        const page: PageRec = {
          id,
          parent_database_id: body.parent?.database_id,
          properties: body.properties || {},
          children: [],
        }
        this.pages.set(id, page)
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, { object: "page", id, url: `https://buildin.ai/${id}` })
        return
      }

      if (path.startsWith("/v2/pages/") && method === "PATCH") {
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
        method === "PATCH"
      ) {
        const id = path.split("/")[3]
        const page = this.pages.get(id)
        if (!page) {
          this.requestLog.push({ method, path, status: 404 })
          this.json(res, 404, { message: "not found" })
          return
        }
        const body = (await this.readBody(req)) as { children?: unknown[] }
        page.children.push(...(body.children || []))
        this.requestLog.push({ method, path, status: 200 })
        this.json(res, 200, { object: "list", results: body.children || [] })
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
