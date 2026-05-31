import { parseReleaseDateToTimestamp } from "@/lib/release-date"

/** Normalized date for DB sort (releaseDateSort column). */
export function releaseDateToSortDate(releaseDate: string | null | undefined): Date | null {
  const ts = parseReleaseDateToTimestamp(releaseDate ?? "")
  if (!ts) return null
  return new Date(ts)
}
