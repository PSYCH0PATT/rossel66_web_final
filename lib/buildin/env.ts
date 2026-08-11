/**
 * Buildin API env helpers (server-only).
 * Prefer BUILDIN_API_TOKEN; BUILDIN_TOKEN is the CLI/skill alias.
 * Never expose to client.
 */

export function getBuildinApiToken(): string | null {
  return (
    process.env.BUILDIN_API_TOKEN?.trim() ||
    process.env.BUILDIN_TOKEN?.trim() ||
    null
  )
}

export function getBuildinApiBaseUrl(): string {
  return (
    process.env.BUILDIN_API_BASE_URL?.trim() ||
    process.env.BUILDIN_BASE_URL?.trim() ||
    "https://api.buildin.ai"
  )
}

/** Feature flag: dual-write form submissions to Buildin */
export function isBuildinDualWriteEnabled(): boolean {
  const v = process.env.BUILDIN_DUAL_WRITE?.trim().toLowerCase()
  if (v === "0" || v === "false" || v === "off") return false
  // Default on when token is present
  return Boolean(getBuildinApiToken())
}

/** Feature flag: stop writing new tasks to Pyrus (Buildin-only) */
export function isPyrusWriteDisabled(): boolean {
  const v = process.env.PYRUS_WRITE_DISABLED?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "on"
}

/** Database IDs from env (created by scripts/setup-buildin-databases.ts) */
export type BuildinDbKey =
  | "submissions"
  | "form_back_catalog"
  | "form_release_upload"
  | "form_distribution"
  | "submission_releases"
  | "submission_tracks"
  | "artists"
  | "releases"
  | "tracks"
  | "reports"
  | "playlists"
  | "automation_runs"
  | "pii_rf"
  | "pii_not_rf"
  | "activity"
  | "playlist_history"

const ENV_BY_KEY: Record<BuildinDbKey, string> = {
  submissions: "BUILDIN_DB_SUBMISSIONS",
  form_back_catalog: "BUILDIN_DB_FORM_BACK_CATALOG",
  form_release_upload: "BUILDIN_DB_FORM_RELEASE_UPLOAD",
  form_distribution: "BUILDIN_DB_FORM_DISTRIBUTION",
  submission_releases: "BUILDIN_DB_SUBMISSION_RELEASES",
  submission_tracks: "BUILDIN_DB_SUBMISSION_TRACKS",
  artists: "BUILDIN_DB_ARTISTS",
  releases: "BUILDIN_DB_RELEASES",
  tracks: "BUILDIN_DB_TRACKS",
  reports: "BUILDIN_DB_REPORTS",
  playlists: "BUILDIN_DB_PLAYLISTS",
  automation_runs: "BUILDIN_DB_AUTOMATION_RUNS",
  pii_rf: "BUILDIN_DB_PII_RF",
  pii_not_rf: "BUILDIN_DB_PII_NOT_RF",
  activity: "BUILDIN_DB_ACTIVITY",
  playlist_history: "BUILDIN_DB_PLAYLIST_HISTORY",
}

/** All known Buildin DB env keys (for setup scripts). */
export const BUILDIN_DB_ENV_NAMES = ENV_BY_KEY

/** Route session formType → top-level Buildin queue database */
export function formTypeToDatabaseKey(
  formType: string
): Extract<
  BuildinDbKey,
  | "form_back_catalog"
  | "form_release_upload"
  | "form_distribution"
  | "submissions"
> {
  switch (formType) {
    case "catalog_upload":
      return "form_back_catalog"
    case "release_upload":
      return "form_release_upload"
    case "distribution":
      return "form_distribution"
    default:
      return "submissions"
  }
}

export function getBuildinDatabaseId(key: BuildinDbKey): string | null {
  const envName = ENV_BY_KEY[key]
  return process.env[envName]?.trim() || null
}

export function requireBuildinDatabaseId(key: BuildinDbKey): string {
  const id = getBuildinDatabaseId(key)
  if (!id) {
    throw new Error(`Missing Buildin database id env ${ENV_BY_KEY[key]}`)
  }
  return id
}
