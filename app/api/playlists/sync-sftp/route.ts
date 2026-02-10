import { NextRequest, NextResponse } from 'next/server';
import { syncSftpPlaylists, getLatestCsvFile, markFileAsProcessed } from '@/lib/sftp-playlist-sync';
import { processCsvFiles } from '@/lib/sftp-playlist-parser';
import { savePlaylists } from '@/lib/sftp-playlist-storage';
import { cleanupRemovedPlaylists } from '@/lib/playlist-history';
import { addActivity } from '@/lib/storage';
import * as path from 'path';

/**
 * GET /api/playlists/sync-sftp
 * Ручной запуск синхронизации SFTP из админ-интерфейса.
 * Вызывает логику напрямую (без proxy на cron endpoint).
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 SFTP PLAYLIST SYNC (ручной запуск)');
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
    const latestFile = getLatestCsvFile();

    if (!latestFile) {
      console.log('⚠️  Последний CSV файл не найден');
      const cleanupResult = await cleanupRemovedPlaylists(new Set<string>());
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

    // Шаг 3: Сохранение в базу данных
    console.log('\n💾 Шаг 3: Сохранение в базу данных...');
    const saveResult = await savePlaylists(playlists);
    console.log(`✅ Добавлено: ${saveResult.added}, Обновлено: ${saveResult.updated}`);

    if (saveResult.errors.length > 0) {
      console.error('❌ Ошибки при сохранении:', saveResult.errors);
    }

    // Отмечаем файл как обработанный
    markFileAsProcessed(path.basename(latestFile));

    // Шаг 4: Очистка удаленных плейлистов
    console.log('\n🧹 Шаг 4: Проверка удаленных плейлистов...');
    const currentPlaylistKeys = new Set<string>();
    playlists.forEach(p => {
      currentPlaylistKeys.add(`${p.playlistUrl}|${p.playlistName}`);
    });

    const cleanupResult = await cleanupRemovedPlaylists(currentPlaylistKeys);
    if (cleanupResult.removed > 0) {
      console.log(`🗑️  Удалено плейлистов: ${cleanupResult.removed}`);
    }

    const duration = Date.now() - startTime;

    // Логируем активность
    addActivity({
      type: 'playlist_found',
      userId: 'system',
      userRole: 'admin',
      title: 'Синхронизация плейлистов с SFTP (ручная)',
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
    console.log(`✅ Синхронизация завершена за ${duration}ms`);
    console.log('═══════════════════════════════════════════════════');

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
    console.error('❌ SFTP Sync ошибка:', error);

    return NextResponse.json({
      success: false,
      error: String(error),
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
