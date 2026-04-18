import { NextRequest, NextResponse } from 'next/server'
import { parseFlashCSVFromBuffer } from '@/lib/flash-parser'
import { saveFlashRecords } from '@/lib/flash-storage'
import { requireAdmin } from '@/lib/server-auth'

/**
 * POST /api/analytics/import-flash
 * Ручной импорт CSV файла из rossel_flash.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'Файл не указан' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ success: false, error: 'Файл должен быть в формате CSV' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const records = parseFlashCSVFromBuffer(buffer)

    if (records.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'CSV файл пуст или не содержит валидных данных'
      }, { status: 400 })
    }

    const result = await saveFlashRecords(records)

    return NextResponse.json({
      success: true,
      message: `Импортировано ${result.added} записей, пропущено ${result.skipped} дубликатов`,
      stats: {
        parsed: records.length,
        added: result.added,
        skipped: result.skipped,
        errors: result.errors,
      }
    })

  } catch (error) {
    console.error('❌ Ошибка импорта flash CSV:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: String(error),
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
