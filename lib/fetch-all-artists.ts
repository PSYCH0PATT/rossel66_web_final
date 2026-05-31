/**
 * Loads all artists from GET /api/artists (admin) including contract fields from Supabase.
 */
export async function fetchAllArtistsFromApi(): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const pageSize = 100
  for (;;) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/artists?${params.toString()}`)
    const data = await res.json()
    const chunk = data.artists ?? []
    all.push(...chunk)
    const total = typeof data.total === "number" ? data.total : chunk.length
    if (chunk.length < pageSize || page * pageSize >= total) break
    page += 1
    if (page > 500) break
  }
  return all
}
