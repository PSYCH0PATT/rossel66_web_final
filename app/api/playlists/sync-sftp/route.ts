import { NextRequest, NextResponse } from "next/server"
import * as path from "path"
import { syncSftpPlaylists, getLatestCsvFile } from "@/lib/sftp-playlist-sync"
import { importPlaylistsFromCsvFile } from "@/lib/playlist-sftp-pipeline"
import { requireAdmin } from "@/lib/server-auth"

/**
 * GET /api/playlists/sync-sftp
 * Полный цикл: скачать новые CSV с SFTP → применить последний непустой CSV к БД.
 *
 * Query:
 * - cleanupRemoved=1 — удалить из БД плейлисты, которых нет в применённом CSV (осторожно).
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const startTime = Date.now()
  const cleanupRemoved = request.nextUrl.searchParams.get("cleanupRemoved") === "1"

  try {
    console.log("")
    console.log("═══════════════════════════════════════════════════")
    console.log("🔄 SFTP PLAYLIST SYNC (ручной запуск)")
    console.log("═══════════════════════════════════════════════════")
    console.log(`📅 Время запуска: ${new Date().toISOString()}`)
    console.log(`🧹 cleanupRemoved: ${cleanupRemoved}`)

    console.log("\n📥 Шаг 1: Синхронизация с SFTP сервером...")
    const syncResult = await syncSftpPlaylists()

    if (syncResult.errors.length > 0) {
      console.error("❌ Ошибки при синхронизации:", syncResult.errors)
    }

    console.log(`✅ Скачано новых файлов: ${syncResult.downloaded}`)
    console.log("🔄 Переходим к обработке файлов...")

    console.log("\n📊 Шаг 2: Обработка CSV файлов...")
    const latestFile = getLatestCsvFile()

    if (!latestFile) {
      console.log("⚠️  Последний CSV файл не найден — очистка не выполняется")
      const duration = Date.now() - startTime
      return NextResponse.json({
        success: true,
        message: "Последний CSV файл не найден",
        stats: {
          downloaded: syncResult.downloaded,
          processed: 0,
          added: 0,
          updated: 0,
          unchanged: 0,
          removed: 0,
        },
        duration: `${duration}ms`,
      })
    }

    console.log(`📄 Обрабатываю только последний файл: ${path.basename(latestFile)}`)

    const importResult = await importPlaylistsFromCsvFile(latestFile, {
      cleanupRemoved,
      markProcessedInIndex: true,
    })

    if (importResult.errors.length > 0) {
      console.error("❌ Ошибки при импорте:", importResult.errors)
    }

    const duration = Date.now() - startTime

    console.log("")
    console.log(`✅ Синхронизация завершена за ${duration}ms`)
    console.log("═══════════════════════════════════════════════════")

    return NextResponse.json({
      success: importResult.success,
      message: importResult.success
        ? "Синхронизация плейлистов завершена"
        : "Синхронизация завершена с ошибками",
      stats: {
        downloaded: syncResult.downloaded,
        processed: 1,
        added: importResult.added,
        updated: importResult.updated,
        unchanged: importResult.unchanged,
        removed: importResult.removed,
      },
      errors: importResult.errors,
      duration: `${duration}ms`,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("❌ SFTP Sync ошибка:", error)

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

export const runtime = "nodejs"
