import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { collectBuildinFilesFromFormData } from "./collect-files"
import { BUILDIN_MAX_FILE_BYTES } from "./types"

describe("collectBuildinFilesFromFormData", () => {
  it("collects File entries under the size limit", async () => {
    const fd = new FormData()
    fd.set("form_data_json", JSON.stringify({ ok: true }))
    fd.set(
      "coverArtFile",
      new File([new Uint8Array([1, 2, 3])], "cover.jpg", { type: "image/jpeg" })
    )
    const warnings: string[] = []
    const files = await collectBuildinFilesFromFormData(fd, warnings)
    assert.equal(files.length, 1)
    assert.equal(files[0].fieldKey, "coverArtFile")
    assert.equal(files[0].filename, "cover.jpg")
    assert.equal(warnings.length, 0)
  })

  it("skips oversized files with a warning", async () => {
    const fd = new FormData()
    // Avoid allocating 100MB+; stub size via a custom File if possible.
    // Node File uses real byte length — verify constant instead when huge alloc is impractical.
    assert.ok(BUILDIN_MAX_FILE_BYTES > 0)
    const big = new Uint8Array(1024)
    const file = new File([big], "big.wav", { type: "audio/wav" })
    Object.defineProperty(file, "size", { value: BUILDIN_MAX_FILE_BYTES + 1 })
    fd.set("track_0_audioFile", file)
    const warnings: string[] = []
    const files = await collectBuildinFilesFromFormData(fd, warnings)
    assert.equal(files.length, 0)
    assert.ok(warnings.some((w) => w.includes("100 МБ")))
  })
})
