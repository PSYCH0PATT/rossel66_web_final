import { NextRequest, NextResponse } from 'next/server';

// Секрет для авторизации cron запросов
const CRON_SECRET = process.env.CRON_SECRET || 'zvonko-parser-secret-2024';

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
    
    if (providedSecret !== CRON_SECRET) {
      console.log('❌ Cron Zvonko: Неверный секрет авторизации');
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
      }
    });
    
    const result = await response.json();
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Cron Zvonko: Парсинг завершен за ${duration}ms`);
      console.log(`   Статистика: добавлено ${result.stats?.added || 0}, обновлено ${result.stats?.updated || 0}`);
      
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
        error: result.error,
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
