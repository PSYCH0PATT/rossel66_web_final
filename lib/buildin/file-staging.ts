import { ensureBucketExists, supabase } from "@/lib/supabase"
import type { PendingFileUpload } from "@/lib/buildin/adapters/submissions"
import type { FileMeta } from "@/lib/buildin/types"

export const BUILDIN_STAGING_BUCKET = "buildin-staging"

/**
 * Stage submission file bytes in Supabase Storage so outbox retry can replay uploads.
 */
export async function stageSubmissionFiles(
  submissionId: string,
  files: PendingFileUpload[]
): Promise<PendingFileUpload[]> {
  if (files.length === 0) return files
  await ensureBucketExists(BUILDIN_STAGING_BUCKET, false, 100 * 1024 * 1024)

  const staged: PendingFileUpload[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const safeName = file.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120)
    const path = `${submissionId}/${i}-${safeName}`
    const { error } = await supabase.storage
      .from(BUILDIN_STAGING_BUCKET)
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      })
    if (error) {
      throw new Error(`Staging upload failed for ${file.filename}: ${error.message}`)
    }
    staged.push({ ...file, stagingPath: path })
  }
  return staged
}

export async function downloadStagedSubmissionFiles(
  filesMeta: FileMeta[]
): Promise<PendingFileUpload[]> {
  const out: PendingFileUpload[] = []
  for (const meta of filesMeta) {
    if (!meta.stagingPath) continue
    if (meta.buildinOssName) continue // already uploaded to Buildin
    const { data, error } = await supabase.storage
      .from(BUILDIN_STAGING_BUCKET)
      .download(meta.stagingPath)
    if (error || !data) {
      throw new Error(
        `Staging download failed for ${meta.filename}: ${error?.message || "empty"}`
      )
    }
    const ab = await data.arrayBuffer()
    out.push({
      fieldKey: meta.fieldKey,
      filename: meta.filename,
      contentType: meta.contentType,
      bytes: new Uint8Array(ab),
      stagingPath: meta.stagingPath,
    })
  }
  return out
}
