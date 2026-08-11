"use client"

import useSWR, { mutate as globalMutate } from "swr"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json.error || "Request failed")
  }
  return json
}

/** In-memory only (no localStorage). Revalidates on mount so deploy/DB changes are visible. */
const swrFreshOpts = {
  revalidateOnFocus: true,
  revalidateOnMount: true,
  dedupingInterval: 2_000,
  keepPreviousData: false,
} as const

/** SWR for paginated releases list. */
export function useReleasesList(url: string | null) {
  return useSWR(url, fetcher, swrFreshOpts)
}

/** Invalidate all cached `/api/releases` lists after mutations. */
export function revalidateReleasesLists(): void {
  void globalMutate(
    (key) => typeof key === "string" && key.includes("/api/releases"),
    undefined,
    { revalidate: true }
  )
}

export function revalidateStreamAnalytics(): void {
  void globalMutate(
    (key) => typeof key === "string" && key.includes("/api/analytics/streams"),
    undefined,
    { revalidate: true }
  )
}
