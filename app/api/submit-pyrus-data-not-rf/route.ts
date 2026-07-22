import { NextResponse } from "next/server"
import { getPyrusApiKey, getPyrusAccessToken } from "@/lib/pyrus"
import {
  guardPublicFormRateLimit,
  pyrusDataNotRfSchema,
} from "@/lib/pyrus-public-schemas"
import {
  isBuildinDualWriteEnabled,
  isPyrusWriteDisabled,
} from "@/lib/buildin/env"
import { recordAndDualWriteSubmission } from "@/lib/buildin/dual-write"

const PYRUS_FORM_ID = 1554517

interface FormDataNotRF {
  nickname: string
  telegramProfile: string
  email: string
  citizenship: string
  otherCitizenship?: string
  passportFullName: string
  passportShortName: string
  dateOfBirth: string
  passportIdNumber: string
  passportIssuedBy?: string
  passportDepartmentCode?: string
  passportIssueDate?: string
  placeOfBirth: string
  registrationAddress: string
  taxId?: string
  bankName: string
  bankAccountNumber: string
  bankCorrespondentAccount?: string
  bankBik?: string
  bankInn?: string
  bankKpp?: string
}

export async function POST(request: Request) {
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
    const rawBody: unknown = await request.json().catch(() => null)
    const validated = pyrusDataNotRfSchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json(
        { message: "Некорректные поля формы.", details: validated.error.flatten() },
        { status: 400 }
      )
    }
    const formData = validated.data as FormDataNotRF

    let taskTitle = `Заявка (НЕ РФ) от ${formData.nickname || formData.email || "Новый пользователь"}`
    if (formData.email && formData.nickname) {
      taskTitle = `Заявка (НЕ РФ) от ${formData.nickname} (${formData.email})`
    }

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
        return NextResponse.json({ message: "Ошибка аутентификации Pyrus." }, { status: 500 })
      }

      const fields = [
        { id: 1, value: formData.nickname },
        { id: 2, value: formData.telegramProfile },
        { id: 24, value: formData.email },
        { id: 25, value: { choice_id: parseInt(formData.citizenship, 10) } },
        ...(formData.citizenship === "16" && formData.otherCitizenship
          ? [{ id: 26, value: formData.otherCitizenship }]
          : []),
        { id: 5, value: formData.passportFullName },
        { id: 6, value: formData.passportShortName },
        { id: 7, value: formData.dateOfBirth },
        { id: 8, value: formData.passportIdNumber },
        { id: 9, value: formData.passportIssuedBy || null },
        { id: 10, value: formData.passportDepartmentCode || null },
        { id: 11, value: formData.passportIssueDate || null },
        { id: 12, value: formData.placeOfBirth },
        { id: 13, value: formData.registrationAddress },
        { id: 15, value: formData.taxId || null },
        { id: 17, value: formData.bankName },
        { id: 18, value: formData.bankAccountNumber },
        { id: 19, value: formData.bankCorrespondentAccount || null },
        { id: 20, value: formData.bankBik || null },
        { id: 21, value: formData.bankInn || null },
        { id: 22, value: formData.bankKpp || null },
      ]

      const pyrusResponse = await fetch("https://api.pyrus.com/v4/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form_id: PYRUS_FORM_ID,
          fields: fields.filter(
            (f) => f.value !== null && f.value !== undefined && f.value !== ""
          ),
          text: taskTitle,
        }),
      })

      const responseData = await pyrusResponse.json()
      if (!(pyrusResponse.ok && responseData?.task?.id)) {
        console.error("Pyrus API error (creating task НЕ РФ):", responseData)
        if (responseData.error_code === "invalid_value_format") {
          return NextResponse.json(
            { message: "Проверьте формат заполненных полей (номер документа, налоговый ID)." },
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

    const dual = await recordAndDualWriteSubmission({
      formType: "data_not_rf",
      title: taskTitle,
      payload: formData as unknown as Record<string, unknown>,
      contactEmail: formData.email,
      contactTelegram: formData.telegramProfile,
      artistNickname: formData.nickname,
      pyrusTaskId,
      idempotencySeed: `data_not_rf:${formData.email}:${formData.nickname}:${formData.passportIdNumber}`,
    })

    return NextResponse.json({
      message: "Форма успешно отправлена",
      taskId: pyrusTaskId,
      submissionId: dual.submissionId,
      buildinPageId: dual.buildinPageId,
      warnings: dual.warnings.length ? dual.warnings : undefined,
    })
  } catch (error) {
    console.error("Error processing Pyrus submission:", error)
    const errorDetails = error instanceof Error ? error.message : "Неизвестная ошибка сервера"
    return NextResponse.json(
      { message: "Ошибка при отправке формы", details: errorDetails },
      { status: 500 }
    )
  }
}
