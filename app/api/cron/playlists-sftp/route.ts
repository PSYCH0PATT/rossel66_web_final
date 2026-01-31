import { NextRequest, NextResponse } from 'next/server';
import { syncSftpPlaylists, getUnprocessedFiles, markFileAsProcessed, getLatestCsvFile } from '@/lib/sftp-playlist-sync';
import { processCsvFiles } from '@/lib/sftp-playlist-parser';
import { savePlaylists, getAllPlaylistUrls, deletePlaylist } from '@/lib/sftp-playlist-storage';
import { cleanupRemovedPlaylists } from '@/lib/playlist-history';
import { addActivity } from '@/lib/storage';
import * as path from 'path';

// Секрет для авторизации cron запросов (ОБЯЗАТЕЛЬНО установите в переменных окружения!)
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.warn('⚠️ CRON_SECRET не установлен! Cron endpoints будут недоступны.');
}

/**
 * GET /api/cron/playlists-sftp
 * Cron endpoint для синхронизации плейлистов с SFTP сервера
 * 
 * Расписание:
 * - 16:00 ежедневно
 * - 00:30 ежедневно
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.nextUrl.searchParams.get('secret');
    
    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecret;
    
    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      console.log('❌ Cron Playlists SFTP: Неверный секрет авторизации или CRON_SECRET не настроен');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 SFTP PLAYLIST SYNC');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📅 Время запуска: ${new Date().toISOString()}`);
    
    // Шаг 1: Синхронизация с SFTP сервером
    console.log('\n📥 Шаг 1: Синхронизация с SFTP сервером...');
    const syncResult = await syncSftpPlaylists();
    
    if (syncResult.errors.length > 0) {
      console.error('❌ Ошибки при синхронизации:', syncResult.errors);
    }
    
    console.log(`✅ Скачано новых файлов: ${syncResult.downloaded}`);
    console.log('🔄 Переходим к обработке файлов...');
    
    // Шаг 2: Обработка ТОЛЬКО последнего CSV файла
    console.log('\n📊 Шаг 2: Обработка CSV файлов...');
    console.log('🔍 Ищу последний CSV файл...');
    
    const latestFile = getLatestCsvFile();
    
    if (!latestFile) {
      console.log('⚠️  Последний CSV файл не найден');
      
      // Все равно проверяем удаленные плейлисты (если нет файлов, удаляем все)
      const cleanupResult = await cleanupRemovedPlaylists(new Set<string>());
      
      if (cleanupResult.removed > 0) {
        console.log(`🗑️  Удалено плейлистов: ${cleanupResult.removed}`);
      }
      
      const duration = Date.now() - startTime;
      return NextResponse.json({ 
        success: true, 
        message: 'Последний CSV файл не найден',
        stats: {
          downloaded: syncResult.downloaded,
          processed: 0,
          added: 0,
          updated: 0,
          removed: cleanupResult.removed
        },
        duration: `${duration}ms`
      });
    }
    
    console.log(`📄 Обрабатываю только последний файл: ${path.basename(latestFile)}`);
    
    const playlists = processCsvFiles([latestFile]);
    console.log(`📦 Обработано плейлистов: ${playlists.length}`);
    
    if (playlists.length > 0) {
      console.log(`📋 Примеры плейлистов:`);
      playlists.slice(0, 3).forEach(p => {
        console.log(`   - ${p.playlistName} (${p.platform}): ${p.tracks.length} треков`);
      });
    }
    
    // Шаг 3: Сохранение в базу данных
    console.log('\n💾 Шаг 3: Сохранение в базу данных...');
    const saveResult = await savePlaylists(playlists);
    console.log(`✅ Добавлено: ${saveResult.added}, Обновлено: ${saveResult.updated}`);
    
    if (saveResult.errors.length > 0) {
      console.error('❌ Ошибки при сохранении:', saveResult.errors);
    }
    
    // Отмечаем файл как обработанный
    const filename = path.basename(latestFile);
    markFileAsProcessed(filename);
    
    // Шаг 4: Очистка удаленных плейлистов
    // Удаляем плейлисты, которых нет в последнем CSV файле
    console.log('\n🧹 Шаг 4: Проверка удаленных плейлистов...');
    // Создаем множество ключей плейлистов из последнего CSV (URL + название, без артиста)
    const currentPlaylistKeys = new Set<string>();
    playlists.forEach(p => {
      // Ключ только по URL и названию (без артиста)
      currentPlaylistKeys.add(`${p.playlistUrl}|${p.playlistName}`);
    });
    
    console.log(`📋 Плейлистов в последнем CSV: ${currentPlaylistKeys.size}`);
    
    const cleanupResult = await cleanupRemovedPlaylists(currentPlaylistKeys);
    if (cleanupResult.removed > 0) {
      console.log(`🗑️  Удалено плейлистов: ${cleanupResult.removed}`);
    }
    
    if (cleanupResult.errors.length > 0) {
      console.error('❌ Ошибки при очистке:', cleanupResult.errors);
    }
    
    const duration = Date.now() - startTime;
    
    // Логируем активность
    addActivity({
      type: 'playlist_found',
      userId: 'system',
      userRole: 'admin',
      title: 'Синхронизация плейлистов с SFTP',
      description: `Скачано: ${syncResult.downloaded}, Добавлено: ${saveResult.added}, Обновлено: ${saveResult.updated}, Удалено: ${cleanupResult.removed}`,
      metadata: {
        downloaded: syncResult.downloaded,
        added: saveResult.added,
        updated: saveResult.updated,
        removed: cleanupResult.removed,
        duration: `${duration}ms`
      }
    });
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Синхронизация завершена за ${duration}ms`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Синхронизация плейлистов завершена',
      stats: {
        downloaded: syncResult.downloaded,
        processed: 1,
        added: saveResult.added,
        updated: saveResult.updated,
        removed: cleanupResult.removed
      },
      duration: `${duration}ms`
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Cron Playlists SFTP: Критическая ошибка:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: String(error),
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
