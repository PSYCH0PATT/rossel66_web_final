import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron-auth"
import { getBuildinApiToken, getBuildinDatabaseId, isPyrusWriteDisabled } from "@/lib/buildin/env"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Read-only forms / Buildin health probe for production or staging.
 * Does not create submissions. Auth: CRON_SECRET Bearer.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const checks: Record<string, unknown> = {
    pyrusWriteDisabled: isPyrusWriteDisabled(),
    buildinTokenPresent: Boolean(getBuildinApiToken()),
    databases: {
      submissions: Boolean(getBuildinDatabaseId("submissions")),
      form_back_catalog: Boolean(getBuildinDatabaseId("form_back_catalog")),
      form_release_upload: Boolean(getBuildinDatabaseId("form_release_upload")),
      form_distribution: Boolean(getBuildinDatabaseId("form_distribution")),
      pii_rf: Boolean(getBuildinDatabaseId("pii_rf")),
      pii_not_rf: Boolean(getBuildinDatabaseId("pii_not_rf")),
    },
  }

  let buildinReachable: boolean | null = null
  let buildinError: string | null = null
  if (getBuildinApiToken()) {
    try {
      const { buildinGetMe } = await import("@/lib/buildin/client")
      await buildinGetMe()
      buildinReachable = true
    } catch (err) {
      buildinReachable = false
      buildinError = err instanceof Error ? err.message : String(err)
    }
  }

  const [outboxPending, outboxFailed, outboxDead, sessionsActive] =
    await Promise.all([
      prisma.buildinOutbox.count({ where: { status: "pending" } }),
      prisma.buildinOutbox.count({ where: { status: "failed" } }),
      prisma.buildinOutbox.count({ where: { status: "dead" } }),
      prisma.formDeliverySession.count({
        where: {
          status: {
            in: ["created", "materializing", "uploading", "finalizing"],
          },
        },
      }),
    ])

  checks.buildinReachable = buildinReachable
  if (buildinError) checks.buildinError = buildinError
  checks.outbox = { pending: outboxPending, failed: outboxFailed, dead: outboxDead }
  checks.activeDeliverySessions = sessionsActive

  const dbs = checks.databases as Record<string, boolean>
  const formQueuesOk =
    dbs.form_back_catalog &&
    dbs.form_release_upload &&
    dbs.form_distribution

  const ok =
    Boolean(getBuildinApiToken()) &&
    Boolean(getBuildinDatabaseId("submissions")) &&
    formQueuesOk &&
    buildinReachable === true &&
    isPyrusWriteDisabled()

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      ...checks,
      hints: ok
        ? []
        : [
            !isPyrusWriteDisabled()
              ? "Set PYRUS_WRITE_DISABLED=true for Buildin-only cutover"
              : null,
            !getBuildinApiToken() ? "Missing BUILDIN_API_TOKEN" : null,
            !getBuildinDatabaseId("submissions")
              ? "Missing BUILDIN_DB_SUBMISSIONS"
              : null,
            !dbs.form_back_catalog
              ? "Missing BUILDIN_DB_FORM_BACK_CATALOG"
              : null,
            !dbs.form_release_upload
              ? "Missing BUILDIN_DB_FORM_RELEASE_UPLOAD"
              : null,
            !dbs.form_distribution
              ? "Missing BUILDIN_DB_FORM_DISTRIBUTION"
              : null,
            buildinReachable === false ? "Buildin API unreachable" : null,
          ].filter(Boolean),
    },
    { status: ok ? 200 : 503 }
  )
}

export async function POST(request: NextRequest) {
  return GET(request)
}
