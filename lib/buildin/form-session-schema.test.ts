import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formSessionManifestSchema } from "./form-session-schema"
import { FORM_SESSION_MAX_FILE_BYTES } from "./types"

function minimalRelease(index: number) {
  return {
    releaseTitle: `Release ${index}`,
    artists: "Artist",
    tracks: [{ trackTitle: `Track ${index}` }],
  }
}

function baseManifest(
  overrides: Partial<{
    formType: "catalog_upload" | "release_upload" | "distribution"
    releases: ReturnType<typeof minimalRelease>[]
    files: Array<{
      fieldKey: string
      filename: string
      contentType: string
      sizeBytes: number
      parentKind: "release" | "track" | "submission"
    }>
  }> = {}
) {
  return {
    formType: "catalog_upload" as const,
    title: "Test catalog",
    payload: {},
    releases: overrides.releases ?? [minimalRelease(0)],
    files: overrides.files ?? [],
  }
}

describe("formSessionManifestSchema", () => {
  it("rejects file larger than 100MB", () => {
    const result = formSessionManifestSchema.safeParse(
      baseManifest({
        files: [
          {
            fieldKey: "track_0_audio",
            filename: "big.wav",
            contentType: "audio/wav",
            sizeBytes: FORM_SESSION_MAX_FILE_BYTES + 1,
            parentKind: "track",
          },
        ],
      })
    )
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(
        result.error.issues.some((i) =>
          String(i.message).includes("100 МБ")
        )
      )
    }
  })

  it("rejects duplicate fieldKey", () => {
    const file = {
      fieldKey: "cover",
      filename: "a.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      parentKind: "submission" as const,
    }
    const result = formSessionManifestSchema.safeParse(
      baseManifest({ files: [file, { ...file, filename: "b.jpg" }] })
    )
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(
        result.error.issues.some((i) =>
          String(i.message).includes("fieldKey")
        )
      )
    }
  })

  it("accepts 7 releases", () => {
    const releases = Array.from({ length: 7 }, (_, i) => minimalRelease(i))
    const result = formSessionManifestSchema.safeParse(
      baseManifest({ releases })
    )
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.releases.length, 7)
    }
  })

  it("rejects empty releases for catalog_upload", () => {
    const result = formSessionManifestSchema.safeParse(
      baseManifest({ releases: [] })
    )
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(
        result.error.issues.some((i) =>
          String(i.message).includes("релиз")
        )
      )
    }
  })
})
