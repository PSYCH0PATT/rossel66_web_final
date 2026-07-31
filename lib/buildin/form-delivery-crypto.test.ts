import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  decryptManifestJson,
  encryptManifestJson,
} from "./form-delivery-crypto"

const ORIGINAL_KEY = process.env.FORM_DELIVERY_ENCRYPTION_KEY

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.FORM_DELIVERY_ENCRYPTION_KEY
  } else {
    process.env.FORM_DELIVERY_ENCRYPTION_KEY = ORIGINAL_KEY
  }
})

describe("form-delivery-crypto", () => {
  it("encrypt/decrypt roundtrip preserves manifest JSON", () => {
    process.env.FORM_DELIVERY_ENCRYPTION_KEY = "test-form-delivery-key"
    const manifest = {
      formType: "catalog_upload",
      title: "Roundtrip",
      releases: [{ releaseTitle: "A", tracks: [{ trackTitle: "T1" }] }],
      files: [],
    }

    const { ciphertext, iv } = encryptManifestJson(manifest)
    const decoded = decryptManifestJson<typeof manifest>(ciphertext, iv)

    assert.deepEqual(decoded, manifest)
  })
})
