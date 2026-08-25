import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { releaseFromPrisma } from '@/lib/storage-adapters';
import { internalCronFetchJsonHeaders } from '@/lib/cron-auth';

let isSchedulerInitialized = false;

const CRON_FETCH_MS = 120_000;

function cronBaseUrl(): string {
  if (process.env.INTERNAL_CRON_BASE_URL) {
    return process.env.INTERNAL_CRON_BASE_URL.replace(/\/$/, '');
  }
  return (
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');
}

/** GET к /api/cron/* с Bearer и таймаутом (без secret в query). */
async function fetchCronGet(pathAndQuery: string): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET missing');
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${cronBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRON_FETCH_MS);
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Инициализация планировщика
 * 
 * Koala Parser: 12:00 и 20:00 по Москве
 * Обложки плейлистов (VK/Яндекс): суббота и воскресенье 06:00 МСК → GET /api/cron/playlist-covers (по 20 за запуск)
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

  if (process.env.ENABLE_IN_PROCESS_SCHEDULER !== 'true') {
    console.log('⏰ [Scheduler] Встроенный node-cron отключён (задайте ENABLE_IN_PROCESS_SCHEDULER=true для включения)');
    isSchedulerInitialized = true;
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
  console.log('🖼  Playlist covers (VK/Яндекс): сб + вс 06:00 MSK → /api/cron/playlist-covers (до 20/день)');
  console.log('📦 Buildin outbox: каждые 5 минут → /api/cron/buildin-outbox');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // ============================================================
  // KOALA PARSER - 12:00 и 20:00 по Москве
  // ============================================================
  
  cron.schedule('*/5 * * * *', async () => {
    try {
      const response = await fetchCronGet('/api/cron/buildin-outbox?limit=20');
      const result = await response.json();
      if (!response.ok) {
        console.error('📦 [Buildin outbox] failed:', result);
      }
    } catch (err) {
      console.error('📦 [Buildin outbox] error:', err);
    }
  }, {
    timezone: 'Europe/Moscow'
  });

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
  // ZVONKO PARSER - 14:00 ежедневно по Москве
  // ============================================================
  
  cron.schedule('0 14 * * *', async () => {
    console.log('');
    console.log('🎵 [14:00 MSK] Zvonko Parser...');
    await runZvonkoParser();
  }, {
    timezone: 'Europe/Moscow'
  });
  
  // Годовая агрегация/очистка аналитики отключена: храним все дневные данные
  // (см. решение по C2). Месячные агрегаты больше не создаются.

  // ============================================================
  // PLAYLIST COVER SCRAPER — суббота и воскресенье 06:00 МСК (по 20 кандидатов за вызов API)
  // После первого прогона у строк обновляется coverFetchedAt → второй день берёт следующих 20.
  // ============================================================

  cron.schedule('0 6 * * 6', async () => {
    console.log('');
    console.log('🖼  [Sat 06:00 MSK] Playlist Cover Scraper...');
    await runPlaylistCoverScraper();
  }, {
    timezone: 'Europe/Moscow'
  });

  cron.schedule('0 6 * * 0', async () => {
    console.log('');
    console.log('🖼  [Sun 06:00 MSK] Playlist Cover Scraper...');
    await runPlaylistCoverScraper();
  }, {
    timezone: 'Europe/Moscow'
  });

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
        
        // F-03: одна запись на событие — «дубликат для админа» задваивал
        // журнал одним таймстампом, причём без имени актора.
        await addActivity({
          type: 'release_added',
          userId: artist.id,
          userRole: 'artist',
          title: 'Новый релиз добавлен',
          description: `Релиз "${koalaRelease.title}" добавлен из Koala Music`,
          metadata: {
            releaseId: created.id,
            koalaId: koalaRelease.koala_id,
            artistId: artist.id,
            artistName: artist.name,
          }
        });
      }
    }
    
    console.log(`📊 Results: added ${added}, updated ${updated}`);
    
  } catch (error) {
    console.error('❌ Error processing results:', error);
  }
}

/**
 * Запускает SFTP синхронизацию плейлистов
 */
async function runSftpPlaylistSync() {
  try {
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET не задан — пропуск SFTP sync');
      return;
    }
    
    const response = await fetchCronGet('/api/cron/playlists-sftp');
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
/**
 * Запускает импорт аналитики из rossel_flash по SFTP
 */
async function runAnalyticsFlashImport() {
  try {
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET не задан — пропуск Analytics Flash Import');
      return;
    }

    const response = await fetchCronGet('/api/cron/analytics-flash');
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
 * Запускает парсинг Zvonko
 */
async function runZvonkoParser() {
  try {
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET не задан — пропуск Zvonko Parser');
      return;
    }

    const response = await fetchCronGet('/api/cron/zvonko');
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Zvonko Parser завершен: добавлено ${result.stats?.added || 0}, обновлено ${result.stats?.updated || 0}`);
    } else {
      console.error(`❌ Zvonko Parser ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка запуска Zvonko Parser:', error);
  }
}

/**
 * Запускает парсинг обложек плейлистов VK и Яндекс
 */
async function runPlaylistCoverScraper() {
  try {
    if (!process.env.CRON_SECRET) {
      console.error('❌ CRON_SECRET не задан — пропуск playlist cover scraper');
      return;
    }

    const response = await fetchCronGet('/api/cron/playlist-covers');
    const result = await response.json();

    if (result.success) {
      const s = result.stats || {};
      console.log(`✅ Cover Scraper завершен: обработано ${s.processed ?? 0}, найдено ${s.found ?? 0}, ошибок ${s.errors ?? 0}`);
    } else {
      console.error(`❌ Cover Scraper ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка запуска playlist cover scraper:', error);
  }
}

/** Находит артистов с релизами за последние 7 дней (без полного скана таблиц) */
async function getArtistsWithRecentReleases(): Promise<
  Array<{ id: string; username: string; name: string; recentRelease: string }>
> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const raw = await prisma.release.findMany({
    where: { releaseDate: { gte: weekAgoStr, lte: nowStr } },
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

  console.log(`📅 Период: ${weekAgoStr} — ${nowStr}`);
  console.log(`📀 Релизов за неделю: ${recentReleases.length}`);

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
