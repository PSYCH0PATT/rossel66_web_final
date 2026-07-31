import { z } from "zod"
import {
  FORM_SESSION_MAX_FILE_BYTES,
  FORM_SESSION_MAX_FILES,
  FORM_SESSION_MAX_MANIFEST_BYTES,
  FORM_SESSION_MAX_TOTAL_BYTES,
} from "@/lib/buildin/types"

export const formSessionFileMetaSchema = z.object({
  fieldKey: z.string().min(1).max(200),
  filename: z.string().min(1).max(240),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(FORM_SESSION_MAX_FILE_BYTES),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  /** release | track | submission */
  parentKind: z.enum(["release", "track", "submission"]),
  releaseIndex: z.number().int().min(0).optional(),
  trackIndex: z.number().int().min(0).optional(),
})

export const formSessionTrackSchema = z.object({
  trackTitle: z.string().min(1).max(500),
  artists: z.string().max(800).optional().default(""),
  isrc: z.string().max(32).optional().default(""),
  language: z.string().max(80).optional().default(""),
  explicit: z.boolean().optional().default(false),
  focus: z.boolean().optional().default(false),
  lyrics: z.string().max(8000).optional().default(""),
  previewStart: z.string().max(32).optional().default(""),
  musicAuthor: z.string().max(500).optional().default(""),
  wordsAuthor: z.string().max(500).optional().default(""),
})

export const formSessionReleaseSchema = z.object({
  releaseTitle: z.string().min(1).max(500),
  artists: z.string().max(800).optional().default(""),
  releaseType: z.string().max(8).optional().default("1"),
  upc: z.string().max(32).optional().default(""),
  genre: z.string().max(120).optional().default(""),
  otherGenre: z.string().max(120).optional().default(""),
  releaseDate: z.string().max(32).optional().default(""),
  tracks: z.array(formSessionTrackSchema).min(1).max(100),
})

export const formSessionManifestSchema = z
  .object({
    formType: z.enum([
      "catalog_upload",
      "release_upload",
      "distribution",
      "data_rf",
      "data_not_rf",
      "contact",
    ]),
    title: z.string().min(1).max(500),
    contactEmail: z.string().email().optional().nullable(),
    contactTelegram: z.string().max(200).optional().nullable(),
    artistNickname: z.string().max(200).optional().nullable(),
    /** Non-PII / catalog-safe payload fields */
    payload: z.record(z.string(), z.unknown()).default({}),
    releases: z.array(formSessionReleaseSchema).max(200).default([]),
    files: z.array(formSessionFileMetaSchema).max(FORM_SESSION_MAX_FILES),
  })
  .superRefine((val, ctx) => {
    if (val.files.length > FORM_SESSION_MAX_FILES) {
      ctx.addIssue({
        code: "custom",
        message: `Слишком много файлов (макс. ${FORM_SESSION_MAX_FILES})`,
      })
    }
    let total = 0
    const keys = new Set<string>()
    for (const f of val.files) {
      if (keys.has(f.fieldKey)) {
        ctx.addIssue({
          code: "custom",
          message: `Дублирующий fieldKey: ${f.fieldKey}`,
        })
      }
      keys.add(f.fieldKey)
      total += f.sizeBytes
      if (f.sizeBytes > FORM_SESSION_MAX_FILE_BYTES) {
        ctx.addIssue({
          code: "custom",
          message: `Файл ${f.filename} превышает 100 МБ`,
        })
      }
    }
    if (total > FORM_SESSION_MAX_TOTAL_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: "Суммарный объём файлов превышает 30 ГБ на сессию",
      })
    }
    if (
      (val.formType === "catalog_upload" ||
        val.formType === "release_upload" ||
        val.formType === "distribution") &&
      val.releases.length < 1
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Добавьте хотя бы один релиз",
      })
    }
  })

export type FormSessionManifest = z.infer<typeof formSessionManifestSchema>

export function assertManifestSize(manifest: FormSessionManifest) {
  const bytes = Buffer.byteLength(JSON.stringify(manifest), "utf8")
  if (bytes > FORM_SESSION_MAX_MANIFEST_BYTES) {
    throw new Error(
      `Manifest слишком большой (${bytes} байт, лимит ${FORM_SESSION_MAX_MANIFEST_BYTES})`
    )
  }
  return bytes
}

export function countTracks(manifest: FormSessionManifest): number {
  return manifest.releases.reduce((n, r) => n + r.tracks.length, 0)
}

export function sumFileBytes(manifest: FormSessionManifest): number {
  return manifest.files.reduce((n, f) => n + f.sizeBytes, 0)
}
