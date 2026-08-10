/**
 * Build Buildin page blocks for a single form application (one page = one submission).
 */
import {
  genreLabel,
  languageLabel,
  releaseTypeLabel,
  yesNoLabel,
} from "@/lib/buildin/labels"
import { richText } from "@/lib/buildin/types"
import type { FormSessionManifest } from "@/lib/buildin/form-session-schema"

function cell(text: string) {
  return richText(text || "—")
}

function paragraph(text: string) {
  return {
    type: "paragraph" as const,
    paragraph: { rich_text: richText(text) },
  }
}

function heading2(text: string) {
  return {
    type: "heading_2" as const,
    heading_2: { rich_text: richText(text) },
  }
}

function heading3(text: string) {
  return {
    type: "heading_3" as const,
    heading_3: { rich_text: richText(text) },
  }
}

function bullet(text: string) {
  return {
    type: "bulleted_list_item" as const,
    bulleted_list_item: { rich_text: richText(text) },
  }
}

function divider() {
  return { type: "divider" as const, divider: {} }
}

function trackTableColumns(formType: string): string[] {
  const cols = ["№", "Название", "Артисты"]
  if (formType === "catalog_upload") cols.push("ISRC")
  cols.push("Язык", "Explicit", "Фокус", "Предпросмотр", "Музыка", "Текст")
  return cols
}

function buildTrackTableHeader(formType: string) {
  const headers = trackTableColumns(formType)
  return {
    type: "table" as const,
    table: {
      table_width: headers.length,
      has_column_header: true,
      has_row_header: false,
      width_mode: "adaptive" as const,
    },
  }
}

function buildTrackTableRows(
  formType: string,
  tracks: FormSessionManifest["releases"][0]["tracks"]
) {
  const headers = trackTableColumns(formType)
  const headerRow = {
    type: "table_row" as const,
    table_row: { cells: headers.map((h) => cell(h)) },
  }
  const dataRows = tracks.map((track, i) => {
    const values = [String(i + 1), track.trackTitle, track.artists || ""]
    if (formType === "catalog_upload") values.push(track.isrc || "")
    values.push(
      languageLabel(track.language),
      track.explicit ? "Да" : "Нет",
      track.focus ? "Да" : "Нет",
      track.previewStart || "",
      track.musicAuthor || "",
      track.wordsAuthor || ""
    )
    return {
      type: "table_row" as const,
      table_row: { cells: values.map((v) => cell(v)) },
    }
  })
  return [headerRow, ...dataRows]
}

function releaseMetaBullets(
  formType: string,
  release: FormSessionManifest["releases"][0]
) {
  const items: string[] = []
  if (release.artists) items.push(`Артисты: ${release.artists}`)
  const typeLabel = releaseTypeLabel(formType, release.releaseType)
  if (typeLabel) items.push(`Тип: ${typeLabel}`)
  if (release.releaseDate) items.push(`Дата релиза: ${release.releaseDate}`)
  const g = genreLabel(release.genre, release.otherGenre)
  if (g) items.push(`Жанр: ${g}`)
  if (formType === "catalog_upload" && release.upc) {
    items.push(`UPC/EAN: ${release.upc}`)
  }
  items.push(`Треков: ${release.tracks.length}`)
  return items.map(bullet)
}

/** Human-readable payload lines (promo / social / streaming / comments). */
export function payloadSummaryLines(
  payload: Record<string, unknown>
): string[] {
  const lines: string[] = []
  const skip = new Set([
    "tracks",
    "releases",
    "coverFile",
    "wavFile",
    "lyricsFile",
    "artistNicknames",
    "releaseTitle",
    "releaseType",
    "releaseDate",
    "genre",
    "otherGenre",
    "upc",
    "isrc",
  ])
  const labels: Record<string, string> = {
    videoSnippetNeeded: "Нужен видео-сниппет",
    submitToPromo: "Отправить в промо",
    artistInfo: "Об артисте",
    releaseInfo: "О релизе",
    releaseSupport: "Поддержка релиза",
    artistPhotosLink: "Ссылка на фото",
    specifySocialMedia: "Указать соцсети",
    vkLink: "VK",
    tiktokLink: "TikTok",
    youtubeLink: "YouTube",
    instagramLink: "Instagram",
    soundcloudLink: "SoundCloud",
    specifyStreamingLinks: "Указать стриминг",
    yandexMusicLink: "Яндекс Музыка",
    spotifyLink: "Spotify",
    appleMusicLink: "Apple Music",
    vkMusicLink: "VK Music",
    otherComments: "Комментарии",
    comment: "Комментарий",
    message: "Сообщение",
    email: "Email",
    telegram: "Telegram",
    telegramProfile: "Telegram",
  }

  for (const [key, raw] of Object.entries(payload)) {
    if (skip.has(key) || raw == null || raw === "" || raw === "0") continue
    if (typeof raw === "object") continue
    const label = labels[key] || key
    let value = String(raw)
    if (key === "videoSnippetNeeded" || key === "submitToPromo" ||
        key === "specifySocialMedia" || key === "specifyStreamingLinks") {
      value = yesNoLabel(value) || value
    }
    lines.push(`${label}: ${value}`)
  }
  return lines
}

export type MaterializedReleaseBlocks = {
  /** Toggle block id for the release section (files for cover attach here) */
  releaseBlockId: string
  /** Per-track file section block ids */
  trackBlockIds: string[]
}

type AppendFn = (
  blockId: string,
  children: unknown[]
) => Promise<{ results?: Array<{ id: string; type?: string }> }>

/**
 * Append a full release section (toggle + meta + track table + file placeholders).
 * Returns block IDs for wiring FormDeliveryItem / files.
 *
 * Buildin ignores nested `children` on some toggle creates — always create the
 * toggle first, then PATCH children onto it.
 */
export async function appendReleaseSection(opts: {
  pageId: string
  formType: string
  releaseIndex: number
  release: FormSessionManifest["releases"][0]
  append: AppendFn
}): Promise<MaterializedReleaseBlocks> {
  const { pageId, formType, releaseIndex, release, append } = opts
  const title = `Релиз ${releaseIndex + 1}: ${release.releaseTitle}`

  const created = await append(pageId, [
    {
      type: "toggle",
      toggle: { rich_text: richText(title) },
    },
  ])

  const releaseBlock = created.results?.[0]
  if (!releaseBlock?.id) {
    throw new Error("Buildin не вернул id блока релиза")
  }

  await append(releaseBlock.id, [
    ...releaseMetaBullets(formType, release),
    heading3("Трек-лист"),
  ])

  const tableRes = await append(releaseBlock.id, [
    buildTrackTableHeader(formType),
  ])
  const tableBlock = tableRes.results?.[0]
  if (!tableBlock?.id) {
    throw new Error("Buildin не вернул id таблицы треков")
  }
  await append(tableBlock.id, buildTrackTableRows(formType, release.tracks))

  await append(releaseBlock.id, [
    heading3("Файлы релиза"),
    paragraph("Обложка и вложения релиза появятся здесь после загрузки."),
  ])

  const trackBlockIds: string[] = []
  for (let ti = 0; ti < release.tracks.length; ti++) {
    const track = release.tracks[ti]
    const trackRes = await append(releaseBlock.id, [
      {
        type: "toggle",
        toggle: {
          rich_text: richText(
            `Файлы трека ${ti + 1}: ${track.trackTitle}`
          ),
        },
      },
    ])
    const trackBlock = trackRes.results?.[0]
    if (!trackBlock?.id) {
      throw new Error(`Buildin не вернул id блока трека ${ti + 1}`)
    }
    await append(trackBlock.id, [
      paragraph(
        [
          track.isrc && formType === "catalog_upload"
            ? `ISRC: ${track.isrc}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Аудио и текст появятся здесь после загрузки."
      ),
    ])
    trackBlockIds.push(trackBlock.id)
  }

  return { releaseBlockId: releaseBlock.id, trackBlockIds }
}

/**
 * Optional header blocks (contact / promo). No duplicate «Сводка заявки» —
 * artist, release title, date and processed live on the queue row.
 */
export function buildFinalizeBlocks(manifest: FormSessionManifest): unknown[] {
  const blocks: unknown[] = []

  if (manifest.formType === "distribution") {
    const contact = manifest.contact || manifest.contactTelegram
    if (contact) {
      blocks.push(heading2("Контакт"))
      blocks.push(bullet(contact))
      blocks.push(divider())
    }
  }

  const showPromo =
    manifest.formType === "release_upload" ||
    manifest.formType === "distribution"
  const payloadLines = showPromo
    ? payloadSummaryLines(manifest.payload || {})
    : []
  if (payloadLines.length) {
    blocks.push(heading2("Промо и доп. данные"))
    for (const line of payloadLines) blocks.push(bullet(line))
    blocks.push(divider())
  }

  return blocks
}

/** Single-release queues only — never use for catalog list row. */
export function releaseDateForSingle(
  manifest: FormSessionManifest
): string | null {
  const d = manifest.releases[0]?.releaseDate
  if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  return null
}

export function genreForSingleRelease(manifest: FormSessionManifest): string {
  const r = manifest.releases[0]
  if (!r) return ""
  return genreLabel(r.genre, r.otherGenre)
}

export function releaseTypeForSingle(manifest: FormSessionManifest): string {
  const r = manifest.releases[0]
  if (!r) return ""
  return releaseTypeLabel(manifest.formType, r.releaseType)
}

export function yesNoFromPayload(
  payload: Record<string, unknown>,
  key: string
): string {
  return yesNoLabel(String(payload?.[key] ?? "0")) || "Нет"
}
