import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let isSchedulerInitialized = false;

/**
 * Инициализация планировщика
 * 
 * Koala Parser: 12:00 и 20:00 по Москве
 * Playlist Parsers: Пт 00:30, Сб 16:00, Вс 16:00, Пн 16:00 по Москве
 */
export function initScheduler() {
  // Предотвращаем повторную инициализацию
  if (isSchedulerInitialized) {
    console.log('⏰ [Scheduler] Already initialized, skipping...');
    return;
  }
  
  // Проверяем, что мы на сервере
  if (typeof window !== 'undefined') {
    return;
  }
  
  isSchedulerInitialized = true;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('⏰ SCHEDULER INITIALIZED');
  console.log('═══════════════════════════════════════════════════');
  console.log('📅 Koala Parser: 12:00 and 20:00 MSK daily');
  console.log('🔄 SFTP Playlist Sync:');
  console.log('   • 16:00 MSK ежедневно');
  console.log('   • 00:30 MSK ежедневно');
  console.log('📊 Analytics Flash Import: 20:00 MSK ежедневно');
  console.log('🧹 Analytics Cleanup: 1 января 00:00 MSK');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // ============================================================
  // KOALA PARSER - 12:00 и 20:00 по Москве
  // ============================================================
  
  cron.schedule('0 12 * * *', async () => {
    console.log('');
    console.log('🚀 [12:00 MSK] Starting scheduled Koala Parser...');
    await runKoalaParser();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  cron.schedule('0 20 * * *', async () => {
    console.log('');
    console.log('🚀 [20:00 MSK] Starting scheduled Koala Parser...');
    await runKoalaParser();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // ============================================================
  // SFTP PLAYLIST SYNC - 16:00 и 00:30 ежедневно по Москве
  // ============================================================
  
  // 16:00 ежедневно — синхронизация SFTP
  cron.schedule('0 16 * * *', async () => {
    console.log('');
    console.log('🔄 [16:00 MSK] SFTP Playlist Sync...');
    await runSftpPlaylistSync();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // 00:30 ежедневно — синхронизация SFTP
  cron.schedule('30 0 * * *', async () => {
    console.log('');
    console.log('🔄 [00:30 MSK] SFTP Playlist Sync...');
    await runSftpPlaylistSync();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // ============================================================
  // ANALYTICS FLASH IMPORT - 20:00 ежедневно по Москве
  // ============================================================
  
  cron.schedule('0 20 * * *', async () => {
    console.log('');
    console.log('📊 [20:00 MSK] Analytics Flash Import...');
    await runAnalyticsFlashImport();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // ============================================================
  // ANALYTICS YEARLY CLEANUP - 1 января в 00:00 по Москве
  // ============================================================
  
  cron.schedule('0 0 1 1 *', async () => {
    console.log('');
    console.log('🧹 [Jan 1, 00:00 MSK] Analytics Yearly Cleanup...');
    await runAnalyticsCleanup();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // ============================================================
  // LEGACY PLAYLIST PARSERS - оставлено для ручного запуска
  // ============================================================
  
  // Старые задачи парсинга удалены, но функция runPlaylistParsers() сохранена
  // для возможности ручного запуска через UI
  
  console.log('✅ Scheduler started successfully');
}

/**
 * Запуск Koala Parser
 */
async function runKoalaParser() {
  const startTime = Date.now();
  
  try {
    console.log('📋 Running Koala Music releases parser...');
    
    // Путь к Python парсеру
    const pythonScript = path.join(process.cwd(), 'parsers', 'koala_releases_parser.py');
    const configPath = path.join(process.cwd(), 'parsers', 'koala_config.json');
    const outputPath = path.join(process.cwd(), 'parsers', 'koala_output.json');
    
    // Проверяем существование скрипта
    if (!fs.existsSync(pythonScript)) {
      console.error('❌ Python parser not found:', pythonScript);
      return;
    }
    
    // Запускаем Python парсер
    const pythonProcess = spawn('python3', [pythonScript, '-c', configPath, '-o', outputPath], {
      cwd: process.cwd()
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', async (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        console.log(`✅ Parser completed in ${duration}ms`);
        
        // Читаем и обрабатываем результаты
        try {
          if (fs.existsSync(outputPath)) {
            const results = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            console.log(`📊 Found ${results.length} releases`);
            
            // Вызываем API для обработки
            await processKoalaResults(results);
          }
        } catch (e) {
          console.error('❌ Error processing results:', e);
        }
      } else {
        console.error(`❌ Parser failed with code ${code}`);
        if (errorOutput) {
          console.error('Error output:', errorOutput.slice(0, 500));
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
}

/**
 * Обработка результатов Koala парсинга
 */
async function processKoalaResults(releases: any[]) {
  try {
    const { 
      updateRelease,
      addRelease,
      findArtistByName,
      getReleaseByKoalaId,
      addActivity 
    } = await import('@/lib/storage');
    
    let added = 0;
    let updated = 0;
    
    for (const koalaRelease of releases) {
      const artist = await findArtistByName(koalaRelease.artist);
      
      if (!artist) {
        continue;
      }
      
      const existing = await getReleaseByKoalaId(koalaRelease.koala_id);
      
      if (existing) {
        await updateRelease(existing.id, {
          status: koalaRelease.status,
          upc: koalaRelease.upc || existing.upc,
          bandlinkUrl: koalaRelease.bandlink_url || existing.bandlinkUrl,
          updatedAt: new Date().toISOString()
        });
        updated++;
      } else {
        const newRelease = {
          title: koalaRelease.title,
          artistId: artist.id,
          releaseDate: koalaRelease.release_date || new Date().toISOString().split('T')[0],
          type: 'single' as const,
          coverUrl: koalaRelease.cover_url || '',
          tracks: [],
          status: koalaRelease.status,
          koalaId: koalaRelease.koala_id,
          bandlinkUrl: koalaRelease.bandlink_url,
          upc: koalaRelease.upc
        };
        
        const created = await addRelease(newRelease);
        added++;
        
        await addActivity({
          type: 'release_added',
          userId: artist.id,
          userRole: 'artist',
          title: 'Новый релиз добавлен',
          description: `Релиз "${koalaRelease.title}" добавлен из Koala Music`,
          metadata: { releaseId: created.id, koalaId: koalaRelease.koala_id }
        });
        
        // Дубликат для админа
        await addActivity({
          type: 'release_added',
          userId: 'system',
          userRole: 'admin',
          title: 'Новый релиз добавлен',
          description: `Релиз "${koalaRelease.title}" добавлен из Koala Music (артист: ${artist.name || artist.username})`,
          metadata: { releaseId: created.id, koalaId: koalaRelease.koala_id, artistId: artist.id, artistName: artist.name }
        });
      }
    }
    
    console.log(`📊 Results: added ${added}, updated ${updated}`);
    
  } catch (error) {
    console.error('❌ Error processing results:', error);
  }
}

/**
 * Запуск парсеров плейлистов (Bandlink + VK)
 * Парсит только артистов с релизами за последние 7 дней
 */
/**
 * Запускает SFTP синхронизацию плейлистов
 */
async function runSftpPlaylistSync() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const cronSecret = process.env.CRON_SECRET || 'x7Kp9mN2vQ8sL4wR';
    
    const response = await fetch(`${baseUrl}/api/cron/playlists-sftp?secret=${cronSecret}`);
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ SFTP Sync завершен: добавлено ${result.stats?.added || 0}, обновлено ${result.stats?.updated || 0}`);
    } else {
      console.error(`❌ SFTP Sync ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка запуска SFTP синхронизации:', error);
  }
}

/**
 * Запускает парсинг плейлистов (legacy, для ручного запуска)
 */
async function runPlaylistParsers() {
  const startTime = Date.now();
  
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎵 PLAYLIST PARSERS');
    console.log('═══════════════════════════════════════════════════');
    
    // Импортируем функции для работы с данными
    const { loadReleases, loadUsers, addActivity } = await import('@/lib/storage');
    
    // Находим артистов с недавними релизами
    const artistsToScan = await getArtistsWithRecentReleases(loadReleases, loadUsers);
    
    if (artistsToScan.length === 0) {
      console.log('📭 Нет артистов с недавними релизами для сканирования');
      return;
    }
    
    console.log(`👥 Артистов для сканирования: ${artistsToScan.length}`);
    artistsToScan.forEach(a => {
      console.log(`   • ${a.name} (@${a.username}) — ${a.recentRelease}`);
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
    console.log(`   Bandlink: ${results.bandlink.count}, VK: ${results.vk.count}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('❌ Playlist parsers error:', error);
  }
}

/**
 * Запускает импорт аналитики из rossel_flash по SFTP
 */
async function runAnalyticsFlashImport() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const cronSecret = process.env.CRON_SECRET || 'x7Kp9mN2vQ8sL4wR';
    
    const response = await fetch(`${baseUrl}/api/cron/analytics-flash?secret=${cronSecret}`);
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Analytics Flash Import завершен: добавлено ${result.stats?.added || 0}, пропущено ${result.stats?.skipped || 0}`);
    } else {
      console.error(`❌ Analytics Flash Import ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка запуска Analytics Flash Import:', error);
  }
}

/**
 * Запускает годовую очистку аналитики
 */
async function runAnalyticsCleanup() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const cronSecret = process.env.CRON_SECRET || 'x7Kp9mN2vQ8sL4wR';
    
    const response = await fetch(`${baseUrl}/api/cron/analytics-cleanup?secret=${cronSecret}`);
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Analytics Cleanup завершен: ${result.stats?.aggregated || 0} агрегатов, ${result.stats?.deleted || 0} удалено`);
    } else {
      console.error(`❌ Analytics Cleanup ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка запуска Analytics Cleanup:', error);
  }
}

/**
 * Находит артистов с релизами за последние 7 дней
 */
async function getArtistsWithRecentReleases(
  loadReleases: () => Promise<any[]>,
  loadUsers: () => Promise<any[]>
): Promise<Array<{ id: string; username: string; name: string; recentRelease: string }>> {
  const releases = await loadReleases();
  const users = await loadUsers();
  
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  
  // Находим релизы за последние 7 дней
  const recentReleases = releases.filter((release: any) => {
    if (!release.releaseDate) return false;
    
    const releaseDate = new Date(release.releaseDate);
    releaseDate.setHours(0, 0, 0, 0);
    
    return releaseDate >= weekAgo && releaseDate <= now;
  });
  
  console.log(`📅 Период: ${weekAgo.toISOString().split('T')[0]} — ${now.toISOString().split('T')[0]}`);
  console.log(`📀 Релизов за неделю: ${recentReleases.length}`);
  
  // Собираем уникальных артистов
  const artistMap = new Map<string, { id: string; username: string; name: string; recentRelease: string }>();
  
  for (const release of recentReleases) {
    const artist = users.find((u: any) => u.id === release.artistId);
    
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
        const featuredArtist = users.find((u: any) => u.id === featuredId);
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
