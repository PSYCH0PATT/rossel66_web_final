import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/analytics-cleanup
 *
 * Годовая агрегация/очистка аналитики ОТКЛЮЧЕНА (решение C2): храним все дневные
 * данные, месячные агрегаты не создаём. Эндпоинт оставлен как no-op для обратной
 * совместимости (планировщик/внешние вызовы не должны падать).
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    disabled: true,
    message: 'Агрегация аналитики отключена — все дневные данные сохраняются',
  })
}

export const runtime = 'nodejs'
