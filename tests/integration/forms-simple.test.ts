import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../support/env"
import { MockBuildinServer } from "../support/mock-buildin"
import { makeRunId } from "../support/run-id"

loadTestEnvFiles()
const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rossel:rossel@127.0.0.1:54329/rossel_test"
process.env.DATABASE_URL = TEST_DB
process.env.DIRECT_URL = TEST_DB
process.env.FORM_DELIVERY_ENCRYPTION_KEY =
  process.env.FORM_DELIVERY_ENCRYPTION_KEY || "integration-test-encryption-key"
process.env.BUILDIN_API_TOKEN = "mock-token"
process.env.BUILDIN_DUAL_WRITE = "true"
process.env.PYRUS_WRITE_DISABLED = "true"

const SUBMISSIONS_ID = "11111111-1111-4111-8111-111111111111"
const PII_RF_ID = "44444444-4444-4444-8444-444444444444"
const PII_NOT_RF_ID = "55555555-5555-4555-8555-555555555555"
process.env.BUILDIN_DB_SUBMISSIONS = SUBMISSIONS_ID
process.env.BUILDIN_DB_PII_RF = PII_RF_ID
process.env.BUILDIN_DB_PII_NOT_RF = PII_NOT_RF_ID
process.env.BUILDIN_DB_SUBMISSION_RELEASES =
  process.env.BUILDIN_DB_SUBMISSION_RELEASES ||
  "22222222-2222-4222-8222-222222222222"
process.env.BUILDIN_DB_SUBMISSION_TRACKS =
  process.env.BUILDIN_DB_SUBMISSION_TRACKS ||
  "33333333-3333-4333-8333-333333333333"

const mock = new MockBuildinServer()
let skipSuite = false

before(async () => {
  try {
    requireTestDatabaseUrl()
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
    mock.seedDatabase(PII_RF_ID, "E2E PII RF")
    mock.seedDatabase(PII_NOT_RF_ID, "E2E PII Not RF")
  } catch (err) {
    if (process.env.CI === "true" || process.env.CI === "1") {
      throw err
    }
    skipSuite = true
    console.warn("Skipping simple forms integration:", err)
  }
})

after(async () => {
  await mock.stop().catch(() => {})
})

describe("forms simple integration", { concurrency: false }, () => {
  it("contact writes Buildin submission without Pyrus", async (t) => {
    if (skipSuite) return t.skip()
    const runId = makeRunId("contact")
    const { createSimpleBuildinSubmission } = await import(
      "@/lib/buildin/form-session"
    )
    const { prisma } = await import("@/lib/prisma")

    const dual = await createSimpleBuildinSubmission({
      formType: "contact",
      title: `Contact ${runId}`,
      contactTelegram: `@c_${runId.slice(-6)}`,
      artistNickname: `Nick ${runId}`,
      payload: { about: "hello", runId },
      idempotencySeed: `contact-${runId}`,
    })

    assert.ok(dual.submissionId)
    const row = await prisma.formSubmission.findUnique({
      where: { id: dual.submissionId },
    })
    assert.ok(row)
    assert.equal(row?.formType, "contact")
    assert.equal(row?.pyrusTaskId, null)

    // Must have created a page in the submissions mock DB
    const pages = [...mock.pages.values()].filter(
      (p) => p.parent_database_id === SUBMISSIONS_ID
    )
    assert.ok(pages.length >= 1, "expected Buildin submission page")
    const hit = pages.find((p) => {
      const title = p.properties?.["Название"] as
        | { title?: Array<{ plain_text?: string }> }
        | undefined
      const text = title?.title?.map((t) => t.plain_text || "").join("") || ""
      return text.includes(`Contact ${runId}`)
    })
    assert.ok(hit, "Buildin page with contact title not found")
    assert.ok(row?.buildinPageId || hit.id)
  })
})

describe("forms PII redaction", () => {
  it("data_rf redacts passport from shared inbox page properties", async () => {
    const { redactSubmissionPayloadForSharedInbox } = await import(
      "@/lib/buildin/adapters/submissions"
    )
    const redacted = redactSubmissionPayloadForSharedInbox("data_rf", {
      nickname: "Test",
      passportSeriesNumber: "1234 567890",
      bankAccountNumber: "40817810000000000000",
      inn: "7707083893",
      email: "a@b.c",
    }) as Record<string, unknown>
    assert.equal(redacted.passportSeriesNumber, undefined)
    assert.equal(redacted.bankAccountNumber, undefined)
    assert.equal(redacted.piiStoredIn, "pii_rf")
    assert.equal(redacted.nickname, "Test")
  })
})
