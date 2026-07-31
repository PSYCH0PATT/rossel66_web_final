import {
  buildinAppendBlockChildren,
  buildinCreatePage,
  buildinUploadFileToPage,
} from "@/lib/buildin/client"
import {
  getBuildinDatabaseId,
  requireBuildinDatabaseId,
} from "@/lib/buildin/env"
import {
  emailProp,
  numberProp,
  relationProp,
  richText,
  selectProp,
  textProp,
  titleProp,
  urlProp,
  type FileMeta,
  type FormType,
} from "@/lib/buildin/types"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"
import {
  SUBMISSION_STATUS_LABELS,
  labelFor,
} from "@/lib/buildin/labels"

function truncateJson(value: unknown, max = 1800): string {
  const s = JSON.stringify(value)
  if (s.length <= max) return s
  return s.slice(0, max - 3) + "..."
}

const PII_FORM_TYPES = new Set<FormType>(["data_rf", "data_not_rf"])

/** Safe public snapshot for shared Заявки — no passport/bank fields. */
export function redactSubmissionPayloadForSharedInbox(
  formType: FormType,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (!PII_FORM_TYPES.has(formType)) return payload

  return {
    formType,
    nickname: payload.nickname ?? null,
    email: payload.email ?? null,
    telegramProfile: payload.telegramProfile ?? null,
    piiStoredIn: formType === "data_rf" ? "pii_rf" : "pii_not_rf",
    note: "PII fields are stored only in the closed PII database",
  }
}

export type PendingFileUpload = {
  fieldKey: string
  filename: string
  contentType: string
  bytes: Uint8Array
  /** Supabase staging path for retry replay */
  stagingPath?: string
}

export type CreateSubmissionInBuildinInput = {
  submissionId: string
  formType: FormType
  title: string
  contactEmail?: string | null
  contactTelegram?: string | null
  artistNickname?: string | null
  payload: Record<string, unknown>
  pyrusTaskId?: string | null
  files?: PendingFileUpload[]
  /** Expected file count for completion gating (may exceed files[] on partial retry) */
  expectedFileCount?: number
  adminLink?: string | null
  /** Exact local artist/release IDs when known — used for relation backfill only */
  artistLocalId?: string | null
  releaseLocalId?: string | null
}

/** Stable Buildin idempotency key for all create attempts of one submission. */
export function submissionIdempotencyKey(submissionId: string): string {
  return `submission:${submissionId}`
}

export async function createSubmissionInBuildin(
  input: CreateSubmissionInBuildinInput
): Promise<{
  pageId: string
  url?: string
  filesMeta: FileMeta[]
  filesComplete: boolean
}> {
  const dbId = requireBuildinDatabaseId("submissions")
  const existing = await getExternalId("submission", input.submissionId)
  const isPiiForm = PII_FORM_TYPES.has(input.formType)
  const safePayload = redactSubmissionPayloadForSharedInbox(
    input.formType,
    input.payload
  )
  const expectedFiles = input.expectedFileCount ?? input.files?.length ?? 0

  let pageId: string
  let pageUrl: string | undefined

  if (existing) {
    pageId = existing.buildinPageId
  } else {
    const properties: Record<string, unknown> = {
      Название: titleProp(input.title),
      Тип: selectProp(input.formType),
      Статус: selectProp(labelFor(SUBMISSION_STATUS_LABELS, "new")),
      "ID заявки": textProp(input.submissionId),
      Email: emailProp(input.contactEmail ?? null),
      Telegram: textProp(input.contactTelegram ?? ""),
      Артист: textProp(input.artistNickname ?? ""),
      "Pyrus Task ID": textProp(input.pyrusTaskId ?? ""),
      "Кол-во файлов": numberProp(expectedFiles),
      Источник: selectProp(input.pyrusTaskId ? "dual_write" : "site"),
    }

    if (!isPiiForm) {
      properties["Payload JSON"] = textProp(truncateJson(safePayload))
    } else {
      properties["Payload JSON"] = textProp(
        truncateJson({
          piiStoredIn: formTypePiiKey(input.formType),
          nickname: input.artistNickname ?? null,
        })
      )
    }

    if (input.adminLink) {
      properties["Admin Link"] = urlProp(input.adminLink)
    }

    if (input.artistLocalId) {
      properties["Artist Local ID"] = textProp(input.artistLocalId)
      const artistPage = await getExternalId("artist", input.artistLocalId)
      if (artistPage) {
        properties["АртистRel"] = relationProp([artistPage.buildinPageId])
      }
    }
    if (input.releaseLocalId) {
      properties["Release Local ID"] = textProp(input.releaseLocalId)
      const releasePage = await getExternalId("release", input.releaseLocalId)
      if (releasePage) {
        properties["РелизRel"] = relationProp([releasePage.buildinPageId])
      }
    }

    const children = isPiiForm
      ? [
          {
            type: "paragraph",
            paragraph: {
              rich_text: richText(
                "Персональные данные сохранены только в закрытой PII-базе. В общей заявке их нет."
              ),
            },
          },
        ]
      : [
          {
            type: "heading_2",
            heading_2: {
              rich_text: richText("Снимок заявки"),
            },
          },
          {
            type: "code",
            code: {
              language: "json",
              rich_text: richText(truncateJson(safePayload, 1900)),
            },
          },
        ]

    const page = await buildinCreatePage(
      {
        parent: { database_id: dbId },
        properties,
        children,
      },
      submissionIdempotencyKey(input.submissionId)
    )
    pageId = page.id
    pageUrl = page.url

    await upsertExternalId({
      entityType: "submission",
      localId: input.submissionId,
      buildinPageId: page.id,
      buildinDbKey: "submissions",
      submissionId: input.submissionId,
    })
  }

  const filesMeta: FileMeta[] = []
  // Sensitive PII form files go only to closed PII pages, not the shared inbox
  const filesForShared = isPiiForm ? [] : input.files ?? []

  for (const file of filesForShared) {
    const uploaded = await buildinUploadFileToPage({
      pageId,
      filename: file.filename,
      contentType: file.contentType,
      bytes: file.bytes,
    })

    await buildinAppendBlockChildren(pageId, [
      {
        type: "file",
        file: {
          type: "file",
          file: {
            oss_name: uploaded.oss_name,
            content_type: file.contentType,
            size: uploaded.size,
          },
          caption: richText(`${file.fieldKey}: ${file.filename}`),
        },
      },
    ])

    filesMeta.push({
      fieldKey: file.fieldKey,
      filename: file.filename,
      contentType: file.contentType,
      size: file.bytes.byteLength,
      buildinOssName: uploaded.oss_name,
      buildinFileUrl: uploaded.file_url ?? null,
      stagingPath: file.stagingPath ?? null,
    })
  }

  // PII closed databases
  if (input.formType === "data_rf" && getBuildinDatabaseId("pii_rf")) {
    await createPiiRfRecord(input)
  }
  if (input.formType === "data_not_rf" && getBuildinDatabaseId("pii_not_rf")) {
    await createPiiNotRfRecord(input)
  }

  const uploadedCount = filesMeta.filter((f) => f.buildinOssName).length
  const filesComplete =
    isPiiForm || expectedFiles === 0 || uploadedCount >= expectedFiles

  return {
    pageId,
    url: pageUrl,
    filesMeta,
    filesComplete,
  }
}

function formTypePiiKey(formType: FormType): string {
  return formType === "data_rf" ? "pii_rf" : "pii_not_rf"
}

async function createPiiRfRecord(input: CreateSubmissionInBuildinInput) {
  const existing = await getExternalId("pii_rf", input.submissionId)
  if (existing) return existing.buildinPageId

  const dbId = requireBuildinDatabaseId("pii_rf")
  const p = input.payload as Record<string, string>
  const properties: Record<string, unknown> = {
        Nickname: titleProp(p.nickname || input.artistNickname || input.title),
        "Submission ID": textProp(input.submissionId),
        Email: emailProp(p.email || input.contactEmail || null),
        Telegram: textProp(p.telegramProfile || ""),
        "Full Name": textProp(p.passportFullName || ""),
        "Short Name": textProp(p.passportShortName || ""),
        DOB: textProp(p.dateOfBirth || ""),
        Passport: textProp(p.passportSeriesNumber || ""),
        IssuedBy: textProp(p.passportIssuedBy || ""),
        IssueDate: textProp(p.passportIssueDate || ""),
        DeptCode: textProp(p.passportDepartmentCode || ""),
        "Place of Birth": textProp(p.placeOfBirth || ""),
        Address: textProp(p.registrationAddress || ""),
        SNILS: textProp(p.snils || ""),
        INN: textProp(p.inn || ""),
        Bank: textProp(p.bankName || ""),
        Account: textProp(p.bankAccountNumber || ""),
        CorrAccount: textProp(p.bankCorrespondentAccount || ""),
        BIK: textProp(p.bankBik || ""),
        BankINN: textProp(p.bankInn || ""),
        KPP: textProp(p.bankKpp || ""),
      }
  const submissionPage = await getExternalId("submission", input.submissionId)
  if (submissionPage) {
    properties["ЗаявкаRel"] = relationProp([submissionPage.buildinPageId])
  }
  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties,
    },
    `pii-rf:${input.submissionId}`
  )
  await upsertExternalId({
    entityType: "pii_rf",
    localId: input.submissionId,
    buildinPageId: page.id,
    buildinDbKey: "pii_rf",
    submissionId: input.submissionId,
  })
  return page.id
}

async function createPiiNotRfRecord(input: CreateSubmissionInBuildinInput) {
  const existing = await getExternalId("pii_not_rf", input.submissionId)
  if (existing) return existing.buildinPageId

  const dbId = requireBuildinDatabaseId("pii_not_rf")
  const p = input.payload as Record<string, string>
  const properties: Record<string, unknown> = {
        Nickname: titleProp(p.nickname || input.artistNickname || input.title),
        "Submission ID": textProp(input.submissionId),
        Email: emailProp(p.email || input.contactEmail || null),
        Telegram: textProp(p.telegramProfile || ""),
        Citizenship: textProp(
          [p.citizenship, p.otherCitizenship].filter(Boolean).join(" / ")
        ),
        "Full Name": textProp(p.passportFullName || ""),
        "Short Name": textProp(p.passportShortName || ""),
        DOB: textProp(p.dateOfBirth || ""),
        "Passport ID": textProp(p.passportIdNumber || ""),
        TaxID: textProp(p.taxId || ""),
        Address: textProp(p.registrationAddress || ""),
        Bank: textProp(p.bankName || ""),
        Account: textProp(p.bankAccountNumber || ""),
      }
  const submissionPage = await getExternalId("submission", input.submissionId)
  if (submissionPage) {
    properties["ЗаявкаRel"] = relationProp([submissionPage.buildinPageId])
  }
  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties,
    },
    `pii-not-rf:${input.submissionId}`
  )
  await upsertExternalId({
    entityType: "pii_not_rf",
    localId: input.submissionId,
    buildinPageId: page.id,
    buildinDbKey: "pii_not_rf",
    submissionId: input.submissionId,
  })
  return page.id
}
