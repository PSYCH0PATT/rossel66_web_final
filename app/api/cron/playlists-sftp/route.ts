import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { syncSftpPlaylists, getLatestCsvFile } from '@/lib/sftp-playlist-sync';
import { importPlaylistsFromCsvFile } from '@/lib/playlist-sftp-pipeline';

export const dynamic = 'force-dynamic'

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
      console.log('⚠️  Последний CSV файл не найден — очистка «пропавших» плейлистов не выполняется');

      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: 'Последний CSV файл не найден',
        stats: {
          downloaded: syncResult.downloaded,
          processed: 0,
          added: 0,
          updated: 0,
          removed: 0
        },
        duration: `${duration}ms`
      });
    }

    console.log(`📄 Обрабатываю только последний файл: ${path.basename(latestFile)}`);

    const cleanupRemoved = process.env.PLAYLIST_SFTP_CLEANUP_REMOVED === '1';
    if (cleanupRemoved) {
      console.log('🧹 PLAYLIST_SFTP_CLEANUP_REMOVED=1 — после импорта удаляем записи, которых нет в CSV');
    } else {
      console.log('🧹 Очистка «пропавших» плейлистов отключена (поставьте PLAYLIST_SFTP_CLEANUP_REMOVED=1 чтобы включить)');
    }

    const importResult = await importPlaylistsFromCsvFile(latestFile, {
      cleanupRemoved,
      markProcessedInIndex: true,
    });

    console.log(`📦 Плейлистов в файле (групп): ${importResult.playlistsParsed}`);
    console.log(`✅ Добавлено: ${importResult.added}, Обновлено: ${importResult.updated}, Удалено: ${importResult.removed}`);

    if (importResult.errors.length > 0) {
      console.error('❌ Ошибки при импорте:', importResult.errors);
    }

    const duration = Date.now() - startTime;

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Синхронизация завершена за ${duration}ms`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json({
      success: importResult.success,
      message: importResult.success ? 'Синхронизация плейлистов завершена' : 'Синхронизация завершена с ошибками',
      stats: {
        downloaded: syncResult.downloaded,
        processed: 1,
        added: importResult.added,
        updated: importResult.updated,
        unchanged: importResult.unchanged,
        removed: importResult.removed
      },
      errors: importResult.errors,
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
