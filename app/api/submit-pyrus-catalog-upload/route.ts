import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { pushProgress } from "../progress-stream"
import { getPyrusApiKey, getPyrusAccessToken } from "@/lib/pyrus"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { catalogReleasesSchema } from "@/lib/pyrus-catalog/validate"
import { PYRUS_CATALOG_FORM_ID } from "@/lib/pyrus-catalog/field-map"
import {
  buildCatalogTaskTitle,
  buildPyrusCatalogFields,
} from "@/lib/pyrus-catalog/build-pyrus-payload"
import {
  countCatalogFilesToUpload,
  preflightCatalogFiles,
  uploadAllCatalogFiles,
} from "@/lib/pyrus-catalog/upload-files"
import {
  CatalogSubmitError,
  formatZodIssuesForUser,
  mapPyrusApiErrorToUserMessage,
} from "@/lib/pyrus-catalog/errors"
import { catalogLog } from "@/lib/pyrus-catalog/log"
import type { CatalogRelease } from "@/lib/pyrus-catalog/types"
import {
  isBuildinDualWriteEnabled,
  isPyrusWriteDisabled,
} from "@/lib/buildin/env"
import { recordAndDualWriteSubmission } from "@/lib/buildin/dual-write"
import { collectBuildinFilesFromFormData } from "@/lib/buildin/collect-files"

export const maxDuration = 300

const MAX_FORM_JSON_CHARS = 2_000_000

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
    const formData = await request.formData()
    const formJsonString = formData.get("form_data_json") as string | null
    const uploadId = formData.get("upload_id") as string | null

    if (formJsonString == null || !String(formJsonString).trim()) {
      return NextResponse.json({ message: "Отсутствуют данные формы." }, { status: 400 })
    }
    if (String(formJsonString).length > MAX_FORM_JSON_CHARS) {
      return NextResponse.json({ message: "Слишком большой объём данных формы." }, { status: 413 })
    }

    let jsonValue: unknown
    try {
      jsonValue = JSON.parse(String(formJsonString))
    } catch {
      return NextResponse.json({ message: "Некорректный формат данных формы." }, { status: 400 })
    }

    const parsed = catalogReleasesSchema.safeParse(jsonValue)
    if (!parsed.success) {
      const message = formatZodIssuesForUser(parsed.error.issues)
      catalogLog("validation_failed", { uploadId, issues: parsed.error.issues })
      return NextResponse.json({ message }, { status: 400 })
    }

    const releases = parsed.data as CatalogRelease[]
    preflightCatalogFiles(releases, formData)
    const taskTitle = buildCatalogTaskTitle(releases)

    let pyrusTaskId: string | null = null

    if (!pyrusDisabled) {
      if (!getPyrusApiKey()) {
        catalogLog("config_missing", { reason: "PYRUS_API_KEY" })
        return NextResponse.json(
          { message: "Ошибка сервера: интеграция с Pyrus не настроена." },
          { status: 500 }
        )
      }

      const accessToken = await getPyrusAccessToken()
      if (!accessToken) {
        catalogLog("auth_failed", {})
        return NextResponse.json(
          { message: "Ошибка аутентификации. Попробуйте позже или обратитесь в поддержку." },
          { status: 500 }
        )
      }

      const totalFiles = countCatalogFilesToUpload(releases, formData)
      const guids = await uploadAllCatalogFiles(releases, formData, accessToken, (percent) => {
        if (uploadId) pushProgress(uploadId, percent)
      })

      const pyrusFields = buildPyrusCatalogFields(releases, guids)

      catalogLog("create_task_request", {
        uploadId,
        releaseCount: releases.length,
        fieldCount: pyrusFields.length,
        fileCount: totalFiles,
      })

      const pyrusResponse = await fetch("https://api.pyrus.com/v4/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form_id: PYRUS_CATALOG_FORM_ID,
          fields: pyrusFields,
          text: taskTitle,
        }),
      })

      const responseData = await pyrusResponse.json()

      if (!(pyrusResponse.ok && responseData?.task?.id)) {
        catalogLog("pyrus_api_error", {
          uploadId,
          status: pyrusResponse.status,
          errorCode: responseData?.error_code,
          error: responseData?.error,
          responseData,
        })

        const userMessage = responseData?.error_code
          ? mapPyrusApiErrorToUserMessage(responseData.error_code, responseData.error ?? "")
          : "Ошибка при отправке формы. Попробуйте позже."

        return NextResponse.json({ message: userMessage }, { status: pyrusResponse.status || 500 })
      }

      pyrusTaskId = String(responseData.task.id)
    }

    const dualWarnings: string[] = []
    const buildinFiles = buildinEnabled
      ? await collectBuildinFilesFromFormData(formData, dualWarnings)
      : []

    const dual = await recordAndDualWriteSubmission({
      formType: "catalog_upload",
      title: taskTitle,
      payload: { releases },
      artistNickname: releases[0]?.artists ?? null,
      pyrusTaskId,
      files: buildinFiles,
      idempotencySeed: uploadId || `catalog:${taskTitle}:${releases.length}`,
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
    if (error instanceof CatalogSubmitError) {
      catalogLog("submit_error", {
        code: error.code,
        ...error.logContext,
      })
      return NextResponse.json({ message: error.userMessage }, { status: error.httpStatus })
    }

    const message = error instanceof Error ? error.message : "Неизвестная ошибка сервера"
    catalogLog("internal_error", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        message:
          process.env.NODE_ENV === "development"
            ? `Ошибка при отправке формы: ${message}`
            : "Временная ошибка при отправке. Попробуйте позже.",
      },
      { status: 500 }
    )
  }
}
