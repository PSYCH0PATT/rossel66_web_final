import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { addActivity, getUserByUsername } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    console.log('📥 Получен запрос:', JSON.stringify(requestBody, null, 2));
    
    const { artists } = requestBody;
    
    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'Список артистов не предоставлен' }, { status: 400 });
    }

    console.log('Запуск Bandlink парсера для артистов:', artists);
    
    // Получаем API ключ Bright Data из переменных окружения
    const brightDataApiKey = process.env.BRIGHT_DATA_API_KEY;
    console.log('🔍 Проверка API ключа Bright Data:');
    console.log('  - BRIGHT_DATA_API_KEY exists:', !!brightDataApiKey);
    console.log('  - BRIGHT_DATA_API_KEY length:', brightDataApiKey?.length);
    console.log('  - BRIGHT_DATA_API_KEY type:', typeof brightDataApiKey);
    
    // Проверяем наличие API ключа Bright Data
    if (!brightDataApiKey || brightDataApiKey.trim() === '') {
      console.error('❌ Bright Data API ключ не настроен в переменных окружения!');
      console.error('💡 Добавьте BRIGHT_DATA_API_KEY в .env.local файл');
      return NextResponse.json({ error: 'Bright Data API ключ не настроен на сервере. Обратитесь к администратору.' }, { status: 500 });
    } else {
      console.log('🔑 Bright Data API ключ найден:', brightDataApiKey.substring(0, 20) + '...');
    }

    // Создаем временный конфиг файл
    const configPath = path.join(process.cwd(), 'temp_bandlink_config.json');
    const config = {
      target_artists: artists, // Для bandlink передаем только никнеймы
      bright_data_api_key: brightDataApiKey // Добавляем API ключ Bright Data из переменных окружения
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Конфиг файл создан с API ключом из переменных окружения');

    // Запускаем Python скрипт (Web Unlocker API версия для production)
    const pythonScript = path.join(process.cwd(), 'parsers', 'bandlink_parser_unlocker_linux.py');
    
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

        if (code === 0) {
          // Читаем результаты из базы данных
          try {
            const results = await readBandlinkResults();
            
            // Создаем активность для каждого найденного артиста
            for (const artist of artists) {
              const artistData = getUserByUsername(artist);
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
                  
                  addActivity({
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

async function readBandlinkResults() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(process.cwd(), 'bandlink_playlists_unlocker.db');
    
    if (!fs.existsSync(dbPath)) {
      return [];
    }
    
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

export async function GET() {
  try {
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
