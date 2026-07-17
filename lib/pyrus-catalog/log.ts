export type CatalogLogContext = {
  uploadId?: string | null
  releaseIndex?: number
  trackIndex?: number
  fieldId?: number
  fileName?: string
  fileSize?: number
  errorCode?: string
  [key: string]: unknown
}

export function catalogLog(event: string, context: CatalogLogContext = {}): void {
  console.error(
    JSON.stringify({
      scope: "pyrus-catalog",
      event,
      at: new Date().toISOString(),
      ...context,
    })
  )
}

export function catalogInfo(event: string, context: CatalogLogContext = {}): void {
  console.log(
    JSON.stringify({
      scope: "pyrus-catalog",
      level: "info",
      event,
      at: new Date().toISOString(),
      ...context,
    })
  )
}
