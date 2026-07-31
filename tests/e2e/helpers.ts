import { randomBytes } from "crypto"
import path from "path"

export function e2eRunId() {
  return (
    process.env.E2E_RUN_ID?.trim() ||
    `e2e-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`
  )
}

export const fixturesDir = path.join(process.cwd(), "tests/fixtures")

export async function drainOutbox(baseURL: string) {
  const secret = process.env.E2E_CRON_SECRET || process.env.CRON_SECRET
  if (!secret) return
  const url = new URL("/api/cron/buildin-outbox?limit=50", baseURL)
  for (let i = 0; i < 5; i++) {
    await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    }).catch(() => {})
    await new Promise((r) => setTimeout(r, 800))
  }
}

export async function assertBuildinSubmissionExists(opts: {
  titleNeedle: string
  formType?: string
}) {
  // Optional live verification when E2E_VERIFY_BUILDIN=1 and token+DB set.
  if (process.env.E2E_VERIFY_BUILDIN !== "1") return
  const token = process.env.BUILDIN_API_TOKEN
  const db = process.env.BUILDIN_DB_SUBMISSIONS
  const base =
    process.env.BUILDIN_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.buildin.ai"
  if (!token || !db) return

  for (let attempt = 0; attempt < 12; attempt++) {
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
          property: "Название",
          title: { contains: opts.titleNeedle },
        },
      }),
    })
    if (!res.ok) throw new Error(`Buildin query failed: ${res.status}`)
    const json = (await res.json()) as {
      results?: Array<{
        properties?: Record<string, { title?: Array<{ plain_text?: string }> }>
      }>
    }
    const hit = (json.results || []).some((page) => {
      const title =
        page.properties?.["Название"]?.title
          ?.map((t) => t.plain_text || "")
          .join("") || ""
      return title.includes(opts.titleNeedle)
    })
    if (hit) return
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    `Buildin submission not found for title containing ${opts.titleNeedle}`
  )
}
