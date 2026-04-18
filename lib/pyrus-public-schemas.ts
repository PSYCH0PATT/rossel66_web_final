import { z } from "zod"
import { NextResponse } from "next/server"
import { rateLimitPublicForm } from "@/lib/rate-limit"

const MAX_FORM_JSON_CHARS = 2_000_000

export function clientIpFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

/** 429 при превышении лимита публичной формы */
export function guardPublicFormRateLimit(request: Request): NextResponse | null {
  const rl = rateLimitPublicForm(clientIpFromRequest(request))
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Слишком много отправок. Подождите и попробуйте снова." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } }
    )
  }
  return null
}

function jsonParseBounded(raw: string): { ok: true; value: unknown } | { ok: false; response: NextResponse } {
  if (raw.length > MAX_FORM_JSON_CHARS) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Слишком большой JSON." }, { status: 413 }),
    }
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message: "Некорректный JSON." }, { status: 400 }),
    }
  }
}

export function safeParseFormJsonString<T>(
  raw: string | null | undefined,
  schema: z.ZodType<T>
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  if (raw == null || !String(raw).trim()) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Отсутствуют данные формы." }, { status: 400 }),
    }
  }
  const parsed = jsonParseBounded(String(raw))
  if (!parsed.ok) return parsed
  const r = schema.safeParse(parsed.value)
  if (!r.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Некорректные поля формы.", details: r.error.flatten() },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: r.data }
}

const looseStr = z.string().max(8000)
const looseStrOpt = z.string().max(8000).optional()

/** submit-pyrus-data-not-rf */
export const pyrusDataNotRfSchema = z
  .object({
    nickname: z.string().min(1).max(512),
    telegramProfile: z.string().max(2000),
    email: z.string().max(320),
    citizenship: z.string().max(64),
    otherCitizenship: looseStrOpt,
    passportFullName: z.string().min(1).max(512),
    passportShortName: z.string().min(1).max(256),
    dateOfBirth: z.string().max(32),
    passportIdNumber: z.string().max(128),
    passportIssuedBy: looseStrOpt,
    passportDepartmentCode: looseStrOpt,
    passportIssueDate: looseStrOpt,
    placeOfBirth: z.string().max(512),
    registrationAddress: z.string().max(2000),
    taxId: looseStrOpt,
    bankName: z.string().max(512),
    bankAccountNumber: z.string().max(128),
    bankCorrespondentAccount: looseStrOpt,
    bankBik: looseStrOpt,
    bankInn: looseStrOpt,
    bankKpp: looseStrOpt,
  })
  .passthrough()

/** submit-pyrus-data-rf */
export const pyrusDataRfSchema = z
  .object({
    nickname: z.string().min(1).max(512),
    telegramProfile: z.string().max(2000),
    email: z.string().max(320),
    passportFullName: z.string().min(1).max(512),
    passportShortName: z.string().min(1).max(256),
    dateOfBirth: z.string().max(32),
    passportSeriesNumber: z.string().max(64),
    passportIssuedBy: z.string().max(512),
    passportIssueDate: z.string().max(32),
    passportDepartmentCode: z.string().max(32),
    placeOfBirth: z.string().max(512),
    registrationAddress: z.string().max(2000),
    snils: z.string().max(32),
    inn: z.string().max(32),
    bankName: z.string().max(512),
    bankAccountNumber: z.string().max(128),
    bankCorrespondentAccount: z.string().max(64),
    bankBik: z.string().max(16),
    bankInn: z.string().max(16),
    bankKpp: z.string().max(16),
  })
  .passthrough()

/** submit-pyrus-distribution (FormData JSON) */
export const pyrusDistributionClientSchema = z
  .object({
    contact: looseStr,
    artistNicknames: looseStr,
    releaseTitle: looseStr,
    releaseType: looseStr,
    releaseDate: looseStr,
    genre: looseStr,
    otherGenre: looseStrOpt,
    tracks: z.array(z.record(z.string(), z.unknown())).max(100),
    videoSnippetNeeded: looseStr,
    submitToPromo: looseStr,
    artistInfo: looseStrOpt,
    releaseInfo: looseStrOpt,
    releaseSupport: looseStrOpt,
    artistPhotosLink: looseStrOpt,
    specifySocialMedia: looseStrOpt,
    vkLink: looseStrOpt,
    tiktokLink: looseStrOpt,
    youtubeLink: looseStrOpt,
    instagramLink: looseStrOpt,
    soundcloudLink: looseStrOpt,
    specifyStreamingLinks: looseStrOpt,
    yandexMusicLink: looseStrOpt,
    spotifyLink: looseStrOpt,
    appleMusicLink: looseStrOpt,
    vkMusicLink: looseStrOpt,
    otherComments: looseStrOpt,
  })
  .passthrough()

/** submit-pyrus-release-upload */
export const pyrusReleaseUploadClientSchema = z
  .object({
    email: z.string().max(320).optional(),
    artistNicknames: looseStr,
    releaseTitle: looseStr,
    releaseType: looseStr,
    releaseDate: looseStr,
    genre: looseStr,
    otherGenre: looseStrOpt,
    tracks: z.array(z.record(z.string(), z.unknown())).max(100),
    videoSnippetNeeded: looseStr,
    submitToPromo: looseStr,
    artistInfo: looseStrOpt,
    releaseInfo: looseStrOpt,
    releaseSupport: looseStrOpt,
    artistPhotosLink: looseStrOpt,
    specifySocialMedia: looseStrOpt,
    vkLink: looseStrOpt,
    tiktokLink: looseStrOpt,
    youtubeLink: looseStrOpt,
    instagramLink: looseStrOpt,
    soundcloudLink: looseStrOpt,
    specifyStreamingLinks: looseStrOpt,
    yandexMusicLink: looseStrOpt,
    spotifyLink: looseStrOpt,
    appleMusicLink: looseStrOpt,
    vkMusicLink: looseStrOpt,
    otherComments: looseStrOpt,
    coverArtGuid: looseStrOpt,
  })
  .passthrough()

/** submit-pyrus-catalog-upload: массив релизов */
export const pyrusCatalogReleasesSchema = z.array(z.record(z.string(), z.unknown())).min(1).max(25)
