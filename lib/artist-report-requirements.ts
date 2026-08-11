/** Поля User в Supabase, обязательные для генерации Excel-отчёта. */
export type ArtistReportRequiredField = "fio" | "contract" | "percentage"

export const ARTIST_REPORT_REQUIRED_FIELDS: ArtistReportRequiredField[] = [
  "fio",
  "contract",
  "percentage",
]

export const ARTIST_REPORT_FIELD_LABELS: Record<ArtistReportRequiredField, string> = {
  fio: "ФИО",
  contract: "Номер договора",
  percentage: "Процент",
}

export function isEmptyReportValue(value: string | null | undefined): boolean {
  if (value == null) return true
  const trimmed = value.trim()
  return trimmed === "" || trimmed === "-"
}

export function getArtistReportMissingFields(artist: {
  fio?: string | null
  contract?: string | null
  percentage?: number | null
}): ArtistReportRequiredField[] {
  const missing: ArtistReportRequiredField[] = []
  if (isEmptyReportValue(artist.fio)) missing.push("fio")
  if (isEmptyReportValue(artist.contract)) missing.push("contract")
  // I6: 0% — тоже «не заполнено» (для отчёта нужен положительный процент)
  if (artist.percentage == null || artist.percentage <= 0) {
    missing.push("percentage")
  }
  return missing
}

export type IncompleteReportArtist = {
  id: string
  name: string
  username: string
  missingFields: ArtistReportRequiredField[]
}
