/**
 * Загружает все релизы артиста постранично (API макс. pageSize=100).
 */
export async function fetchAllReleasesForArtist(artistId: string): Promise<unknown[]> {
  const all: unknown[] = []
  let page = 1
  const pageSize = 100
  while (true) {
    const res = await fetch(
      `/api/releases?artistId=${encodeURIComponent(artistId)}&page=${page}&pageSize=${pageSize}`
    )
    const data = await res.json()
    if (!data?.success || !Array.isArray(data.releases)) break
    all.push(...data.releases)
    const total = typeof data.total === "number" ? data.total : all.length
    if (all.length >= total || data.releases.length < pageSize) break
    page += 1
    if (page > 200) break
  }
  return all
}
