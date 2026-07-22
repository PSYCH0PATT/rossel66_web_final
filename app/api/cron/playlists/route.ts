import { NextRequest, NextResponse } from 'next/server';
import { addActivity } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { releaseFromPrisma } from '@/lib/storage-adapters';
import { isCronAuthorized, internalCronFetchJsonHeaders } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/playlists
 * Cron endpoint для автоматического парсинга плейлистов
 * 
 * Расписание (по Москве):
 * - Пятница 00:30 — первый скан после выхода релизов
 * - Суббота 16:00 — второй скан
 * - Воскресенье 16:00 — третий скан
 * - Понедельник 16:00 — четвертый скан
 * 
 * Логика:
 * 1. Находит артистов с релизами за последние 7 дней
 * 2. Запускает Bandlink и VK парсеры для этих артистов
 * 3. Добавляет только новые плейлисты (дубликаты игнорируются БД)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const source = request.nextUrl.searchParams.get('source'); // 'parser' для ручного парсинга

    if (!isCronAuthorized(request)) {
      console.log('❌ Cron Playlists: Неверный секрет авторизации или CRON_SECRET не настроен');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Проверяем, использовать ли SFTP синхронизацию (по умолчанию) или парсинг
    const useSftpSync = process.env.USE_SFTP_SYNC !== 'false' && source !== 'parser';

    if (useSftpSync) {
      // Перенаправляем на SFTP синхронизацию
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

      try {
        const sftpResponse = await fetch(`${baseUrl}/api/cron/playlists-sftp`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        });

        const sftpResult = await sftpResponse.json();
        return NextResponse.json(sftpResult);
      } catch (error) {
        console.error('Ошибка при вызове SFTP синхронизации:', error);
        return NextResponse.json({
          success: false,
          error: 'Ошибка SFTP синхронизации',
          details: String(error)
        }, { status: 500 });
      }
    }

    // Используем старый парсинг (только если явно запрошен или USE_SFTP_SYNC=false)
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎵 CRON PLAYLIST PARSER (Legacy)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📅 Время запуска: ${new Date().toISOString()}`);

    // Находим артистов с недавними релизами
    const artistsToScan = await getArtistsWithRecentReleases();

    if (artistsToScan.length === 0) {
      console.log('📭 Нет артистов с недавними релизами для сканирования');
      return NextResponse.json({
        success: true,
        message: 'Нет артистов с недавними релизами',
        artists: [],
        duration: `${Date.now() - startTime}ms`
      });
    }

    console.log(`👥 Найдено артистов для сканирования: ${artistsToScan.length}`);
    artistsToScan.forEach(a => {
      console.log(`   • ${a.name} (@${a.username}) — релиз: ${a.recentRelease}`);
    });

    // Определяем базовый URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const results = {
      bandlink: { success: false, count: 0, error: null as string | null },
      vk: { success: false, count: 0, error: null as string | null }
    };

    // Запускаем Bandlink парсер
    console.log('');
    console.log('🔗 Запуск Bandlink парсера...');
    try {
      const bandlinkResponse = await fetch(`${baseUrl}/api/parsers/bandlink`, {
        method: 'POST',
        headers: internalCronFetchJsonHeaders(),
        body: JSON.stringify({
          artists: artistsToScan.map(a => a.username)
        })
      });

      const bandlinkResult = await bandlinkResponse.json();
      results.bandlink.success = bandlinkResult.success;
      results.bandlink.count = bandlinkResult.results?.length || 0;

      if (!bandlinkResult.success) {
        results.bandlink.error = bandlinkResult.error;
        console.log(`❌ Bandlink: ${bandlinkResult.error}`);
      } else {
        console.log(`✅ Bandlink: найдено ${results.bandlink.count} плейлистов`);
      }
    } catch (error) {
      results.bandlink.error = String(error);
      console.log(`❌ Bandlink ошибка: ${error}`);
    }

    // Запускаем VK парсер
    console.log('');
    console.log('🎵 Запуск VK парсера...');
    try {
      const vkResponse = await fetch(`${baseUrl}/api/parsers/vk`, {
        method: 'POST',
        headers: internalCronFetchJsonHeaders(),
        body: JSON.stringify({
          artists: artistsToScan.map(a => a.username)
        })
      });

      const vkResult = await vkResponse.json();
      results.vk.success = vkResult.success;
      results.vk.count = vkResult.results?.length || 0;

      if (!vkResult.success) {
        results.vk.error = vkResult.error;
        console.log(`❌ VK: ${vkResult.error}`);
      } else {
        console.log(`✅ VK: найдено ${results.vk.count} плейлистов`);
      }
    } catch (error) {
      results.vk.error = String(error);
      console.log(`❌ VK ошибка: ${error}`);
    }

    const duration = Date.now() - startTime;

    // Логируем активность
    await addActivity({
      type: 'playlist_found',
      userId: 'system',
      userRole: 'admin',
      title: 'Автоматический парсинг плейлистов',
      description: `Сканирование ${artistsToScan.length} артистов. Bandlink: ${results.bandlink.count}, VK: ${results.vk.count}`,
      metadata: {
        artists: artistsToScan.map(a => a.username),
        results,
        duration: `${duration}ms`
      }
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Парсинг завершен за ${duration}ms`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Cron парсинг плейлистов завершен',
      artists: artistsToScan.map(a => ({ name: a.name, username: a.username, release: a.recentRelease })),
      results,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Cron Playlists: Критическая ошибка:', error);

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error),
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

/**
 * Находит артистов с релизами за последние 7 дней
 * Релизы выходят в ночь с четверга на пятницу (00:00 пятницы)
 */
async function getArtistsWithRecentReleases(): Promise<Array<{
  id: string;
  username: string;
  name: string;
  recentRelease: string;
}>> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const raw = await prisma.release.findMany({
    where: {
      releaseDate: { gte: weekAgoStr, lte: nowStr },
    },
    orderBy: { createdAt: "desc" },
  });
  const recentReleases = raw.map(releaseFromPrisma);

  const artistIdSet = new Set<string>();
  for (const release of recentReleases) {
    if (release.artistId) artistIdSet.add(release.artistId);
    for (const fid of release.featuredArtistIds || []) {
      if (fid) artistIdSet.add(fid);
    }
  }
  const artistIds = [...artistIdSet];
  const users =
    artistIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: artistIds }, role: "artist" },
        });
  const userById = new Map(users.map((u) => [u.id, u]));

  console.log(`📅 Период поиска: ${weekAgoStr} — ${nowStr}`);
  console.log(`📀 Найдено релизов за неделю: ${recentReleases.length}`);

  const artistMap = new Map<
    string,
    { id: string; username: string; name: string; recentRelease: string }
  >();

  for (const release of recentReleases) {
    const artist = release.artistId ? userById.get(release.artistId) : undefined;

    if (artist && !artistMap.has(artist.id)) {
      artistMap.set(artist.id, {
        id: artist.id,
        username: artist.username,
        name: artist.name,
        recentRelease: `${release.title} (${release.releaseDate})`,
      });
    }

    if (release.featuredArtistIds) {
      for (const featuredId of release.featuredArtistIds) {
        const featuredArtist = userById.get(featuredId);
        if (featuredArtist && !artistMap.has(featuredArtist.id)) {
          artistMap.set(featuredArtist.id, {
            id: featuredArtist.id,
            username: featuredArtist.username,
            name: featuredArtist.name,
            recentRelease: `${release.title} (feat, ${release.releaseDate})`,
          });
        }
      }
    }
  }

  return Array.from(artistMap.values());
}

// Используем Node.js runtime для парсеров
export const runtime = 'nodejs';

// Расписание (для node-cron в lib/scheduler.ts):
// - Пятница 00:30 МСК — первый скан после выхода
// - Суббота 16:00 МСК
// - Воскресенье 16:00 МСК  
// - Понедельник 16:00 МСК

