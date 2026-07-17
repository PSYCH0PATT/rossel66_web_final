/**
 * Маппинг полей формы Pyrus 2312633 «Бэк-каталог».
 * Верифицировано против lib/pyrus-catalog/form-2312633.snapshot.json (pnpm sync:pyrus-catalog).
 */
export const PYRUS_CATALOG_FORM_ID = 2312633

export interface TracklistColIds {
  audio: number
  preview: number
  musicAuthor: number
  wordsAuthor: number
  language: number
  explicit: number
  lyrics: number
  trackName?: number
  mainArtists?: number
  isrc?: number
  focusTrack?: number
}

export interface ReleaseBlockIds {
  title: number
  artists: number
  cover: number
  upc: number
  releaseDate: number
  genre: number
  tracklistTable: number
  tracklistCols: TracklistColIds
}

export interface SingleBlockIds extends ReleaseBlockIds {
  isrc: number
}

export interface ReleaseSlotIds {
  type: number
  single: SingleBlockIds
  album: ReleaseBlockIds
}

/** 5 слотов релизов — id из Pyrus API */
export const CATALOG_RELEASE_FIELD_IDS: ReleaseSlotIds[] = [
  {
    type: 45,
    single: {
      title: 57,
      artists: 58,
      cover: 59,
      upc: 60,
      isrc: 61,
      releaseDate: 62,
      genre: 63,
      tracklistTable: 64,
      tracklistCols: {
        audio: 65,
        preview: 235,
        musicAuthor: 67,
        wordsAuthor: 68,
        language: 69,
        explicit: 122,
        lyrics: 70,
      },
    },
    album: {
      title: 55,
      artists: 71,
      cover: 72,
      upc: 73,
      releaseDate: 74,
      genre: 75,
      tracklistTable: 76,
      tracklistCols: {
        audio: 77,
        trackName: 78,
        mainArtists: 80,
        isrc: 79,
        preview: 236,
        musicAuthor: 82,
        wordsAuthor: 83,
        language: 84,
        explicit: 126,
        focusTrack: 86,
        lyrics: 87,
      },
    },
  },
  {
    type: 88,
    single: {
      title: 90,
      artists: 91,
      cover: 92,
      upc: 93,
      isrc: 94,
      releaseDate: 95,
      genre: 96,
      tracklistTable: 97,
      tracklistCols: {
        audio: 98,
        preview: 237,
        musicAuthor: 100,
        wordsAuthor: 101,
        language: 102,
        explicit: 123,
        lyrics: 103,
      },
    },
    album: {
      title: 127,
      artists: 128,
      cover: 129,
      upc: 130,
      releaseDate: 131,
      genre: 132,
      tracklistTable: 133,
      tracklistCols: {
        audio: 134,
        trackName: 135,
        mainArtists: 136,
        isrc: 137,
        preview: 238,
        musicAuthor: 139,
        wordsAuthor: 140,
        language: 141,
        explicit: 142,
        focusTrack: 143,
        lyrics: 144,
      },
    },
  },
  {
    type: 105,
    single: {
      title: 107,
      artists: 108,
      cover: 109,
      upc: 110,
      isrc: 111,
      releaseDate: 112,
      genre: 113,
      tracklistTable: 114,
      tracklistCols: {
        audio: 115,
        preview: 239,
        musicAuthor: 117,
        wordsAuthor: 118,
        language: 124,
        explicit: 125,
        lyrics: 120,
      },
    },
    album: {
      title: 145,
      artists: 146,
      cover: 147,
      upc: 148,
      releaseDate: 149,
      genre: 150,
      tracklistTable: 151,
      tracklistCols: {
        audio: 152,
        trackName: 153,
        mainArtists: 154,
        isrc: 155,
        preview: 240,
        musicAuthor: 157,
        wordsAuthor: 158,
        language: 159,
        explicit: 160,
        focusTrack: 161,
        lyrics: 162,
      },
    },
  },
  {
    type: 164,
    single: {
      title: 170,
      artists: 171,
      cover: 172,
      upc: 173,
      isrc: 174,
      releaseDate: 175,
      genre: 245,
      tracklistTable: 176,
      tracklistCols: {
        audio: 177,
        preview: 241,
        musicAuthor: 180,
        wordsAuthor: 181,
        language: 179,
        explicit: 182,
        lyrics: 183,
      },
    },
    album: {
      title: 184,
      artists: 185,
      cover: 186,
      upc: 187,
      releaseDate: 188,
      genre: 189,
      tracklistTable: 190,
      tracklistCols: {
        audio: 191,
        trackName: 192,
        mainArtists: 193,
        isrc: 194,
        preview: 242,
        musicAuthor: 196,
        wordsAuthor: 197,
        language: 198,
        explicit: 199,
        focusTrack: 200,
        lyrics: 201,
      },
    },
  },
  {
    type: 165,
    single: {
      title: 220,
      artists: 221,
      cover: 222,
      upc: 223,
      isrc: 224,
      releaseDate: 225,
      genre: 226,
      tracklistTable: 227,
      tracklistCols: {
        audio: 228,
        preview: 243,
        musicAuthor: 230,
        wordsAuthor: 231,
        language: 232,
        explicit: 233,
        lyrics: 234,
      },
    },
    album: {
      title: 202,
      artists: 203,
      cover: 204,
      upc: 205,
      releaseDate: 206,
      genre: 207,
      tracklistTable: 208,
      tracklistCols: {
        audio: 209,
        trackName: 210,
        mainArtists: 211,
        isrc: 212,
        preview: 244,
        musicAuthor: 214,
        wordsAuthor: 215,
        language: 216,
        explicit: 217,
        focusTrack: 218,
        lyrics: 219,
      },
    },
  },
]

export const CATALOG_MAX_RELEASES = CATALOG_RELEASE_FIELD_IDS.length

/** Имена полей для сообщений об ошибках (id → label) */
export const catalogFieldIdToName: Record<number, string> = {
  45: "Тип 1-го релиза",
  88: "Тип 2-го релиза",
  105: "Тип 3-го релиза",
  164: "Тип 4-го релиза",
  165: "Тип 5-го релиза",
  62: "Оригинальная дата релиза (1)",
  95: "Оригинальная дата релиза (2)",
  112: "Оригинальная дата релиза (3)",
  175: "Оригинальная дата релиза (4)",
  225: "Оригинальная дата релиза (5)",
  63: "Жанр (1)",
  96: "Жанр (2)",
  113: "Жанр (3)",
  245: "Жанр (4)",
  226: "Жанр (5)",
}

export function getCatalogFieldName(fieldId: number): string {
  return catalogFieldIdToName[fieldId] ?? `поле ${fieldId}`
}

export function collectDuplicateFieldIdsInSlot(slot: ReleaseSlotIds): number[] {
  const ids: number[] = []
  const pushIds = (block: ReleaseBlockIds | SingleBlockIds) => {
    ids.push(
      block.title,
      block.artists,
      block.cover,
      block.upc,
      block.releaseDate,
      block.genre,
      block.tracklistTable
    )
    if ("isrc" in block) ids.push(block.isrc)
    const c = block.tracklistCols
    ids.push(
      c.audio,
      c.preview,
      c.musicAuthor,
      c.wordsAuthor,
      c.language,
      c.explicit,
      c.lyrics,
      ...(c.trackName != null ? [c.trackName] : []),
      ...(c.mainArtists != null ? [c.mainArtists] : []),
      ...(c.isrc != null ? [c.isrc] : []),
      ...(c.focusTrack != null ? [c.focusTrack] : [])
    )
  }
  pushIds(slot.single)
  pushIds(slot.album)
  const seen = new Set<number>()
  const dupes: number[] = []
  for (const id of ids) {
    if (seen.has(id)) dupes.push(id)
    seen.add(id)
  }
  return dupes
}
