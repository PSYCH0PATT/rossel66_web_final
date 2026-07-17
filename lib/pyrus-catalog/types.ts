export interface CatalogTrack {
  id: string
  trackName: string
  mainArtists: string
  isrc: string
  previewStart: string
  musicAuthor: string
  wordsAuthor: string
  language: string
  explicit: boolean
  isFocusTrack: boolean
}

export interface CatalogRelease {
  id: string
  releaseType: string
  releaseTitle: string
  artists: string
  upc: string
  originalReleaseDate: string
  genre: string
  tracks: CatalogTrack[]
}

export interface ReleaseFileGuids {
  coverGuid: string | null
  trackGuids: Array<{ audioGuid: string | null; lyricsGuid: string | null }>
}

export interface CatalogUploadGuids {
  releases: ReleaseFileGuids[]
}

export type PyrusFieldCell = { id: number; value: unknown }

export type PyrusTableRow = { row_id: number; cells: PyrusFieldCell[] }

export type PyrusTaskField = { id: number; value: unknown }
