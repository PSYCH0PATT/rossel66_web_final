/**
 * Loads all users from GET /api/users (paginated on the server) for legacy flows
 * that still need the full list (e.g. bulk checks).
 */
export async function fetchAllUsersFromApi(options?: {
  role?: "artist" | "admin"
}): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const pageSize = 100
  for (;;) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (options?.role) params.set("role", options.role)
    const res = await fetch(`/api/users?${params.toString()}`)
    const data = await res.json()
    const chunk = data.users ?? []
    all.push(...chunk)
    const total = typeof data.total === "number" ? data.total : chunk.length
    if (chunk.length < pageSize || page * pageSize >= total) break
    page += 1
    if (page > 500) break
  }
  return all
}
