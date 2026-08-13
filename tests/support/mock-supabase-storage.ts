/**
 * Стаб Supabase Storage для тестов. Файлы держатся в памяти.
 *
 * Зачем: роуты отчётов кладут xlsx в Storage и читают обратно, а
 * process-python вообще не создаёт строку Report, если загрузка не удалась
 * (см. G5 в app/api/reports/process-python/route.ts). Без стаба сквозной тест
 * генератора невозможен, а с настоящим Supabase тесты писали бы в прод-бакет.
 *
 * Отдельно важно: lib/supabase.ts при пустых переменных окружения молча
 * подставляет ЗАХАРДКОЖЕННЫЙ прод-URL. Поэтому стенд обязан задавать
 * NEXT_PUBLIC_SUPABASE_URL — иначе тесты пойдут в живой проект.
 *
 * Покрывает ровно то, что зовёт supabase-js 2.x из наших роутов:
 *   GET  /storage/v1/bucket                 — listBuckets
 *   POST /storage/v1/bucket                 — createBucket
 *   POST|PUT /storage/v1/object/<bucket>/<path>   — upload
 *   GET  /storage/v1/object/<bucket>/<path>       — download
 *   DELETE /storage/v1/object/<bucket>            — remove (список в теле)
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "http"

export type MockStorage = {
  server: Server
  url: string
  /** Ключ — "<bucket>/<path>". */
  files: Map<string, Buffer>
  buckets: Set<string>
  close: () => Promise<void>
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(Buffer.from(c)))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function json(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { "content-type": "application/json" })
  res.end(body)
}

/** `port = 0` — свободный порт; иначе фиксированный (нужен статичному .env.e2e). */
export async function startMockSupabaseStorage(port = 0): Promise<MockStorage> {
  const files = new Map<string, Buffer>()
  const buckets = new Set<string>()

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const path = url.pathname
      const method = (req.method ?? "GET").toUpperCase()

      // Бакеты
      if (path === "/storage/v1/bucket") {
        if (method === "GET") {
          return json(
            res,
            200,
            [...buckets].map((name) => ({ id: name, name, public: false }))
          )
        }
        if (method === "POST") {
          const body = JSON.parse((await readBody(req)).toString() || "{}")
          const name = String(body.name ?? body.id ?? "")
          if (!name) return json(res, 400, { error: "name required" })
          buckets.add(name)
          return json(res, 200, { name })
        }
      }

      // Объекты: /storage/v1/object/<bucket>/<path...>
      const objectMatch = path.match(/^\/storage\/v1\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/)
      if (objectMatch) {
        const [, bucket, rawKey] = objectMatch
        const key = `${bucket}/${decodeURIComponent(rawKey)}`

        if (method === "POST" || method === "PUT") {
          const body = await readBody(req)
          // upsert:false на существующем ключе Supabase отвергает — воспроизводим.
          const upsert = String(req.headers["x-upsert"] ?? "").toLowerCase() === "true"
          if (files.has(key) && !upsert) {
            return json(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" })
          }
          buckets.add(bucket)
          files.set(key, body)
          return json(res, 200, { Key: key, Id: key })
        }

        if (method === "GET") {
          const file = files.get(key)
          if (!file) {
            return json(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" })
          }
          res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": String(file.length),
          })
          return res.end(file)
        }

        if (method === "DELETE") {
          files.delete(key)
          return json(res, 200, [{ name: rawKey }])
        }
      }

      // remove([...]) шлёт DELETE на /object/<bucket> со списком в теле
      const bucketDelete = path.match(/^\/storage\/v1\/object\/([^/]+)$/)
      if (bucketDelete && method === "DELETE") {
        const bucket = bucketDelete[1]
        const body = JSON.parse((await readBody(req)).toString() || "{}")
        const prefixes: string[] = Array.isArray(body.prefixes) ? body.prefixes : []
        const removed: { name: string }[] = []
        for (const prefix of prefixes) {
          if (files.delete(`${bucket}/${prefix}`)) removed.push({ name: prefix })
        }
        return json(res, 200, removed)
      }

      json(res, 404, { error: "mock-storage: не поддержан маршрут", path, method })
    } catch (error) {
      json(res, 500, { error: String(error) })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject)
      resolve()
    })
  })
  const address = server.address()
  const actualPort = typeof address === "object" && address ? address.port : port

  return {
    server,
    url: `http://127.0.0.1:${actualPort}`,
    files,
    buckets,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  }
}
