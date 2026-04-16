import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { requireAdmin } from "@/lib/server-auth"
import {
  downloadLatestCsvFromSftp,
  listLocalPlaylistCsvFiles,
  syncSftpPlaylists,
} from "@/lib/sftp-playlist-sync"
import { importPlaylistsFromCsvFile } from "@/lib/playlist-sftp-pipeline"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DOWNLOADS_DIR = path.join(process.cwd(), "sftp_downloads")

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024

function safeCsvBasename(raw: string): string | null {
  const t = raw.trim()
  if (!t.toLowerCase().endsWith(".csv")) return null
  const norm = t.replace(/\\/g, "/")
  const base = path.basename(norm)
  if (base !== norm) return null
  if (base.includes("..")) return null
  if (!/^[^/\\]+\.csv$/i.test(base)) return null
  return base
}

/** GET: список локальных CSV + подсказки по env (без секретов). */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const files = listLocalPlaylistCsvFiles()
  return NextResponse.json({
    success: true,
    files,
    hints: {
      host: process.env.SFTP_HOST || "sftp1.sp-digital.ru",
      remotePath: process.env.SFTP_REMOTE_PATH || "rossel_playlist",
    },
  })
}

type JsonBody =
  | { op: "download_new" }
  | { op: "download_latest" }
  | { op: "apply"; filename: string; cleanupRemoved?: boolean }

/** POST: операции SFTP / применение CSV (только админ). */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const ct = request.headers.get("content-type") || ""

  if (ct.includes("multipart/form-data")) {
    let form: FormData
    try {
      form = await request.formData()
    } catch (e: any) {
      return NextResponse.json({ success: false, error: "Некорректный multipart" }, { status: 400 })
    }
    const file = form.get("file")
    const cleanupRaw = form.get("cleanupRemoved")
    const cleanupRemoved = cleanupRaw === "true" || cleanupRaw === "1"

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: "Нужно поле file" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: "Файл слишком большой (макс. 40 МБ)" }, { status: 400 })
    }

    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    }
    const name = `upload_${Date.now()}.csv`
    const dest = path.join(DOWNLOADS_DIR, name)
    const buf = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(dest, buf)

    const result = await importPlaylistsFromCsvFile(dest, {
      cleanupRemoved,
      markProcessedInIndex: false,
    })

    return NextResponse.json({
      success: result.success,
      op: "upload",
      savedAs: name,
      import: result,
    })
  }

  let body: JsonBody
  try {
    body = (await request.json()) as JsonBody
  } catch {
    return NextResponse.json({ success: false, error: "Ожидался JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || !("op" in body)) {
    return NextResponse.json({ success: false, error: "Нужно поле op" }, { status: 400 })
  }

  if (body.op === "download_new") {
    const syncResult = await syncSftpPlaylists()
    return NextResponse.json({
      success: syncResult.errors.length === 0,
      op: "download_new",
      downloaded: syncResult.downloaded,
      files: syncResult.files.map((f) => path.basename(f)),
      errors: syncResult.errors,
    })
  }

  if (body.op === "download_latest") {
    const r = await downloadLatestCsvFromSftp()
    return NextResponse.json({
      success: r.ok && r.errors.length === 0,
      op: "download_latest",
      localPath: r.localPath,
      filename: r.filename,
      errors: r.errors,
    })
  }

  if (body.op === "apply") {
    const name = safeCsvBasename(body.filename)
    if (!name) {
      return NextResponse.json({ success: false, error: "Некорректное имя CSV" }, { status: 400 })
    }
    const abs = path.join(DOWNLOADS_DIR, name)
    if (!fs.existsSync(abs)) {
      return NextResponse.json(
        { success: false, error: `Файл не найден: ${name}` },
        { status: 404 }
      )
    }
    const cleanupRemoved = Boolean(body.cleanupRemoved)
    const result = await importPlaylistsFromCsvFile(abs, {
      cleanupRemoved,
      markProcessedInIndex: true,
    })
    return NextResponse.json({
      success: result.success,
      op: "apply",
      import: result,
    })
  }

  return NextResponse.json({ success: false, error: "Неизвестный op" }, { status: 400 })
}
