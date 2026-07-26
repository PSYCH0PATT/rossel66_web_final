import { NextRequest, NextResponse } from 'next/server';
import type { NextRequest as NextRequestType } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { addActivity, getUserByUsername } from '@/lib/storage';
import { requireAdmin, requireAdminOrCron } from '@/lib/server-auth';
import { rateLimitParser } from '@/lib/rate-limit';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getParserCookiesRecord } from '@/lib/parser-cookies';
import { syncBandlinkSqliteRowsToPostgres } from '@/lib/parser-results-sync';
import { recordParserRun } from '@/lib/parser-run-history';
import { MAX_TAKE, loadFormattedSftpPlaylists } from '@/lib/sftp-playlist-response';
import { syncBandlinkParserStatusFromSqlite } from '@/lib/parser-status-sqlite-bridge';

export async function POST(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;
  if (!isCronAuthorized(request)) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rl = rateLimitParser(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
      );
    }
  }
  try {
    const requestBody = await request.json();
    console.log('📥 Получен запрос:', JSON.stringify(requestBody, null, 2));
    
    const { artists } = requestBody;
    
    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'Список артистов не предоставлен' }, { status: 400 });
    }

    console.log('Запуск Bandlink парсера для артистов:', artists);
    
    // Получаем Residential Proxy credentials из переменных окружения
    const proxyUsername = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME;
    const proxyPassword = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD;
    const proxyHost = process.env.PROXY_HOST || 'brd.superproxy.io';
    const proxyPort = process.env.PROXY_PORT || '33335';
    
    console.log('🔍 Проверка Residential Proxy credentials:');
    console.log('  - BRIGHT_DATA_RESIDENTIAL_USERNAME exists:', !!proxyUsername);
    console.log('  - BRIGHT_DATA_RESIDENTIAL_PASSWORD exists:', !!proxyPassword);
    console.log('  - PROXY_HOST:', proxyHost);
    console.log('  - PROXY_PORT:', proxyPort);
    
    // Проверяем наличие Residential Proxy credentials
    if (!proxyUsername || !proxyPassword) {
      console.error('❌ Residential Proxy credentials не настроены в переменных окружения!');
      console.error('💡 Добавьте BRIGHT_DATA_RESIDENTIAL_USERNAME и BRIGHT_DATA_RESIDENTIAL_PASSWORD в .env.local файл');
      return NextResponse.json({ error: 'Residential Proxy credentials не настроены на сервере. Обратитесь к администратору.' }, { status: 500 });
    } else {
      console.log('🔑 Residential Proxy credentials найдены');
    }

    const cookies = await getParserCookiesRecord('bandlink');
    console.log(`🍪 Загружено ${Object.keys(cookies).length} кук из Postgres`);

    // Создаем временный конфиг файл
    const configPath = path.join(process.cwd(), 'temp_bandlink_config.json');
    const config = {
      target_artists: artists, // Для bandlink передаем только никнеймы
      bright_data_proxy_username: proxyUsername, // Residential Proxy username
      bright_data_proxy_password: proxyPassword, // Residential Proxy password
      proxy_host: proxyHost, // Proxy host
      proxy_port: parseInt(proxyPort), // Proxy port
      cookies: cookies // Добавляем куки в конфиг
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Конфиг файл создан с Residential Proxy credentials и cookies');

    // Определяем ОС и выбираем соответствующий парсер
    const isLinux = process.platform === 'linux';
    const parserScript = isLinux 
      ? 'bandlink_parser_production_linux.py'  // Linux: с прокси
      : 'bandlink_parser_production_mac.py';   // Mac: без прокси
    
    const pythonScript = path.join(process.cwd(), 'parsers', parserScript);
    console.log(`🖥️  Платформа: ${process.platform}, парсер: ${parserScript}`);
    
    return new Promise<Response>(async (resolve) => {
      const pythonProcess = spawn('python3', [pythonScript, configPath], {
        cwd: process.cwd()
      });

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Bandlink Parser:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.error('Bandlink Parser Error:', data.toString());
      });

      pythonProcess.on('close', async (code) => {
        // Удаляем временный файл
        try {
          fs.unlinkSync(configPath);
        } catch (e) {
          console.error('Ошибка удаления временного файла:', e);
        }

        await syncBandlinkParserStatusFromSqlite();

        if (code === 0) {
          // Читаем результаты из базы данных
          try {
            const results = await readBandlinkResults();

            try {
              const syncStats = await syncBandlinkSqliteRowsToPostgres(results as any[]);
              console.log(
                `📤 Bandlink → Postgres: +${syncStats.added} ~${syncStats.updated} =${syncStats.unchanged}`
              );
            } catch (syncErr) {
              console.error('Ошибка синхронизации Bandlink результатов в Postgres:', syncErr);
            }
            
            // Сохраняем историю парсинга
            try {
              const totalFound = (results as any[]).length;
              const newPlaylists = (results as any[]).filter((r: any) => {
                const parsedDate = new Date(r.parsed_at || r.added_at);
                const now = new Date();
                const diffMinutes = (now.getTime() - parsedDate.getTime()) / (1000 * 60);
                return diffMinutes < 5; // Плейлисты, добавленные в последние 5 минут
              }).length;
              
              await recordParserRun({
                parserType: 'bandlink',
                artists,
                playlistsFound: totalFound,
                playlistsAdded: newPlaylists,
                status: 'completed'
              });
            } catch (historyError) {
              console.error('Ошибка сохранения истории парсинга:', historyError);
            }
            
            // Извлекаем HTML из логов
            const htmlData = extractHtmlFromOutput(output);
            
            // Создаем активность для каждого найденного артиста
            for (const artist of artists) {
              const artistData = await getUserByUsername(artist);
              if (artistData) {
                const artistPlaylists = (results as any[]).filter((r: any) => r.artist_name === artistData.name);
                if (artistPlaylists.length > 0) {
                  const platforms = [...new Set(artistPlaylists.map((p: any) => p.platform))];
                  
                  // Группируем плейлисты и составляем описание
                  const playlistInfo = artistPlaylists.slice(0, 3).map((p: any) => {
                    const trackInfo = p.track_names ? ` (${p.track_names})` : '';
                    return `"${p.playlist_name}"${trackInfo}`;
                  });
                  const moreCount = Math.max(0, artistPlaylists.length - 3);
                  
                  let description = `Найдено ${artistPlaylists.length} ${artistPlaylists.length === 1 ? 'плейлист' : artistPlaylists.length < 5 ? 'плейлиста' : 'плейлистов'} на ${platforms.join(', ')}`;
                  if (playlistInfo.length > 0) {
                    description += `: ${playlistInfo.join(', ')}`;
                    if (moreCount > 0) {
                      description += ` и еще ${moreCount}`;
                    }
                  }
                  
                  await addActivity({
                    type: 'playlist_found',
                    userId: artistData.id,
                    userRole: 'artist',
                    title: 'Найдены новые плейлисты',
                    description,
                    metadata: { 
                      platforms, 
                      count: artistPlaylists.length,
                      playlists: artistPlaylists.map((p: any) => ({
                        name: p.playlist_name,
                        platform: p.platform,
                        tracks: p.track_names,
                        url: p.playlist_url
                      }))
                    }
                  });
                }
              }
            }
            
            resolve(NextResponse.json({ 
              success: true, 
              message: 'Bandlink парсинг завершен успешно',
              results,
              html_data: htmlData, // Добавляем HTML в ответ
              output 
            }));
          } catch (e) {
            resolve(NextResponse.json({ 
              success: false, 
              error: 'Ошибка чтения результатов',
              output,
              stderr: error 
            }, { status: 500 }));
          }
        } else {
          // Сохраняем историю парсинга с ошибкой
          try {
            await recordParserRun({
              parserType: 'bandlink',
              artists,
              playlistsFound: 0,
              playlistsAdded: 0,
              errors: error || `Python процесс завершился с кодом ${code}`,
              status: 'failed'
            });
          } catch (historyError) {
            console.error('Ошибка сохранения истории парсинга:', historyError);
          }
          
          resolve(NextResponse.json({ 
            success: false, 
            error: `Python процесс завершился с кодом ${code}`,
            output,
            stderr: error 
          }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error('Ошибка Bandlink парсера:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
}

function extractHtmlFromOutput(output: string): string | null {
  try {
    // Ищем HTML в base64 формате в логах
    const match = output.match(/HTML_BASE64_START:(.+?):HTML_BASE64_END/);
    if (match) {
      const htmlBase64 = match[1];
      const html = Buffer.from(htmlBase64, 'base64').toString('utf-8');
      console.log(`📄 HTML извлечен из логов: ${html.length} символов`);
      return html;
    }
    console.log('⚠️ HTML не найден в логах');
    return null;
  } catch (error) {
    console.error('❌ Ошибка извлечения HTML из логов:', error);
    return null;
  }
}

async function ensureBandlinkDatabase(dbPath: string) {
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.serialize(() => {
      // Создаем таблицу playlists
      db.run(`
        CREATE TABLE IF NOT EXISTS playlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          artist_name TEXT NOT NULL,
          playlist_name TEXT NOT NULL,
          playlist_artist TEXT,
          track_names TEXT,
          likes_count TEXT,
          platform TEXT,
          playlist_cover_url TEXT,
          playlist_url TEXT,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(artist_name, playlist_name, playlist_url)
        )
      `, (err: any) => {
        if (err) console.error('❌ Ошибка создания таблицы playlists:', err);
        else console.log('✅ Таблица playlists инициализирована');
      });
      
      // Создаем таблицу bandlink_cookies
      db.run(`
        CREATE TABLE IF NOT EXISTS bandlink_cookies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cookie_name TEXT NOT NULL UNIQUE,
          cookie_value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err: any) => {
        if (err) console.error('❌ Ошибка создания таблицы bandlink_cookies:', err);
        else console.log('✅ Таблица bandlink_cookies инициализирована');
      });
      
      // Создаем таблицу parser_status
      db.run(`
        CREATE TABLE IF NOT EXISTS parser_status (
          id INTEGER PRIMARY KEY,
          needs_new_cookies INTEGER DEFAULT 0,
          failed_attempts INTEGER DEFAULT 0,
          last_error TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err: any) => {
        if (err) console.error('❌ Ошибка создания таблицы parser_status:', err);
        else console.log('✅ Таблица parser_status инициализирована');
      });
    });
    
    db.close((err: any) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

async function readBandlinkResults() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    // Определяем путь к БД в зависимости от ОС
    const isLinux = process.platform === 'linux';
    const dbName = isLinux ? 'bandlink_playlists.db' : 'bandlink_playlists_mac.db';
    const dbPath = path.join(process.cwd(), dbName);
    
    // ✅ Всегда инициализируем БД (как в lib/storage.ts с JSON файлами)
    console.log(`📦 Инициализация БД: ${dbName}`);
    await ensureBandlinkDatabase(dbPath);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.all(`
        SELECT * FROM playlists 
        ORDER BY parsed_at DESC 
        LIMIT 100
      `, (err: any, rows: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
        db.close();
      });
    });
  } catch (error) {
    console.error('Ошибка чтения Bandlink результатов:', error);
    return [];
  }
}

export async function GET(request: NextRequestType) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    // Проверяем, использовать ли SFTP данные (по умолчанию)
    const useSftpSync = process.env.USE_SFTP_SYNC !== 'false';
    
    if (useSftpSync) {
      // Используем данные из SFTP
      try {
        // F-PARS-4: self-fetch на /api/playlists/sftp с cron-Bearer всегда
        // получал 401 (роут закрыт requireAdmin) → «Результаты» были пустыми.
        const sftpData = await loadFormattedSftpPlaylists({ take: MAX_TAKE });

        // Преобразуем в формат Bandlink
        const formattedResults = (sftpData.results || []).map((p: any) => {
          // Формируем список названий релизов
          let trackNames = '';
          if (p.multiple_tracks && p.tracks_info && p.tracks_info.length > 0) {
            const releaseNames = p.tracks_info
              .map((t: any) => t.releaseName || t.title)
              .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
              .join(', ');
            trackNames = releaseNames || `${p.tracks_count} треков`;
          } else if (p.release_names && p.release_names.length > 0) {
            trackNames = p.release_names.join(', ');
          } else if (p.multiple_tracks) {
            trackNames = `${p.tracks_count} треков`;
          }
          
          // Получаем позицию трека
          let trackPosition = p.track_position;
          if (!trackPosition && p.tracks_info && p.tracks_info.length > 0) {
            const positions = p.tracks_info.map((t: any) => t.position).filter((pos: number) => pos != null && !isNaN(pos));
            if (positions.length > 0) {
              trackPosition = Math.min(...positions);
            }
          }
          
          return {
            id: p.id,
            artist_name: p.artist_name,
            playlist_name: p.playlist_name,
            playlist_url: p.playlist_url,
            platform: p.platform,
            playlist_cover_url: p.playlist_cover_url || "/placeholder.svg",
            parsed_at: p.parsed_at,
            added_at: p.added_at,
            tracks_count: p.tracks_count,
            multiple_tracks: p.multiple_tracks || false,
            track_names: trackNames,
            release_names: p.release_names || [],
            track_position: trackPosition,
            tracks_info: p.tracks_info || []
          };
        });
        
        return NextResponse.json({
          success: true,
          results: formattedResults,
          source: 'sftp'
        });
      } catch (error) {
        console.error('Ошибка получения данных из SFTP, используем парсинг:', error);
        // Fallback на парсинг при ошибке
      }
    }
    
    // Используем данные из парсинга
    const results = await readBandlinkResults();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Ошибка получения результатов Bandlink:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Ошибка получения результатов' 
    }, { status: 500 });
  }
}
