import { NextResponse } from "next/server"
import { getPyrusAccessToken } from "@/lib/pyrus"
import {
  guardPublicFormRateLimit,
  pyrusDataRfSchema,
} from "@/lib/pyrus-public-schemas"
import {
  isBuildinDualWriteEnabled,
  isPyrusWriteDisabled,
} from "@/lib/buildin/env"
import { recordAndDualWriteSubmission } from "@/lib/buildin/dual-write"
import { legacyPyrusFormGoneBody } from "@/lib/buildin/legacy-form-cutover"

interface FormDataRF {
  nickname: string
  telegramProfile: string
  email: string
  passportFullName: string
  passportShortName: string
  dateOfBirth: string
  passportSeriesNumber: string
  passportIssuedBy: string
  passportIssueDate: string
  passportDepartmentCode: string
  placeOfBirth: string
  registrationAddress: string
  snils: string
  inn: string
  bankName: string
  bankAccountNumber: string
  bankCorrespondentAccount: string
  bankBik: string
  bankInn: string
  bankKpp: string
}

const PYRUS_FIELD_IDS = {
  nickname: "1",
  telegramProfile: "2",
  email: "24",
  passportFullName: "6",
  passportShortName: "7",
  dateOfBirth: "8",
  passportSeriesNumber: "9",
  passportIssuedBy: "10",
  passportIssueDate: "11",
  passportDepartmentCode: "13",
  placeOfBirth: "12",
  registrationAddress: "14",
  snils: "15",
  inn: "16",
  bankName: "18",
  bankAccountNumber: "19",
  bankCorrespondentAccount: "20",
  bankBik: "21",
  bankInn: "22",
  bankKpp: "23",
}

const PYRUS_FORM_ID = 1553991

export async function POST(request: Request) {
  try {
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

    if (pyrusDisabled && buildinEnabled) {
      return NextResponse.json(legacyPyrusFormGoneBody, { status: 410 })
    }

    const rawBody: unknown = await request.json().catch(() => null)
    const validated = pyrusDataRfSchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json(
        { message: "Некорректные поля формы.", details: validated.error.flatten() },
        { status: 400 }
      )
    }
    const formData = validated.data as FormDataRF

    let taskTitle = `Заявка от ${formData.nickname || formData.passportShortName || "Новый пользователь"}`
    if (formData.email) taskTitle += ` (${formData.email})`

    let pyrusTaskId: string | null = null

    if (!pyrusDisabled) {
      const accessToken = await getPyrusAccessToken()
      if (!accessToken) {
        return NextResponse.json(
          { message: "Pyrus не настроен: задайте PYRUS_LOGIN и PYRUS_API_KEY в окружении." },
          { status: 500 }
        )
      }

      const pyrusFields = Object.entries(formData)
        .map(([key, value]) => {
          const fieldId = PYRUS_FIELD_IDS[key as keyof typeof PYRUS_FIELD_IDS]
          if (fieldId && value) return { id: fieldId, value }
          return null
        })
        .filter((field): field is { id: string; value: string } => field !== null)

      if (pyrusFields.length === 0) {
        return NextResponse.json(
          { message: "Нет данных для отправки в Pyrus. Проверьте конфигурацию ID полей." },
          { status: 400 }
        )
      }

      const taskResponse = await fetch("https://api.pyrus.com/v4/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          form_id: PYRUS_FORM_ID,
          fields: pyrusFields,
          text: taskTitle,
        }),
      })

      const responseData = await taskResponse.json()
      if (!(taskResponse.ok && responseData?.task?.id)) {
        console.error("Pyrus API error (creating task):", responseData)
        if (responseData.error_code === "invalid_value_format") {
          return NextResponse.json(
            { message: "Проверьте формат заполненных полей (серия/номер паспорта, ИНН, СНИЛС)." },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { message: "Ошибка при отправке формы", details: responseData },
          { status: taskResponse.status }
        )
      }
      pyrusTaskId = String(responseData.task.id)
    }

    const dual = await recordAndDualWriteSubmission({
      formType: "data_rf",
      title: taskTitle,
      payload: formData as unknown as Record<string, unknown>,
      contactEmail: formData.email,
      contactTelegram: formData.telegramProfile,
      artistNickname: formData.nickname,
      pyrusTaskId,
      idempotencySeed: `data_rf:${formData.email}:${formData.nickname}:${formData.passportSeriesNumber}`,
    })

    return NextResponse.json({
      message: "Форма успешно отправлена",
      taskId: pyrusTaskId,
      submissionId: dual.submissionId,
      buildinPageId: dual.buildinPageId,
      warnings: dual.warnings.length ? dual.warnings : undefined,
    })
  } catch (error: unknown) {
    console.error("Error processing RF form submission:", error)
    const message = error instanceof Error ? error.message : "Неизвестная ошибка сервера"
    return NextResponse.json({ message: "Ошибка при отправке формы", details: message }, { status: 500 })
  }
}
