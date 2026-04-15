import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Секрет для авторизации cron запросов (ОБЯЗАТЕЛЬНО установите в переменных окружения!)
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.warn('⚠️ CRON_SECRET не установлен! Cron endpoints будут недоступны.');
}

/**
 * GET /api/cron/zvonko
 * Cron endpoint для автоматического запуска парсера Zvonko
 * Расписание: 0 14 * * * (14:00 каждый день)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.nextUrl.searchParams.get('secret');

    // Проверяем секрет (через заголовок или query параметр)
    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecret;

    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      console.log('❌ Cron Zvonko: Неверный секрет авторизации или CRON_SECRET не настроен');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    console.log('🚀 Cron Zvonko: Запуск парсера...');

    // Определяем базовый URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
      'http://localhost:3000';

    // Вызываем API парсера
    const response = await fetch(`${baseUrl}/api/zvonko-parser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'parse',
        pagesToParse: 1  // Для автоматического запуска парсим только 1 страницу
      })
    });

    const duration = Date.now() - startTime;

    // Проверяем статус ответа
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ Cron Zvonko: HTTP ошибка ${response.status}: ${errorText}`);

      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration: `${duration}ms`
      }, { status: response.status });
    }

    // Парсим JSON с обработкой ошибок
    let result;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from API');
      }
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Cron Zvonko: Ошибка парсинга JSON ответа:', parseError);
      const responseText = await response.text().catch(() => 'Could not read response');
      console.error('   Ответ API:', responseText.substring(0, 500));

      return NextResponse.json({
        success: false,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        duration: `${duration}ms`
      }, { status: 500 });
    }

    if (result.success) {
      console.log(`✅ Cron Zvonko: Парсинг завершен за ${duration}ms`);
      console.log(`   Статистика: найдено ${result.stats?.total || 0}, добавлено ${result.stats?.added || 0}, обновлено ${result.stats?.updated || 0}`);

      return NextResponse.json({
        success: true,
        message: 'Cron парсинг завершен успешно',
        stats: result.stats,
        duration: `${duration}ms`
      });
    } else {
      console.log(`❌ Cron Zvonko: Ошибка парсинга - ${result.error}`);

      return NextResponse.json({
        success: false,
        error: result.error || 'Unknown error',
        stats: result.stats,
        duration: `${duration}ms`
      }, { status: 500 });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Cron Zvonko: Критическая ошибка:', error);

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error),
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

// Используем Node.js runtime
export const runtime = 'nodejs';

// Расписание (для node-cron в lib/scheduler.ts):
// - 14:00 по Москве ежедневно
