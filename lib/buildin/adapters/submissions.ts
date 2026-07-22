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
  richText,
  selectProp,
  textProp,
  titleProp,
  type FileMeta,
  type FormType,
} from "@/lib/buildin/types"
import { upsertExternalId } from "@/lib/buildin/outbox"

function truncateJson(value: unknown, max = 1800): string {
  const s = JSON.stringify(value)
  if (s.length <= max) return s
  return s.slice(0, max - 3) + "..."
}

export type PendingFileUpload = {
  fieldKey: string
  filename: string
  contentType: string
  bytes: Uint8Array
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
  idempotencyKey: string
}

export async function createSubmissionInBuildin(
  input: CreateSubmissionInBuildinInput
): Promise<{ pageId: string; url?: string; filesMeta: FileMeta[] }> {
  const dbId = requireBuildinDatabaseId("submissions")

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
        Название: titleProp(input.title),
        Тип: selectProp(input.formType),
        Статус: selectProp("new"),
        "ID заявки": textProp(input.submissionId),
        Email: emailProp(input.contactEmail ?? null),
        Telegram: textProp(input.contactTelegram ?? ""),
        Артист: textProp(input.artistNickname ?? ""),
        "Pyrus Task ID": textProp(input.pyrusTaskId ?? ""),
        "Payload JSON": textProp(truncateJson(input.payload)),
        "Кол-во файлов": numberProp(input.files?.length ?? 0),
        Источник: selectProp(input.pyrusTaskId ? "dual_write" : "site"),
      },
      children: [
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
            rich_text: richText(truncateJson(input.payload, 1900)),
          },
        },
      ],
    },
    `submission:${input.idempotencyKey}`
  )

  const filesMeta: FileMeta[] = []
  for (const file of input.files ?? []) {
    const uploaded = await buildinUploadFileToPage({
      pageId: page.id,
      filename: file.filename,
      contentType: file.contentType,
      bytes: file.bytes,
    })

    await buildinAppendBlockChildren(page.id, [
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
    })
  }

  // PII closed databases
  if (input.formType === "data_rf" && getBuildinDatabaseId("pii_rf")) {
    await createPiiRfRecord(input)
  }
  if (input.formType === "data_not_rf" && getBuildinDatabaseId("pii_not_rf")) {
    await createPiiNotRfRecord(input)
  }

  await upsertExternalId({
    entityType: "submission",
    localId: input.submissionId,
    buildinPageId: page.id,
    buildinDbKey: "submissions",
    submissionId: input.submissionId,
  })

  return { pageId: page.id, url: page.url, filesMeta }
}

async function createPiiRfRecord(input: CreateSubmissionInBuildinInput) {
  const dbId = requireBuildinDatabaseId("pii_rf")
  const p = input.payload as Record<string, string>
  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
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
        "Payload JSON": textProp(truncateJson(input.payload)),
      },
    },
    `pii-rf:${input.idempotencyKey}`
  )
  await upsertExternalId({
    entityType: "pii_rf",
    localId: input.submissionId,
    buildinPageId: page.id,
    buildinDbKey: "pii_rf",
    submissionId: input.submissionId,
  })
}

async function createPiiNotRfRecord(input: CreateSubmissionInBuildinInput) {
  const dbId = requireBuildinDatabaseId("pii_not_rf")
  const p = input.payload as Record<string, string>
  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: {
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
        "Payload JSON": textProp(truncateJson(input.payload)),
      },
    },
    `pii-not-rf:${input.idempotencyKey}`
  )
  await upsertExternalId({
    entityType: "pii_not_rf",
    localId: input.submissionId,
    buildinPageId: page.id,
    buildinDbKey: "pii_not_rf",
    submissionId: input.submissionId,
  })
}
