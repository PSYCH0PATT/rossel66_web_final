import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { backoffProbe } from "./outbox-test-helpers"

// Lightweight pure helpers tested without Prisma — reclaim/coalesce need DB.

describe("outbox backoff jitter shape", () => {
  it("grows with attempts and stays positive", () => {
    const a0 = backoffProbe(0)
    const a3 = backoffProbe(3)
    assert.ok(a0 >= 30_000)
    assert.ok(a3 > a0)
  })
})
