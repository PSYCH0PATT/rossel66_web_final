import { NextRequest, NextResponse } from 'next/server'
import { aggregateAndCleanup } from '@/lib/flash-storage'
import { addActivity } from '@/lib/storage'
import { isCronAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/analytics-cleanup
 * Cron задача: годовая очистка данных аналитики.
 * Агрегирует дневные записи за прошлый год по месяцам, затем удаляет дневные.
 *
 * Расписание: 1 января в 00:00 МСК
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log('🧹 ANALYTICS YEARLY CLEANUP')
    console.log('═══════════════════════════════════════════════════')
    console.log(`📅 Время запуска: ${new Date().toISOString()}`)

    const result = await aggregateAndCleanup()
    const duration = Date.now() - startTime

    // Логируем активность
    await addActivity({
      type: 'analytics_cleanup',
      userId: 'system',
      userRole: 'admin',
      title: 'Годовая очистка аналитики',
      description: `Создано ${result.aggregated} агрегатов по месяцам, удалено ${result.deleted} дневных записей`,
      metadata: {
        aggregated: result.aggregated,
        deleted: result.deleted,
        errors: result.errors,
        duration: `${duration}ms`,
      },
    })

    console.log('═══════════════════════════════════════════════════')
    console.log(`✅ Очистка завершена за ${duration}ms`)
    console.log('═══════════════════════════════════════════════════')

    return NextResponse.json({
      success: true,
      message: `Очистка завершена: ${result.aggregated} агрегатов, ${result.deleted} удалено`,
      stats: result,
      duration: `${duration}ms`,
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ Analytics cleanup error:', error)

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error),
      duration: `${duration}ms`,
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
