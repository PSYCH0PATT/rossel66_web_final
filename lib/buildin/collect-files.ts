import { BUILDIN_MAX_FILE_BYTES } from "@/lib/buildin/types"
import type { PendingFileUpload } from "@/lib/buildin/adapters/submissions"

/**
 * Collect File entries from FormData for Buildin upload.
 * Skips files over BUILDIN_MAX_FILE_BYTES (100 MB per file).
 */
export async function collectBuildinFilesFromFormData(
  formData: FormData,
  warnings: string[] = []
): Promise<PendingFileUpload[]> {
  const out: PendingFileUpload[] = []

  for (const [key, value] of formData.entries()) {
    if (!(value instanceof File)) continue
    if (!value.size) continue
    if (value.size > BUILDIN_MAX_FILE_BYTES) {
      warnings.push(
        `Файл ${value.name || key} (${Math.round(value.size / (1024 * 1024))} МБ) пропущен для Buildin: лимит 100 МБ на файл`
      )
      continue
    }
    const ab = await value.arrayBuffer()
    out.push({
      fieldKey: key,
      filename: value.name || key,
      contentType: value.type || "application/octet-stream",
      bytes: new Uint8Array(ab),
    })
  }

  return out
}
