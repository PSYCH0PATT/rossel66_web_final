import { z } from "zod"
import { CATALOG_MAX_RELEASES } from "./field-map"

const previewStartRegex = /^\d{2}:\d{2}$/

const catalogTrackSchema = z.object({
  id: z.string(),
  trackName: z.string().max(8000).optional().default(""),
  mainArtists: z.string().max(8000).optional().default(""),
  isrc: z.string().min(1, "укажите ISRC"),
  previewStart: z
    .string()
    .min(1, "укажите начало предпрослушивания")
    .regex(previewStartRegex, "формат начала предпрослушивания: ММ:СС"),
  musicAuthor: z.string().min(1, "укажите автора музыки").max(8000),
  wordsAuthor: z.string().max(8000).optional().default(""),
  language: z
    .string()
    .refine((v) => v !== "0", { message: "выберите язык вокала" }),
  explicit: z.boolean().optional().default(false),
  isFocusTrack: z.boolean().optional().default(false),
})

const catalogReleaseBaseSchema = z.object({
  id: z.string(),
  releaseType: z.enum(["1", "2"], { message: "выберите тип релиза" }),
  releaseTitle: z.string().min(1, "укажите название релиза").max(8000),
  artists: z.string().min(1, "укажите артистов").max(8000),
  upc: z.string().max(128).optional().default(""),
  originalReleaseDate: z
    .string()
    .min(1, "укажите оригинальную дату релиза")
    .max(32),
  genre: z.string().min(1, "укажите жанр").max(8000),
  tracks: z.array(catalogTrackSchema).min(1, "добавьте хотя бы один трек"),
})

export const catalogReleaseSchema = catalogReleaseBaseSchema.superRefine((release, ctx) => {
  if (release.releaseType === "1") {
    if (release.tracks.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "для сингла допускается только один трек",
        path: ["tracks"],
      })
    }
  }
  if (release.releaseType === "2") {
    release.tracks.forEach((track, i) => {
      if (!track.trackName?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "укажите название трека",
          path: ["tracks", i, "trackName"],
        })
      }
      if (!track.mainArtists?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "укажите исполнителей трека",
          path: ["tracks", i, "mainArtists"],
        })
      }
    })
  }
  release.tracks.forEach((track, i) => {
    if (
      (track.language === "1" || track.language === "2") &&
      !track.wordsAuthor?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "укажите автора слов",
        path: ["tracks", i, "wordsAuthor"],
      })
    }
  })
})

export const catalogReleasesSchema = z
  .array(catalogReleaseSchema)
  .min(1, "добавьте хотя бы один релиз")
  .max(CATALOG_MAX_RELEASES, `за раз можно отправить до ${CATALOG_MAX_RELEASES} релизов`)

export type CatalogReleaseInput = z.infer<typeof catalogReleaseSchema>
