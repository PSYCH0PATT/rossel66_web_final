import { NextRequest, NextResponse } from 'next/server';
import { loadReleases, loadUsers, addActivity } from '@/lib/storage';

// Секрет для авторизации cron запросов
const CRON_SECRET = process.env.CRON_SECRET || 'x7Kp9mN2vQ8sL4wR';

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
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.nextUrl.searchParams.get('secret');
    
    // Проверяем секрет (через заголовок или query параметр)
    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecret;
    
    if (providedSecret !== CRON_SECRET) {
      console.log('❌ Cron Playlists: Неверный секрет авторизации');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎵 CRON PLAYLIST PARSER');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📅 Время запуска: ${new Date().toISOString()}`);
    
    // Находим артистов с недавними релизами
    const artistsToScan = getArtistsWithRecentReleases();
    
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    addActivity({
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
function getArtistsWithRecentReleases(): Array<{
  id: string;
  username: string;
  name: string;
  recentRelease: string;
}> {
  const releases = loadReleases();
  const users = loadUsers();
  
  // Текущая дата
  const now = new Date();
  
  // 7 дней назад
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  
  // Находим релизы за последние 7 дней
  const recentReleases = releases.filter(release => {
    if (!release.releaseDate) return false;
    
    const releaseDate = new Date(release.releaseDate);
    releaseDate.setHours(0, 0, 0, 0);
    
    // Релиз должен быть между weekAgo и now
    return releaseDate >= weekAgo && releaseDate <= now;
  });
  
  console.log(`📅 Период поиска: ${weekAgo.toISOString().split('T')[0]} — ${now.toISOString().split('T')[0]}`);
  console.log(`📀 Найдено релизов за неделю: ${recentReleases.length}`);
  
  // Собираем уникальных артистов
  const artistMap = new Map<string, { 
    id: string; 
    username: string; 
    name: string; 
    recentRelease: string 
  }>();
  
  for (const release of recentReleases) {
    const artist = users.find(u => u.id === release.artistId);
    
    if (artist && artist.role === 'artist' && !artistMap.has(artist.id)) {
      artistMap.set(artist.id, {
        id: artist.id,
        username: artist.username,
        name: artist.name,
        recentRelease: `${release.title} (${release.releaseDate})`
      });
    }
    
    // Также добавляем featured артистов
    if (release.featuredArtistIds) {
      for (const featuredId of release.featuredArtistIds) {
        const featuredArtist = users.find(u => u.id === featuredId);
        if (featuredArtist && featuredArtist.role === 'artist' && !artistMap.has(featuredArtist.id)) {
          artistMap.set(featuredArtist.id, {
            id: featuredArtist.id,
            username: featuredArtist.username,
            name: featuredArtist.name,
            recentRelease: `${release.title} (feat, ${release.releaseDate})`
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

