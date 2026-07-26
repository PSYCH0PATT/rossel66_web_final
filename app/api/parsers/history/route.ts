import { NextRequest, NextResponse } from 'next/server';
import { isMissingParserRunTable, listParserRuns, recordParserRun } from '@/lib/parser-run-history';
import { requireAdminOrCron } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// GET: Получение истории парсинга
export async function GET(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;

  const parserType = request.nextUrl.searchParams.get('type') || 'all'; // 'bandlink', 'vk', 'all'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);

  try {
    const history = await listParserRuns({
      parserType,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    // История переехала в Postgres — до деплоя (prisma migrate deploy) таблицы нет.
    // Отдаём пустой список с понятной причиной, а не «непонятную ошибку».
    if (isMissingParserRunTable(error)) {
      console.warn('История парсинга: таблица ParserRun ещё не создана (нужна миграция).');
      return NextResponse.json({
        success: true,
        history: [],
        notice: 'История парсинга появится после применения миграций (деплой).',
      });
    }
    console.error('Ошибка получения истории парсинга:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения истории парсинга'
    }, { status: 500 });
  }
}

// POST: Создание записи истории парсинга
export async function POST(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { parserType, artists, playlistsFound = 0, playlistsAdded = 0, errors, status = 'completed' } = body;

    if (!parserType || !artists) {
      return NextResponse.json({
        success: false,
        error: 'parserType и artists обязательны'
      }, { status: 400 });
    }

    await recordParserRun({ parserType, artists, playlistsFound, playlistsAdded, errors, status });

    return NextResponse.json({
      success: true,
      message: 'История парсинга сохранена'
    });
  } catch (error) {
    console.error('Ошибка сохранения истории парсинга:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка сохранения истории парсинга'
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
