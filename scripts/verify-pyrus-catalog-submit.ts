/**
 * Верификация payload каталога: dry-run (по умолчанию) или --live POST в Pyrus.
 * pnpm verify:pyrus-catalog
 * pnpm verify:pyrus-catalog --live
 */
import { buildPyrusCatalogFields, buildCatalogTaskTitle } from "../lib/pyrus-catalog/build-pyrus-payload"
import { PYRUS_CATALOG_FORM_ID } from "../lib/pyrus-catalog/field-map"
import type { CatalogRelease, CatalogUploadGuids } from "../lib/pyrus-catalog/types"
import { assertPyrusConfigured } from "../lib/pyrus-env"
import { getPyrusAccessToken } from "../lib/pyrus"

const fourthSingle: CatalogRelease = {
  id: "r4",
  releaseType: "1",
  releaseTitle: "Verify Test",
  artists: "Test Artist",
  upc: "",
  originalReleaseDate: "2020-05-15",
  genre: "Hip-hop",
  tracks: [
    {
      id: "t1",
      trackName: "",
      mainArtists: "",
      isrc: "XX-XXX-YY-99999",
      previewStart: "00:30",
      musicAuthor: "Music A",
      wordsAuthor: "Words A",
      language: "1",
      explicit: false,
      isFocusTrack: false,
    },
  ],
}

const guids: CatalogUploadGuids = {
  releases: [
    { coverGuid: null, trackGuids: [] },
    { coverGuid: null, trackGuids: [] },
    { coverGuid: null, trackGuids: [] },
    {
      coverGuid: "00000000-0000-0000-0000-000000000001",
      trackGuids: [{ audioGuid: "00000000-0000-0000-0000-000000000002", lyricsGuid: null }],
    },
  ],
}

function buildFourthSinglePayload() {
  const releases = [fourthSingle, fourthSingle, fourthSingle, fourthSingle]
  const fields = buildPyrusCatalogFields(releases, guids)
  return {
    form_id: PYRUS_CATALOG_FORM_ID,
    fields,
    text: buildCatalogTaskTitle(releases),
  }
}

async function main() {
  const live = process.argv.includes("--live")
  const payload = buildFourthSinglePayload()

  const genre245 = payload.fields.filter((f) => f.id === 245)
  const date175 = payload.fields.filter((f) => f.id === 175)

  console.log("Dry-run payload check:")
  console.log(" - genre fields (245):", genre245.length, genre245[0]?.value)
  console.log(" - date fields (175):", date175.length, date175[0]?.value)

  if (genre245.length !== 1 || genre245[0].value !== "Hip-hop") {
    console.error("FAIL: expected one genre field 245 with Hip-hop")
    process.exit(1)
  }
  if (date175.length !== 1 || date175[0].value !== "2020-05-15") {
    console.error("FAIL: expected one date field 175")
    process.exit(1)
  }

  if (!live) {
    console.log("OK (dry-run). Use --live to POST text-only task to Pyrus (без файлов).")
    return
  }

  const textOnlyFields = payload.fields.filter((f) => {
    if (f.id === 172 || f.id === 176) return false
    if (f.id === 64 || f.id === 97 || f.id === 114 || f.id === 227) return false
    return true
  })

  const livePayload = {
    ...payload,
    fields: textOnlyFields,
    text: "[VERIFY] " + payload.text,
  }

  const { apiKey } = assertPyrusConfigured()
  const token = await getPyrusAccessToken(apiKey)
  if (!token) {
    console.error("Auth failed")
    process.exit(1)
  }

  const res = await fetch("https://api.pyrus.com/v4/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(livePayload),
  })
  const data = await res.json()
  if (!res.ok || !data?.task?.id) {
    console.error("Live POST failed:", data)
    process.exit(1)
  }
  console.log("OK live task id:", data.task.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
