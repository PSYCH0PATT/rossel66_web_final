import { getPyrusErrorMessage } from "@/lib/pyrus"
import { getCatalogFieldName } from "./field-map"

export type CatalogErrorCode =
  | "file_upload_failed"
  | "file_missing"
  | "file_too_large"
  | "validation_failed"
  | "pyrus_api_error"
  | "pyrus_auth_failed"
  | "too_many_releases"
  | "internal_error"

export class CatalogSubmitError extends Error {
  readonly code: CatalogErrorCode
  readonly userMessage: string
  readonly logContext: Record<string, unknown>
  readonly httpStatus: number

  constructor(opts: {
    code: CatalogErrorCode
    userMessage: string
    logContext?: Record<string, unknown>
    httpStatus?: number
    cause?: unknown
  }) {
    super(opts.userMessage, { cause: opts.cause })
    this.name = "CatalogSubmitError"
    this.code = opts.code
    this.userMessage = opts.userMessage
    this.logContext = opts.logContext ?? {}
    this.httpStatus = opts.httpStatus ?? 400
  }
}

export function formatZodIssuesForUser(
  issues: Array<{ path: PropertyKey[]; message: string }>
): string {
  const first = issues[0]
  if (!first) return "Проверьте заполнение формы."
  const segments = first.path.map(String)
  if (segments.length >= 1 && /^\d+$/.test(segments[0])) {
    return `Релиз ${parseInt(segments[0], 10) + 1}: ${first.message}`
  }
  const relIdx = segments.indexOf("releases")
  if (relIdx >= 0 && segments[relIdx + 1] != null && /^\d+$/.test(segments[relIdx + 1])) {
    return `Релиз ${parseInt(segments[relIdx + 1], 10) + 1}: ${first.message}`
  }
  return first.message
}

export function mapPyrusApiErrorToUserMessage(
  errorCode: string | undefined,
  originalError: string,
  releaseIndexHint?: number
): string {
  const base = errorCode
    ? getPyrusErrorMessage(errorCode, originalError)
    : "Ошибка при отправке формы."

  const fieldMatch = originalError.match(/field with id (\d+)/i)
  const fieldId = fieldMatch ? parseInt(fieldMatch[1], 10) : null
  const fieldName = fieldId != null ? getCatalogFieldName(fieldId) : null

  if (releaseIndexHint != null && fieldName) {
    return `Релиз ${releaseIndexHint + 1}: ${base.replace(/поле:?/i, "").trim()} (${fieldName}).`
  }
  if (fieldName && !base.includes(fieldName)) {
    return `${base} (${fieldName})`
  }
  return base
}

export function fileUploadUserMessage(releaseIndex: number, fileName: string): string {
  return `Не удалось загрузить файл «${fileName}» для релиза ${releaseIndex + 1}. Попробуйте снова или уменьшите размер файла.`
}

export const CATALOG_MAX_FILE_BYTES = 150 * 1024 * 1024

export function fileTooLargeUserMessage(fileName: string, maxMb: number): string {
  return `Файл «${fileName}» слишком большой (максимум ${maxMb} МБ).`
}
