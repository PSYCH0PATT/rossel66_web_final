import { NextRequest, NextResponse } from 'next/server';
import type { NextRequest as NextRequestType } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import { addActivity, getUserByUsername } from '@/lib/storage';
import { requireAdmin, requireAdminOrCron } from '@/lib/server-auth';
import { rateLimitParser } from '@/lib/rate-limit';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getParserCookiesRecord } from '@/lib/parser-cookies';
import { syncVkSqliteRowsToPostgres } from '@/lib/parser-results-sync';
import { recordParserRun } from '@/lib/parser-run-history';
import { MAX_TAKE, loadFormattedSftpPlaylists } from '@/lib/sftp-playlist-response';
import { isVkMusicPlatform } from '@/lib/playlist-platform';

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
    const { artists } = await request.json();
    
    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'Список артистов не предоставлен' }, { status: 400 });
    }

    console.log('Запуск VK парсера для артистов:', artists);
    
    // Получаем API ключ 2captcha из переменных окружения
    const captchaApiKey = process.env.TWOCAPTCHA_API_KEY;
    
    // Получаем прокси credentials из переменных окружения
    const proxyUsername = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME;
    const proxyPassword = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD;
    const proxyHost = process.env.PROXY_HOST || '94.154.188.161';
    const proxyPort = process.env.PROXY_PORT || '63194';
    
    // Проверяем наличие API ключа 2captcha
    if (!captchaApiKey) {
      console.warn('⚠️  2captcha API ключ не настроен в переменных окружения! VK капчи не будут решаться автоматически');
    } else {
      console.log('🔑 2captcha API ключ найден в переменных окружения для VK');
    }
    
    const cookies = await getParserCookiesRecord('vk');
    console.log(`🍪 Загружено ${Object.keys(cookies).length} VK кук из Postgres`);

    // Создаем временный конфиг файл
    // F-PARS-9: имя было фиксированным — два одновременных запуска
    // перезаписывали конфиг друг друга, а unlinkSync первого удалял файл
    // из-под второго. Уникальное имя на каждый запуск снимает гонку.
    const configPath = path.join(os.tmpdir(), `temp_vk_config_${Date.now()}_${randomUUID()}.json`);
    const config = {
      target_artists: artists.map(artist => `https://vk.com/artist/${artist}`),
      captcha_api_key: captchaApiKey || null,
      proxy_username: proxyUsername,
      proxy_password: proxyPassword,
      proxy_host: proxyHost,
      proxy_port: parseInt(proxyPort),
      cookies: cookies
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Запускаем Python скрипт (Linux версия для production)
    const pythonScript = path.join(process.cwd(), 'parsers', 'vk_parser_linux.py');
    
    return new Promise<Response>(async (resolve) => {
      const pythonProcess = spawn('python3', [pythonScript, configPath], {
        cwd: process.cwd()
      });

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('VK Parser:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.error('VK Parser Error:', data.toString());
      });

      pythonProcess.on('close', async (code) => {
        // Удаляем временный файл
        try {
          fs.unlinkSync(configPath);
        } catch (e) {
          console.error('Ошибка удаления временного файла:', e);
        }

        if (code === 0) {
          // Читаем результаты из базы данных
          try {
            const results = await readVKResults();

            try {
              const syncStats = await syncVkSqliteRowsToPostgres(results as any[]);
              console.log(
                `📤 VK → Postgres: +${syncStats.added} ~${syncStats.updated} =${syncStats.unchanged}`
              );
            } catch (syncErr) {
              console.error('Ошибка синхронизации VK результатов в Postgres:', syncErr);
            }
            
            // Сохраняем историю парсинга
            try {
              const totalFound = (results as any[]).length;
              const newPlaylists = (results as any[]).filter((r: any) => {
                const parsedDate = new Date(r.parsed_at);
                const now = new Date();
                const diffMinutes = (now.getTime() - parsedDate.getTime()) / (1000 * 60);
                return diffMinutes < 5; // Плейлисты, добавленные в последние 5 минут
              }).length;
              
              // F-PARS-3: раньше это был self-fetch без cron-заголовка → 401 →
              // успешные запуски VK не попадали в историю. Пишем напрямую.
              await recordParserRun({
                parserType: 'vk',
                artists,
                playlistsFound: totalFound,
                playlistsAdded: newPlaylists,
                status: 'completed'
              });
            } catch (historyError) {
              console.error('Ошибка сохранения истории парсинга:', historyError);
            }
            
            // Создаем активность для каждого найденного артиста
            const resultsArr = results as any[];
            for (const artist of artists) {
              const artistData = await getUserByUsername(artist);
              if (artistData) {
                const artistPlaylists = resultsArr.filter((r: any) => r.artist_name === artistData.name);
                if (artistPlaylists.length > 0) {
                  // Группируем плейлисты и составляем описание
                  const playlistNames = artistPlaylists.map((p: any) => `"${p.playlist_name}"`).slice(0, 3);
                  const moreCount = Math.max(0, artistPlaylists.length - 3);
                  
                  let description = `Найдено ${artistPlaylists.length} ${artistPlaylists.length === 1 ? 'плейлист' : artistPlaylists.length < 5 ? 'плейлиста' : 'плейлистов'} на VK Музыка`;
                  if (playlistNames.length > 0) {
                    description += `: ${playlistNames.join(', ')}`;
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
                      platform: 'VK Музыка', 
                      count: artistPlaylists.length,
                      playlists: artistPlaylists.map((p: any) => ({
                        name: p.playlist_name,
                        url: p.playlist_url
                      }))
                    }
                  });
                }
              }
            }
            
            resolve(NextResponse.json({ 
              success: true, 
              message: 'VK парсинг завершен успешно',
              results,
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
              parserType: 'vk',
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
    console.error('Ошибка VK парсера:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
}

async function ensureVKDatabase(dbPath: string) {
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    db.serialize(() => {
      // Создаем таблицу vk_playlists
      db.run(`
        CREATE TABLE IF NOT EXISTS vk_playlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          artist_url TEXT NOT NULL,
          artist_name TEXT NOT NULL,
          playlist_name TEXT NOT NULL,
          playlist_url TEXT NOT NULL,
          playlist_cover_url TEXT,
          playlist_id TEXT,
          owner_id TEXT,
          parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(artist_name, playlist_name, playlist_url)
        )
      `, (err: any) => {
        if (err) console.error('❌ Ошибка создания таблицы vk_playlists:', err);
        else console.log('✅ Таблица vk_playlists инициализирована');
      });
      
      // Создаем таблицу vk_cookies
      db.run(`
        CREATE TABLE IF NOT EXISTS vk_cookies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cookie_name TEXT NOT NULL UNIQUE,
          cookie_value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err: any) => {
        if (err) console.error('❌ Ошибка создания таблицы vk_cookies:', err);
        else console.log('✅ Таблица vk_cookies инициализирована');
      });
    });
    
    db.close((err: any) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

async function readVKResults() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(process.cwd(), 'vk_playlists.db');
    
    // ✅ Всегда инициализируем БД
    console.log(`📦 Инициализация VK БД: vk_playlists.db`);
    await ensureVKDatabase(dbPath);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.all(`
        SELECT * FROM vk_playlists 
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
    console.error('Ошибка чтения VK результатов:', error);
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
        // F-PARS-4: раньше здесь был self-fetch на /api/playlists/sftp с cron-Bearer,
        // а роут закрыт requireAdmin → всегда 401 → вкладка «Результаты» была
        // молча пустой. Читаем те же данные напрямую.
        const sftpData = await loadFormattedSftpPlaylists({ take: MAX_TAKE });

        // Фильтруем только VK плейлисты и преобразуем в формат VK
        const vkPlaylists = (sftpData.results || [])
          .filter((p: any) => isVkMusicPlatform(p.platform))
          .map((p: any) => {
            // Находим позицию трека этого артиста в плейлисте
            let trackPosition = null;
            if (p.tracks_info && p.tracks_info.length > 0) {
              // Берем первую позицию (если несколько треков, берем минимальную позицию)
              trackPosition = Math.min(...p.tracks_info.map((t: any) => t.position));
            } else if (p.tracks_by_artist && p.artist_name && p.tracks_by_artist[p.artist_name]) {
              const artistTracks = p.tracks_by_artist[p.artist_name];
              if (artistTracks.length > 0 && artistTracks[0].position) {
                trackPosition = Math.min(...artistTracks.map((t: any) => t.position || Infinity));
              }
            }
            
            return {
              id: p.id,
              artist_name: p.artist_name,
              playlist_name: p.playlist_name,
              playlist_url: p.playlist_url,
              platform: p.platform || 'VK Музыка',
              playlist_cover_url: p.playlist_cover_url || "/placeholder.svg",
              parsed_at: p.parsed_at,
              added_at: p.added_at,
              tracks_count: p.tracks_count || 0,
              multiple_tracks: p.multiple_tracks || false,
              tracks_info: p.tracks_info || [],
              track_position: trackPosition,
              release_names: p.release_names || []
            };
          });
        
        return NextResponse.json({
          success: true,
          results: vkPlaylists,
          source: 'sftp'
        });
      } catch (error) {
        console.error('Ошибка получения данных из SFTP, используем парсинг:', error);
        // Fallback на парсинг при ошибке
      }
    }
    
    // Используем данные из парсинга
    const results = await readVKResults();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Ошибка получения результатов VK:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Ошибка получения результатов' 
    }, { status: 500 });
  }
}
