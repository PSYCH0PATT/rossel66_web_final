import type { CatalogRelease, CatalogUploadGuids, PyrusTaskField, PyrusTableRow } from "./types"
import { CATALOG_RELEASE_FIELD_IDS } from "./field-map"
import type { CatalogTrack } from "./types"
import type { TracklistColIds } from "./field-map"

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function pushField(fields: PyrusTaskField[], id: number, value: unknown): void {
  if (!isNonEmpty(value)) return
  fields.push({ id, value })
}

function buildTrackCells(
  track: CatalogTrack,
  colIds: TracklistColIds,
  guids: { audioGuid: string | null; lyricsGuid: string | null },
  isAlbum: boolean
): PyrusTaskField[] {
  const cells: PyrusTaskField[] = []
  if (guids.audioGuid) cells.push({ id: colIds.audio, value: [guids.audioGuid] })
  if (isAlbum && colIds.trackName != null) {
    cells.push({ id: colIds.trackName, value: track.trackName })
  }
  if (isAlbum && colIds.mainArtists != null) {
    cells.push({ id: colIds.mainArtists, value: track.mainArtists })
  }
  if (isAlbum && colIds.isrc != null) {
    cells.push({ id: colIds.isrc, value: track.isrc })
  }
  if (!isAlbum) {
    // single ISRC is on release level, not in table
  }
  cells.push({ id: colIds.preview, value: track.previewStart })
  cells.push({ id: colIds.musicAuthor, value: track.musicAuthor })
  cells.push({ id: colIds.wordsAuthor, value: track.wordsAuthor })
  if (track.language && track.language !== "0") {
    cells.push({ id: colIds.language, value: { choice_id: parseInt(track.language, 10) } })
  }
  if (track.explicit) {
    cells.push({ id: colIds.explicit, value: "checked" })
  }
  if (isAlbum && track.isFocusTrack && colIds.focusTrack != null) {
    cells.push({ id: colIds.focusTrack, value: "checked" })
  }
  if (guids.lyricsGuid) {
    cells.push({ id: colIds.lyrics, value: [guids.lyricsGuid] })
  }
  return cells
}

export function buildCatalogTaskTitle(releases: CatalogRelease[]): string {
  if (releases.length === 0 || !releases[0].releaseTitle) {
    return "Заявка на перенос каталога"
  }
  let title = `Перенос каталога: ${releases[0].releaseTitle}`
  if (releases[0].artists) title += ` от ${releases[0].artists}`
  if (releases.length > 1) title += ` (и еще ${releases.length - 1})`
  return title
}

export function buildPyrusCatalogFields(
  releases: CatalogRelease[],
  guids: CatalogUploadGuids
): PyrusTaskField[] {
  const fields: PyrusTaskField[] = []

  for (let i = 0; i < releases.length; i++) {
    const release = releases[i]
    const slot = CATALOG_RELEASE_FIELD_IDS[i]
    const releaseGuids = guids.releases[i]
    if (!slot || !releaseGuids) continue

    pushField(fields, slot.type, {
      choice_id: parseInt(release.releaseType, 10),
    })

    if (release.releaseType === "1") {
      const s = slot.single
      pushField(fields, s.title, release.releaseTitle)
      pushField(fields, s.artists, release.artists)
      if (releaseGuids.coverGuid) {
        pushField(fields, s.cover, [{ guid: releaseGuids.coverGuid }])
      }
      pushField(fields, s.upc, release.upc)
      if (release.tracks[0]?.isrc) {
        pushField(fields, s.isrc, release.tracks[0].isrc)
      }
      pushField(fields, s.releaseDate, release.originalReleaseDate)
      pushField(fields, s.genre, release.genre)

      const track = release.tracks[0]
      const trackGuid = releaseGuids.trackGuids[0]
      if (track && trackGuid) {
        const cells = buildTrackCells(track, s.tracklistCols, trackGuid, false)
        const row: PyrusTableRow = { row_id: 1, cells }
        pushField(fields, s.tracklistTable, [row])
      }
    } else if (release.releaseType === "2") {
      const a = slot.album
      pushField(fields, a.title, release.releaseTitle)
      pushField(fields, a.artists, release.artists)
      if (releaseGuids.coverGuid) {
        pushField(fields, a.cover, [{ guid: releaseGuids.coverGuid }])
      }
      pushField(fields, a.upc, release.upc)
      pushField(fields, a.releaseDate, release.originalReleaseDate)
      pushField(fields, a.genre, release.genre)

      const rows: PyrusTableRow[] = []
      for (let j = 0; j < release.tracks.length; j++) {
        const track = release.tracks[j]
        const trackGuid = releaseGuids.trackGuids[j] ?? {
          audioGuid: null,
          lyricsGuid: null,
        }
        const cells = buildTrackCells(track, a.tracklistCols, trackGuid, true)
        rows.push({ row_id: j + 1, cells })
      }
      if (rows.length > 0) {
        pushField(fields, a.tracklistTable, rows)
      }
    }
  }

  return fields
}
