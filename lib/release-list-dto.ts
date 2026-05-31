import type { Release as PrismaRelease } from "@prisma/client"
import type { Track } from "@/lib/storage"

/** Lightweight release row for list tables (no tracks/metadata payload). */
export type ReleaseListItem = {
  id: string
  title: string
  artistId: string
  releaseDate: string
  type?: string
  coverUrl?: string
  upc?: string
  status?: string
  featuredArtistIds: string[]
  featuredArtistNames: string[]
  trackCount: number
  /** First track ISRC for list tables */
  primaryIsrc?: string
  artistName?: string
}

export function releaseListItemFromPrisma(
  row: Pick<
    PrismaRelease,
    | "id"
    | "title"
    | "artistId"
    | "releaseDate"
    | "type"
    | "coverUrl"
    | "upc"
    | "status"
    | "featuredArtistIds"
    | "featuredArtistNames"
    | "tracks"
    | "metadata"
  >
): ReleaseListItem {
  const tracks = row.tracks as unknown as Track[]
  const metadata = row.metadata as Record<string, unknown> | null
  const trackList = Array.isArray(tracks) ? tracks : []

  return {
    id: row.id,
    title: row.title,
    artistId: row.artistId || "",
    releaseDate: row.releaseDate,
    type: row.type ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    upc: row.upc ?? undefined,
    status:
      row.status ??
      (typeof metadata?.status === "string" ? (metadata.status as string) : undefined),
    featuredArtistIds: row.featuredArtistIds,
    featuredArtistNames: row.featuredArtistNames,
    trackCount: trackList.length,
    primaryIsrc: trackList.find((t) => t.isrc)?.isrc,
  }
}
