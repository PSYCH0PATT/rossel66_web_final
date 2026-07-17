import { uploadFileToPyrus } from "@/lib/pyrus"
import type { CatalogRelease, CatalogUploadGuids } from "./types"
import {
  CatalogSubmitError,
  CATALOG_MAX_FILE_BYTES,
  fileTooLargeUserMessage,
  fileUploadUserMessage,
} from "./errors"
import { catalogLog } from "./log"

export type FileUploadProgressFn = (percent: number) => void

function assertFileSize(file: File, releaseIndex: number): void {
  if (file.size > CATALOG_MAX_FILE_BYTES) {
    throw new CatalogSubmitError({
      code: "file_too_large",
      userMessage: fileTooLargeUserMessage(file.name, CATALOG_MAX_FILE_BYTES / (1024 * 1024)),
      logContext: { releaseIndex, fileName: file.name, fileSize: file.size },
      httpStatus: 400,
    })
  }
}

async function uploadRequired(
  file: File,
  accessToken: string,
  releaseIndex: number,
  trackIndex: number | null,
  label: string
): Promise<string> {
  assertFileSize(file, releaseIndex)
  const result = await uploadFileToPyrus(file, accessToken)
  if (!result?.guid) {
    catalogLog("file_upload_failed", {
      releaseIndex,
      trackIndex: trackIndex ?? undefined,
      fileName: file.name,
      fileSize: file.size,
      label,
    })
    throw new CatalogSubmitError({
      code: "file_upload_failed",
      userMessage: fileUploadUserMessage(releaseIndex, file.name),
      logContext: { releaseIndex, trackIndex, fileName: file.name, label },
      httpStatus: 502,
    })
  }
  return result.guid
}

async function uploadOptional(
  file: File | null,
  accessToken: string,
  releaseIndex: number,
  trackIndex: number | null
): Promise<string | null> {
  if (!file) return null
  return uploadRequired(file, accessToken, releaseIndex, trackIndex, "optional")
}

export function preflightCatalogFiles(
  releases: CatalogRelease[],
  formData: FormData
): void {
  releases.forEach((release, rIdx) => {
    const cover = formData.get(`release_${rIdx}_coverArt`)
    if (!(cover instanceof File) || cover.size === 0) {
      throw new CatalogSubmitError({
        code: "file_missing",
        userMessage: `Релиз ${rIdx + 1}: загрузите обложку.`,
        logContext: { releaseIndex: rIdx, fileName: "coverArt" },
        httpStatus: 400,
      })
    }
    assertFileSize(cover, rIdx)

    const trackCount = release.releaseType === "1" ? 1 : release.tracks.length
    for (let tIdx = 0; tIdx < trackCount; tIdx++) {
      const audio = formData.get(`release_${rIdx}_track_${tIdx}_audioFile`)
      if (!(audio instanceof File) || audio.size === 0) {
        throw new CatalogSubmitError({
          code: "file_missing",
          userMessage: `Релиз ${rIdx + 1}, трек ${tIdx + 1}: загрузите аудио-файл.`,
          logContext: { releaseIndex: rIdx, trackIndex: tIdx, fileName: "audioFile" },
          httpStatus: 400,
        })
      }
      assertFileSize(audio, rIdx)
      const lyrics = formData.get(`release_${rIdx}_track_${tIdx}_lyricsFile`)
      if (lyrics instanceof File && lyrics.size > 0) {
        assertFileSize(lyrics, rIdx)
      }
    }
  })
}

export function countCatalogFilesToUpload(releases: CatalogRelease[], formData: FormData): number {
  let n = 0
  releases.forEach((release, rIdx) => {
    if (formData.get(`release_${rIdx}_coverArt`)) n++
    const trackCount = release.releaseType === "1" ? 1 : release.tracks.length
    for (let tIdx = 0; tIdx < trackCount; tIdx++) {
      if (formData.get(`release_${rIdx}_track_${tIdx}_audioFile`)) n++
      if (formData.get(`release_${rIdx}_track_${tIdx}_lyricsFile`)) n++
    }
  })
  return n
}

export async function uploadAllCatalogFiles(
  releases: CatalogRelease[],
  formData: FormData,
  accessToken: string,
  onProgress?: FileUploadProgressFn
): Promise<CatalogUploadGuids> {
  const total = countCatalogFilesToUpload(releases, formData)
  let done = 0
  const bump = () => {
    done++
    if (onProgress && total > 0) onProgress(Math.round((done / total) * 100))
  }

  const result: CatalogUploadGuids = { releases: [] }

  for (let rIdx = 0; rIdx < releases.length; rIdx++) {
    const release = releases[rIdx]
    const coverFile = formData.get(`release_${rIdx}_coverArt`) as File | null
    const coverGuid = coverFile
      ? await uploadRequired(coverFile, accessToken, rIdx, null, "cover")
      : null
    if (coverFile) bump()

    const trackGuids: CatalogUploadGuids["releases"][0]["trackGuids"] = []
    const trackCount = release.releaseType === "1" ? 1 : release.tracks.length

    for (let tIdx = 0; tIdx < trackCount; tIdx++) {
      const audioFile = formData.get(`release_${rIdx}_track_${tIdx}_audioFile`) as File | null
      const lyricsFile = formData.get(`release_${rIdx}_track_${tIdx}_lyricsFile`) as File | null

      const audioGuid = audioFile
        ? await uploadRequired(audioFile, accessToken, rIdx, tIdx, "audio")
        : null
      if (audioFile) bump()

      const lyricsGuid = await uploadOptional(lyricsFile, accessToken, rIdx, tIdx)
      if (lyricsFile) bump()

      trackGuids.push({ audioGuid, lyricsGuid })
    }

    result.releases.push({ coverGuid, trackGuids })
  }

  return result
}
