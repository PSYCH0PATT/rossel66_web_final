import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { pushProgress } from "../progress-stream"
import { getPyrusApiKey, getPyrusAccessToken, uploadFileToPyrus } from "@/lib/pyrus"
import {
  guardPublicFormRateLimit,
  safeParseFormJsonString,
  pyrusDistributionClientSchema,
} from "@/lib/pyrus-public-schemas"
import { recordAndDualWriteSubmission } from "@/lib/buildin/dual-write"
import { collectBuildinFilesFromFormData } from "@/lib/buildin/collect-files"
import {
  isBuildinDualWriteEnabled,
  isPyrusWriteDisabled,
} from "@/lib/buildin/env"

const PYRUS_FORM_ID_DISTRIBUTION = 2320361

interface TrackReleaseData {
  id: string
  trackName: string
  mainArtists: string
  previewStart: string
  musicAuthor: string
  wordsAuthor: string
  language: string
  explicit: string
  isFocusTrack: boolean
}

interface DistributionAPIData {
  contact: string
  artistNicknames: string
  releaseTitle: string
  releaseType: string
  releaseDate: string
  genre: string
  otherGenre?: string
  tracks: TrackReleaseData[]
  videoSnippetNeeded: string
  submitToPromo: string
  artistInfo?: string
  releaseInfo?: string
  releaseSupport?: string
  artistPhotosLink?: string
  specifySocialMedia?: string
  vkLink?: string
  tiktokLink?: string
  youtubeLink?: string
  instagramLink?: string
  soundcloudLink?: string
  specifyStreamingLinks?: string
  yandexMusicLink?: string
  spotifyLink?: string
  appleMusicLink?: string
  vkMusicLink?: string
  otherComments?: string
}

export async function POST(request: NextRequest) {
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl

  const pyrusDisabled = isPyrusWriteDisabled()
  const buildinEnabled = isBuildinDualWriteEnabled()

  if (pyrusDisabled && !buildinEnabled) {
    return NextResponse.json(
      { message: "Приём заявок временно недоступен: нет настроенного бэкенда форм." },
      { status: 503 }
    )
  }

  try {
    const formDataFromRequest = await request.formData()
    const formJsonString = formDataFromRequest.get("form_data_json") as string | null
    const uploadId = formDataFromRequest.get("upload_id") as string | null

    const parsedForm = safeParseFormJsonString(formJsonString, pyrusDistributionClientSchema)
    if (!parsedForm.ok) return parsedForm.response
    const clientData = parsedForm.data as unknown as DistributionAPIData

    const taskTitle = `Заявка на дистрибуцию: ${clientData.releaseTitle || "Без названия"} от ${clientData.artistNicknames || "Неизвестный артист"}`

    let pyrusTaskId: string | null = null

    if (!pyrusDisabled) {
      if (!getPyrusApiKey()) {
        return NextResponse.json(
          { message: "Ошибка сервера: Ключ API Pyrus не настроен." },
          { status: 500 }
        )
      }

      const accessToken = await getPyrusAccessToken()
      if (!accessToken) {
        return NextResponse.json(
          { message: "Ошибка аутентификации Pyrus." },
          { status: 500 }
        )
      }

      let totalFilesToUpload = 1
      clientData.tracks.forEach(() => {
        totalFilesToUpload++
      })
      for (let i = 0; i < clientData.tracks.length; i++) {
        const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null
        if (lyricsFile) totalFilesToUpload++
      }

      let uploadedCount = 0
      const pyrusFields: any[] = []

      pyrusFields.push({ id: 41, value: clientData.contact })
      pyrusFields.push({ id: 2, value: clientData.artistNicknames })
      pyrusFields.push({ id: 3, value: clientData.releaseTitle })
      if (clientData.releaseType && clientData.releaseType !== "0")
        pyrusFields.push({ id: 4, value: { choice_id: parseInt(clientData.releaseType) } })
      pyrusFields.push({ id: 5, value: clientData.releaseDate })

      const coverArtFile = formDataFromRequest.get("coverArtFile") as File | null
      if (coverArtFile) {
        const uploadedCover = await uploadFileToPyrus(coverArtFile, accessToken)
        if (uploadedCover?.guid) {
          pyrusFields.push({ id: 6, value: [{ guid: uploadedCover.guid }] })
          if (uploadId) {
            uploadedCount++
            pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100))
          }
        }
      }

      if (clientData.genre && clientData.genre !== "0")
        pyrusFields.push({ id: 7, value: { choice_id: parseInt(clientData.genre) } })
      if (clientData.genre === "7" && clientData.otherGenre) {
        pyrusFields.push({ id: 8, value: clientData.otherGenre })
      }

      const tracksTableRows: any[] = []
      for (let i = 0; i < clientData.tracks.length; i++) {
        const track = clientData.tracks[i]
        const trackCells: any[] = []
        const numericRowId = i + 1

        const audioFile = formDataFromRequest.get(`track_${i}_audioFile`) as File | null
        if (audioFile) {
          const uploadedAudio = await uploadFileToPyrus(audioFile, accessToken)
          if (uploadedAudio?.guid) {
            trackCells.push({ id: 10, value: [uploadedAudio.guid] })
            if (uploadId) {
              uploadedCount++
              pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100))
            }
          }
        }
        trackCells.push({ id: 11, value: track.trackName })
        trackCells.push({ id: 12, value: track.mainArtists })
        trackCells.push({ id: 13, value: track.previewStart })
        trackCells.push({ id: 14, value: track.musicAuthor })
        trackCells.push({ id: 15, value: track.wordsAuthor })
        if (track.language && track.language !== "0")
          trackCells.push({ id: 16, value: { choice_id: parseInt(track.language) } })
        if (track.explicit && track.explicit !== "0")
          trackCells.push({ id: 17, value: { choice_id: parseInt(track.explicit) } })
        trackCells.push({ id: 18, value: track.isFocusTrack ? true : null })

        const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null
        if (lyricsFile) {
          const uploadedLyrics = await uploadFileToPyrus(lyricsFile, accessToken)
          if (uploadedLyrics?.guid) {
            trackCells.push({ id: 19, value: [uploadedLyrics.guid] })
            if (uploadId) {
              uploadedCount++
              pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100))
            }
          }
        }
        tracksTableRows.push({ row_id: numericRowId, cells: trackCells })
      }
      if (tracksTableRows.length > 0) {
        pyrusFields.push({ id: 9, value: tracksTableRows })
      }

      if (clientData.videoSnippetNeeded && clientData.videoSnippetNeeded !== "0")
        pyrusFields.push({ id: 20, value: { choice_id: parseInt(clientData.videoSnippetNeeded) } })
      if (clientData.submitToPromo && clientData.submitToPromo !== "0")
        pyrusFields.push({ id: 22, value: { choice_id: parseInt(clientData.submitToPromo) } })

      if (clientData.submitToPromo === "1") {
        if (clientData.artistInfo) pyrusFields.push({ id: 24, value: clientData.artistInfo })
        if (clientData.releaseInfo) pyrusFields.push({ id: 25, value: clientData.releaseInfo })
        if (clientData.releaseSupport) pyrusFields.push({ id: 26, value: clientData.releaseSupport })
        if (clientData.artistPhotosLink) pyrusFields.push({ id: 27, value: clientData.artistPhotosLink })

        if (clientData.specifySocialMedia && clientData.specifySocialMedia !== "0")
          pyrusFields.push({ id: 28, value: { choice_id: parseInt(clientData.specifySocialMedia) } })
        if (clientData.specifySocialMedia === "1") {
          if (clientData.vkLink) pyrusFields.push({ id: 29, value: clientData.vkLink })
          if (clientData.tiktokLink) pyrusFields.push({ id: 30, value: clientData.tiktokLink })
          if (clientData.youtubeLink) pyrusFields.push({ id: 31, value: clientData.youtubeLink })
          if (clientData.instagramLink) pyrusFields.push({ id: 32, value: clientData.instagramLink })
          if (clientData.soundcloudLink) pyrusFields.push({ id: 33, value: clientData.soundcloudLink })
        }
      }

      if (clientData.specifyStreamingLinks && clientData.specifyStreamingLinks !== "0")
        pyrusFields.push({ id: 34, value: { choice_id: parseInt(clientData.specifyStreamingLinks) } })
      if (clientData.specifyStreamingLinks === "1") {
        if (clientData.yandexMusicLink) pyrusFields.push({ id: 35, value: clientData.yandexMusicLink })
        if (clientData.spotifyLink) pyrusFields.push({ id: 36, value: clientData.spotifyLink })
        if (clientData.appleMusicLink) pyrusFields.push({ id: 37, value: clientData.appleMusicLink })
        if (clientData.vkMusicLink) pyrusFields.push({ id: 38, value: clientData.vkMusicLink })
      }

      if (clientData.otherComments) pyrusFields.push({ id: 39, value: clientData.otherComments })

      const pyrusResponse = await fetch("https://api.pyrus.com/v4/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form_id: PYRUS_FORM_ID_DISTRIBUTION,
          fields: pyrusFields.filter(
            (f) =>
              f.value !== null &&
              f.value !== undefined &&
              f.value !== "" &&
              (Array.isArray(f.value) ? f.value.length > 0 : true)
          ),
          text: taskTitle,
        }),
      })

      const responseData = await pyrusResponse.json()

      if (!(pyrusResponse.ok && responseData?.task?.id)) {
        console.error("Pyrus API error (creating distribution task):", responseData)
        if (responseData.error && responseData.error_code === "invalid_value_format") {
          return NextResponse.json(
            { message: "Проверьте корректность заполненных полей в форме." },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { message: "Ошибка при отправке формы", details: responseData },
          { status: pyrusResponse.status || 500 }
        )
      }

      pyrusTaskId = String(responseData.task.id)
    }

    const dualWarnings: string[] = []
    const buildinFiles = buildinEnabled
      ? await collectBuildinFilesFromFormData(formDataFromRequest, dualWarnings)
      : []

    const dual = await recordAndDualWriteSubmission({
      formType: "distribution",
      title: taskTitle,
      payload: clientData as unknown as Record<string, unknown>,
      contactTelegram: clientData.contact,
      artistNickname: clientData.artistNicknames,
      pyrusTaskId,
      files: buildinFiles,
      idempotencySeed: uploadId || `distribution:${clientData.releaseTitle}:${clientData.contact}`,
    })

    if (uploadId) pushProgress(uploadId, 100)

    return NextResponse.json({
      message: "Форма успешно отправлена",
      taskId: pyrusTaskId,
      submissionId: dual.submissionId,
      buildinPageId: dual.buildinPageId,
      warnings: [...dualWarnings, ...dual.warnings].length
        ? [...dualWarnings, ...dual.warnings]
        : undefined,
    })
  } catch (error) {
    console.error("Error processing Pyrus distribution submission:", error)
    const errorDetails =
      error instanceof Error ? error.message : "Неизвестная ошибка сервера"
    return NextResponse.json(
      { message: "Ошибка при отправке формы", details: errorDetails },
      { status: 500 }
    )
  }
}
