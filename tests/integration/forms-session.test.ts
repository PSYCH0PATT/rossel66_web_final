/**
 * Integration: form delivery session against Postgres + mock Buildin.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *   TEST_DATABASE_URL=postgresql://rossel:rossel@127.0.0.1:54329/rossel_test pnpm test:db:migrate
 *   pnpm test:integration
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../support/env"
import { MockBuildinServer } from "../support/mock-buildin"
import { makeRunId, pollUntil } from "../support/run-id"

loadTestEnvFiles()
const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rossel:rossel@127.0.0.1:54329/rossel_test"
process.env.DATABASE_URL = TEST_DB
process.env.DIRECT_URL = TEST_DB
process.env.FORM_DELIVERY_ENCRYPTION_KEY =
  process.env.FORM_DELIVERY_ENCRYPTION_KEY || "integration-test-encryption-key"
process.env.BUILDIN_API_TOKEN = process.env.BUILDIN_API_TOKEN || "mock-token"
process.env.BUILDIN_DUAL_WRITE = "true"
process.env.PYRUS_WRITE_DISABLED = "true"
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
process.env.FORM_ALLOWED_ORIGINS = "http://localhost:3000"

const SUBMISSIONS_ID = "11111111-1111-4111-8111-111111111111"
const FORM_BACK_CATALOG_ID = "22222222-2222-4222-8222-222222222222"
const FORM_RELEASE_UPLOAD_ID = "33333333-3333-4333-8333-333333333333"
const FORM_DISTRIBUTION_ID = "44444444-4444-4444-8444-444444444444"
process.env.BUILDIN_DB_SUBMISSIONS = SUBMISSIONS_ID
process.env.BUILDIN_DB_FORM_BACK_CATALOG = FORM_BACK_CATALOG_ID
process.env.BUILDIN_DB_FORM_RELEASE_UPLOAD = FORM_RELEASE_UPLOAD_ID
process.env.BUILDIN_DB_FORM_DISTRIBUTION = FORM_DISTRIBUTION_ID
// Legacy keys unused by new materialize path
delete process.env.BUILDIN_DB_SUBMISSION_RELEASES
delete process.env.BUILDIN_DB_SUBMISSION_TRACKS

const mock = new MockBuildinServer()
let skipSuite = false

before(async () => {
  try {
    requireTestDatabaseUrl()
    // Probe DB connectivity before importing Prisma-backed modules
    const pg = await import("pg")
    const client = new pg.default.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    })
    await client.connect()
    await client.query("SELECT 1")
    await client.end()

    const base = await mock.start(0)
    process.env.BUILDIN_API_BASE_URL = base
    mock.seedDatabase(SUBMISSIONS_ID, "E2E Submissions")
    mock.seedDatabase(FORM_BACK_CATALOG_ID, "E2E Back Catalog")
    mock.seedDatabase(FORM_RELEASE_UPLOAD_ID, "E2E Release Upload")
    mock.seedDatabase(FORM_DISTRIBUTION_ID, "E2E Distribution")
  } catch (err) {
    if (process.env.CI === "true" || process.env.CI === "1") {
      throw err
    }
    skipSuite = true
    console.warn("Skipping integration suite:", err)
  }
})

after(async () => {
  await mock.stop().catch(() => {})
})

function tinyManifest(runId: string, fileCount = 1) {
  const files = Array.from({ length: fileCount }, (_, i) => ({
    fieldKey: i === 0 ? "release_0_coverArt" : `release_0_track_0_audioFile`,
    filename: i === 0 ? "cover.png" : "audio.wav",
    contentType: i === 0 ? "image/png" : "audio/wav",
    sizeBytes: 64,
    parentKind: i === 0 ? ("release" as const) : ("track" as const),
    releaseIndex: 0,
    trackIndex: i === 0 ? undefined : 0,
  }))
  // catalog needs cover + audio typically
  if (fileCount === 1) {
    files.push({
      fieldKey: "release_0_track_0_audioFile",
      filename: "audio.wav",
      contentType: "audio/wav",
      sizeBytes: 64,
      parentKind: "track",
      releaseIndex: 0,
      trackIndex: 0,
    })
  }
  return {
    formType: "catalog_upload" as const,
    title: `IT catalog ${runId}`,
    artistNickname: `IT Artist ${runId}`,
    payload: {},
    releases: [
      {
        releaseTitle: `Release ${runId}`,
        artists: "Artist",
        releaseType: "1",
        upc: "",
        genre: "Hip-Hop",
        releaseDate: "2026-08-01",
        tracks: [
          {
            trackTitle: "Track 1",
            artists: "Artist",
            isrc: "USRC17607839",
            language: "1",
            explicit: false,
            focus: true,
            previewStart: "00:10",
            musicAuthor: "Composer",
            wordsAuthor: "Lyricist",
          },
        ],
      },
    ],
    files,
  }
}

async function uploadAllFiles(
  sessionId: string,
  accessToken: string,
  files: Array<{ fieldKey: string; sizeBytes: number }>
) {
  const {
    presignFormSessionFile,
    completeFormSessionFile,
  } = await import("@/lib/buildin/form-session")

  for (const f of files) {
    const presign = await pollUntil(
      async () => {
        try {
          return await presignFormSessionFile({
            sessionId,
            accessToken,
            fieldKey: f.fieldKey,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes("ещё не создана") || msg.includes("not_materialized")) {
            return null
          }
          throw err
        }
      },
      { timeoutMs: 30_000, label: `presign ${f.fieldKey}` }
    )
    const put = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(f.sizeBytes).fill(1),
    })
    assert.equal(put.ok, true, `PUT ${f.fieldKey}`)
    await completeFormSessionFile({
      sessionId,
      accessToken,
      fieldKey: f.fieldKey,
      ossName: String(presign.ossName),
      sizeBytes: f.sizeBytes,
    })
  }
}

describe("forms session integration", { concurrency: false }, () => {
  it("full lifecycle create→materialize→upload→finalize clears manifest", async (t) => {
    if (skipSuite) return t.skip()
    const runId = makeRunId("it")
    const {
      createFormDeliverySession,
      materializeFormSession,
      finalizeFormSession,
      getFormSessionStatus,
      runFormSessionFinalize,
    } = await import("@/lib/buildin/form-session")
    const { prisma } = await import("@/lib/prisma")

    const created = await createFormDeliverySession({
      idempotencySeed: `upload-${runId}`,
      manifest: tinyManifest(runId),
      clientIp: "10.10.0.1",
    })
    assert.ok(created.sessionId)
    assert.ok(created.accessToken)
    assert.ok(created.buildinPageId)

    let remaining = 1
    for (let i = 0; i < 10 && remaining > 0; i++) {
      const mat = await materializeFormSession(created.sessionId)
      remaining = mat.remaining
    }
    assert.equal(remaining, 0)

    const statusMid = await getFormSessionStatus({
      sessionId: created.sessionId,
      accessToken: created.accessToken,
    })
    assert.ok(statusMid.itemsCreated >= 2)

    await uploadAllFiles(created.sessionId, created.accessToken, [
      { fieldKey: "release_0_coverArt", sizeBytes: 64 },
      { fieldKey: "release_0_track_0_audioFile", sizeBytes: 64 },
    ])

    const fin = await finalizeFormSession({
      sessionId: created.sessionId,
      accessToken: created.accessToken,
    })
    assert.equal(fin.accepted, true)

    await runFormSessionFinalize(created.sessionId)
    const done = await getFormSessionStatus({
      sessionId: created.sessionId,
      accessToken: created.accessToken,
    })
    assert.equal(done.status, "completed")

    const row = await prisma.formDeliverySession.findUnique({
      where: { id: created.sessionId },
    })
    assert.equal(row?.encryptedManifest, null)
    assert.equal(row?.manifestIv, null)

    const submissionPage = mock.pages.get(created.buildinPageId!)
    assert.ok(submissionPage)
    assert.equal(submissionPage.parent_database_id, FORM_BACK_CATALOG_ID)
    // Catalog must not invent Email/Telegram on the queue row
    assert.equal("Email" in (submissionPage.properties || {}), false)
    assert.equal("Telegram" in (submissionPage.properties || {}), false)
    assert.equal("UPC" in (submissionPage.properties || {}), false)
    assert.ok("Артист" in (submissionPage.properties || {}))
    assert.ok("Название релиза" in (submissionPage.properties || {}))
    assert.ok("Дата заявки" in (submissionPage.properties || {}))
    assert.ok("Обработана" in (submissionPage.properties || {}))
    assert.equal("Статус" in (submissionPage.properties || {}), false)
    assert.equal("Артисты" in (submissionPage.properties || {}), false)
    // One-page model: structure is blocks on the application page, not child DB rows
    assert.ok(submissionPage.children.length >= 1)
    assert.ok(mock.blocks.size >= 2)
    const orphanChildPages = [...mock.pages.values()].filter(
      (p) =>
        p.id !== created.buildinPageId &&
        (p.parent_database_id === FORM_BACK_CATALOG_ID ||
          p.parent_database_id === SUBMISSIONS_ID)
    )
    assert.equal(orphanChildPages.length, 0)
  })

  it("rejects duplicate uploadId with 409", async (t) => {
    if (skipSuite) return t.skip()
    const runId = makeRunId("dup")
    const { createFormDeliverySession, FormSessionError } = await import(
      "@/lib/buildin/form-session"
    )
    const seed = `upload-dup-${runId}`
    await createFormDeliverySession({
      idempotencySeed: seed,
      manifest: tinyManifest(runId),
      clientIp: "10.10.0.2",
    })
    await assert.rejects(
      () =>
        createFormDeliverySession({
          idempotencySeed: seed,
          manifest: tinyManifest(runId + "-2"),
          clientIp: "10.10.0.2",
        }),
      (err: unknown) =>
        err instanceof FormSessionError && err.httpStatus === 409
    )
  })

  it("rejects foreign access token", async (t) => {
    if (skipSuite) return t.skip()
    const runId = makeRunId("own")
    const { createFormDeliverySession, getFormSessionStatus, FormSessionError } =
      await import("@/lib/buildin/form-session")
    const created = await createFormDeliverySession({
      idempotencySeed: `upload-${runId}`,
      manifest: tinyManifest(runId),
      clientIp: "10.10.0.3",
    })
    await assert.rejects(
      () =>
        getFormSessionStatus({
          sessionId: created.sessionId,
          accessToken: "not-the-token",
        }),
      (err: unknown) =>
        err instanceof FormSessionError && err.httpStatus === 403
    )
  })

  it("rejects file larger than 100MB at schema layer", async (t) => {
    if (skipSuite) return t.skip()
    const { createFormDeliverySession, FormSessionError } = await import(
      "@/lib/buildin/form-session"
    )
    const runId = makeRunId("big")
    const manifest = tinyManifest(runId)
    manifest.files[0].sizeBytes = 100 * 1024 * 1024 + 1
    await assert.rejects(
      () =>
        createFormDeliverySession({
          idempotencySeed: `upload-${runId}`,
          manifest,
          clientIp: "10.10.0.4",
        }),
      (err: unknown) => err instanceof FormSessionError
    )
  })

  it("materializes 15 releases in batches", async (t) => {
    if (skipSuite) return t.skip()
    const runId = makeRunId("15r")
    const {
      createFormDeliverySession,
      materializeFormSession,
    } = await import("@/lib/buildin/form-session")

    const releases = Array.from({ length: 15 }, (_, i) => ({
      releaseTitle: `R${i}`,
      artists: "A",
      releaseType: "1",
      tracks: [{ trackTitle: `T${i}`, artists: "A", language: "1" }],
    }))
    const files = releases.flatMap((_, i) => [
      {
        fieldKey: `release_${i}_coverArt`,
        filename: `c${i}.png`,
        contentType: "image/png",
        sizeBytes: 32,
        parentKind: "release" as const,
        releaseIndex: i,
      },
      {
        fieldKey: `release_${i}_track_0_audioFile`,
        filename: `a${i}.wav`,
        contentType: "audio/wav",
        sizeBytes: 32,
        parentKind: "track" as const,
        releaseIndex: i,
        trackIndex: 0,
      },
    ])

    const created = await createFormDeliverySession({
      idempotencySeed: `upload-${runId}`,
      manifest: {
        formType: "catalog_upload",
        title: `15 releases ${runId}`,
        payload: {},
        releases,
        files,
      },
      clientIp: "10.0.0.2",
    })

    let remaining = 999
    let guard = 0
    while (remaining > 0 && guard++ < 40) {
      const mat = await materializeFormSession(created.sessionId)
      remaining = mat.remaining
    }
    assert.equal(remaining, 0)
    const page = mock.pages.get(created.buildinPageId!)
    assert.ok(page)
    assert.equal(page.parent_database_id, FORM_BACK_CATALOG_ID)
    // 15 release toggles (+ nested track file toggles)
    assert.ok(page.children.length >= 15)
  })

  it("blocks bad Origin on session create route", async (t) => {
    if (skipSuite) return t.skip()
    const { assertFormRequestOrigin } = await import("@/lib/buildin/form-origin")
    const req = new NextRequest("http://localhost:3000/api/forms/sessions", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "localhost:3000",
      },
    })
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    process.env.FORM_ALLOWED_ORIGINS = "http://localhost:3000"
    const blocked = assertFormRequestOrigin(req)
    assert.ok(blocked)
    assert.equal(blocked!.status, 403)
  })

  it("retries when mock returns 429 on create page", async (t) => {
    if (skipSuite) return t.skip()
    mock.mode = { failNextCreatePage: 1, statusOnFail: 429, retryAfterSec: 0 }
    const runId = makeRunId("429")
    const { createFormDeliverySession } = await import("@/lib/buildin/form-session")
    const created = await createFormDeliverySession({
      idempotencySeed: `upload-${runId}`,
      manifest: tinyManifest(runId),
      clientIp: "10.10.0.7",
    })
    assert.ok(created.buildinPageId)
    assert.equal(mock.mode.failNextCreatePage ?? 0, 0)
    mock.resetMode()
  })

  it("routes release_upload and distribution to dedicated queues", async (t) => {
    if (skipSuite) return t.skip()
    const { createFormDeliverySession } = await import(
      "@/lib/buildin/form-session"
    )
    const runRel = makeRunId("route-rel")
    const runDist = makeRunId("route-dist")

    const releaseManifest = {
      formType: "release_upload" as const,
      title: `IT release ${runRel}`,
      artistNickname: "Artist",
      payload: { submitToPromo: "2", videoSnippetNeeded: "2" },
      releases: [
        {
          releaseTitle: `IT release ${runRel}`,
          artists: "Artist",
          releaseType: "1",
          genre: "1",
          releaseDate: "2026-09-01",
          tracks: [{ trackTitle: "T1", artists: "Artist", language: "1" }],
        },
      ],
      files: [
        {
          fieldKey: "coverArt",
          filename: "c.png",
          contentType: "image/png",
          sizeBytes: 32,
          parentKind: "release" as const,
          releaseIndex: 0,
        },
      ],
    }
    const distManifest = {
      formType: "distribution" as const,
      title: `IT dist ${runDist}`,
      contact: "@it_vk",
      artistNickname: "Artist",
      payload: { submitToPromo: "1", artistInfo: "bio" },
      releases: [
        {
          releaseTitle: `IT dist ${runDist}`,
          artists: "Artist",
          releaseType: "1",
          genre: "1",
          releaseDate: "2026-09-01",
          tracks: [{ trackTitle: "T1", artists: "Artist", language: "1" }],
        },
      ],
      files: [
        {
          fieldKey: "coverArt",
          filename: "c.png",
          contentType: "image/png",
          sizeBytes: 32,
          parentKind: "release" as const,
          releaseIndex: 0,
        },
      ],
    }

    const rel = await createFormDeliverySession({
      idempotencySeed: `upload-${runRel}`,
      manifest: releaseManifest,
      clientIp: "10.0.0.10",
    })
    const dist = await createFormDeliverySession({
      idempotencySeed: `upload-${runDist}`,
      manifest: distManifest,
      clientIp: "10.0.0.11",
    })
    assert.equal(
      mock.pages.get(rel.buildinPageId!)?.parent_database_id,
      FORM_RELEASE_UPLOAD_ID
    )
    assert.equal(
      mock.pages.get(dist.buildinPageId!)?.parent_database_id,
      FORM_DISTRIBUTION_ID
    )
    // На строке очереди живут только четыре поля (артист, релиз, дата, обработана) —
    // см. applicationProperties и комментарий в buildFinalizeBlocks. Контакт, email
    // и телеграм строкой не передаются.
    const relProps = mock.pages.get(rel.buildinPageId!)?.properties || {}
    const distProps = mock.pages.get(dist.buildinPageId!)?.properties || {}
    assert.equal("Email" in relProps, false)
    assert.equal("Контакт" in distProps, false)
    assert.equal("Telegram" in distProps, false)

    // Но контакт не теряется: для дистрибуции он уходит блоками при финализации.
    const { buildFinalizeBlocks } = await import("@/lib/buildin/form-application-page")
    const blocks = JSON.stringify(buildFinalizeBlocks(distManifest as never))
    assert.ok(blocks.includes("Контакт"), "заголовок «Контакт» должен быть в блоках")
    assert.ok(blocks.includes("@it_vk"), "сам контакт должен доехать до Buildin")
  })

  it("cleanupExpiredFormSessions deletes expired rows", async (t) => {
    if (skipSuite) return t.skip()
    const { prisma } = await import("@/lib/prisma")
    const { cleanupExpiredFormSessions } = await import(
      "@/lib/buildin/form-session"
    )
    const id = randomUUID()
    await prisma.formDeliverySession.create({
      data: {
        id,
        accessTokenHash: "x".repeat(64),
        idempotencyKey: `expired-${id}`,
        formType: "contact",
        status: "completed",
        title: "expired",
        totalBytes: BigInt(0),
        expiresAt: new Date(Date.now() - 60_000),
        completedAt: new Date(Date.now() - 120_000),
      },
    })
    const n = await cleanupExpiredFormSessions()
    assert.ok(n >= 1)
    const gone = await prisma.formDeliverySession.findUnique({ where: { id } })
    assert.equal(gone, null)
  })
})
