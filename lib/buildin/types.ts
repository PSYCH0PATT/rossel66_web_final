/** Max single-file upload to Buildin (API enforces 100 MB). */
export const BUILDIN_MAX_FILE_BYTES = 100 * 1024 * 1024

export type FormType =
  | "release_upload"
  | "catalog_upload"
  | "distribution"
  | "data_rf"
  | "data_not_rf"
  | "contact"

export type SubmissionStatus =
  | "pending"
  | "dual_writing"
  | "completed"
  | "partial"
  | "failed"

export type OutboxEventType =
  | "create_submission"
  | "form_session_materialize"
  | "form_session_finalize"
  | "sync_artist"
  | "sync_release"
  | "sync_track"
  | "sync_report"
  | "sync_playlist"
  | "sync_activity"
  | "sync_parser"
  | "sync_playlist_history"
  | "archive_artist"
  | "archive_release"
  | "archive_report"
  | "archive_playlist"
  | "archive_track"

/** Resource quotas for Buildin form delivery sessions */
export const FORM_SESSION_MAX_FILE_BYTES = BUILDIN_MAX_FILE_BYTES
export const FORM_SESSION_MAX_FILES = 500
export const FORM_SESSION_MAX_TOTAL_BYTES = 30 * 1024 * 1024 * 1024
export const FORM_SESSION_MAX_MANIFEST_BYTES = 5 * 1024 * 1024
export const FORM_SESSION_MATERIALIZE_BATCH = 25
export const FORM_SESSION_CLIENT_PUT_CONCURRENCY = 3
export const FORM_SESSION_ACTIVE_PER_IP = Math.max(
  1,
  Number(process.env.FORM_SESSION_ACTIVE_PER_IP || 5) || 5
)
export const FORM_SESSION_TTL_COMPLETED_DAYS = 7
export const FORM_SESSION_TTL_ABANDONED_DAYS = 30


export type FileMeta = {
  fieldKey: string
  filename: string
  contentType: string
  size: number
  /** Pyrus file guid if uploaded */
  pyrusGuid?: string | null
  /** Buildin oss_name after upload */
  buildinOssName?: string | null
  /** Buildin CDN / file_url if available */
  buildinFileUrl?: string | null
  /** Supabase Storage path for outbox retry replay */
  stagingPath?: string | null
}

export type RichTextItem = {
  type: "text"
  text: { content: string; link: null }
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
  plain_text: string
  href: null
}

export function richText(content: string): RichTextItem[] {
  const safe = content.slice(0, 2000)
  return [
    {
      type: "text",
      text: { content: safe, link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
      plain_text: safe,
      href: null,
    },
  ]
}

export function titleProp(content: string) {
  return { type: "title" as const, title: richText(content) }
}

export function textProp(content: string) {
  return { type: "rich_text" as const, rich_text: richText(content) }
}

export function numberProp(value: number | null) {
  return { type: "number" as const, number: value }
}

export function checkboxProp(value: boolean) {
  return { type: "checkbox" as const, checkbox: value }
}

export function urlProp(url: string | null) {
  return { type: "url" as const, url }
}

export function emailProp(email: string | null) {
  return { type: "email" as const, email }
}

export function selectProp(name: string | null) {
  return {
    type: "select" as const,
    select: name ? { name } : null,
  }
}

export function multiSelectProp(names: string[]) {
  return {
    type: "multi_select" as const,
    multi_select: names.map((name) => ({ name })),
  }
}

export function dateProp(start: string | null) {
  return {
    type: "date" as const,
    date: start
      ? { start, end: null, time_zone: null }
      : null,
  }
}

export function filesExternalProp(
  files: Array<{ name: string; url: string }>
) {
  return {
    type: "files" as const,
    files: files.map((f) => ({
      name: f.name,
      type: "external" as const,
      external: { url: f.url },
    })),
  }
}

export function peopleProp(userIds: string[]) {
  return {
    type: "people" as const,
    people: userIds.map((id) => ({ object: "user" as const, id })),
  }
}

export function relationProp(pageIds: string[]) {
  return {
    type: "relation" as const,
    relation: pageIds.map((id) => ({ id })),
  }
}
