import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NextRequest } from "next/server"
import { assertFormRequestOrigin } from "./form-origin"

describe("assertFormRequestOrigin", () => {
  it("allows missing origin (server tools)", () => {
    const req = new NextRequest("http://localhost:3000/api/forms/sessions", {
      method: "POST",
      headers: { host: "localhost:3000" },
    })
    assert.equal(assertFormRequestOrigin(req), null)
  })

  it("allows configured site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example"
    process.env.FORM_ALLOWED_ORIGINS = ""
    const req = new NextRequest("https://staging.example/api/forms/sessions", {
      method: "POST",
      headers: {
        origin: "https://staging.example",
        host: "staging.example",
        "x-forwarded-proto": "https",
      },
    })
    assert.equal(assertFormRequestOrigin(req), null)
  })

  it("rejects unknown origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example"
    process.env.FORM_ALLOWED_ORIGINS = "https://staging.example"
    const req = new NextRequest("https://staging.example/api/forms/sessions", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "staging.example",
        "x-forwarded-proto": "https",
      },
    })
    const res = assertFormRequestOrigin(req)
    assert.ok(res)
    assert.equal(res!.status, 403)
  })
})
