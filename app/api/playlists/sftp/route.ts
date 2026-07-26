import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_TAKE, loadFormattedSftpPlaylists } from '@/lib/sftp-playlist-response';
import { requireAdmin } from '@/lib/server-auth';
import { jsonWithPerfLog } from '@/lib/api-perf-log';

export const dynamic = "force-dynamic"

/**
 * GET /api/playlists/sftp
 * Получает плейлисты из SFTP источника
 *
 * Query параметры:
 * - artistId: фильтр по ID артиста (опционально)
 * - artistName: фильтр по имени артиста (опционально)
 *
 * Сама загрузка/форматирование живёт в lib/sftp-playlist-response.ts, чтобы
 * серверный код (парсеры) вызывал её напрямую, а не self-fetch'ем (F-PARS-4).
 */
export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const pathname = request.nextUrl.pathname;

  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const sp = request.nextUrl.searchParams;
    const { results, count, total, take, skip, paginated } = await loadFormattedSftpPlaylists({
      artistId: sp.get('artistId'),
      artistName: sp.get('artistName'),
      q: sp.get('q'),
      platform: sp.get('platform'),
      take: Number(sp.get('take') || String(DEFAULT_TAKE)) || DEFAULT_TAKE,
      skip: Number(sp.get('skip') || '0') || 0,
    });

    return jsonWithPerfLog(pathname, startedAt, {
      success: true,
      results,
      count,
      total,
      take,
      skip,
      ...(paginated ? { paginated: true } : {}),
    });

  } catch (error) {
    console.error('Ошибка получения плейлистов из SFTP:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
