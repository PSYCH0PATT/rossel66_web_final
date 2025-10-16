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
    
    // Получаем proxy credentials Bright Data из переменных окружения
    const brightDataProxyUsername = process.env.BRIGHT_DATA_PROXY_USERNAME;
    const brightDataProxyPassword = process.env.BRIGHT_DATA_PROXY_PASSWORD;
    
    console.log('🔍 Проверка Bright Data proxy credentials:');
    console.log('  - BRIGHT_DATA_PROXY_USERNAME exists:', !!brightDataProxyUsername);
    console.log('  - BRIGHT_DATA_PROXY_PASSWORD exists:', !!brightDataProxyPassword);
    
    // Проверяем наличие proxy credentials
    if (!brightDataProxyUsername || !brightDataProxyPassword) {
      console.error('❌ Bright Data proxy credentials не настроены в переменных окружения!');
      console.error('💡 Добавьте BRIGHT_DATA_PROXY_USERNAME и BRIGHT_DATA_PROXY_PASSWORD в .env.local файл');
      console.log('🔄 Используем fallback credentials из кода...');
    } else {
      console.log('🔑 Bright Data proxy credentials найдены');
      console.log('  - Username:', brightDataProxyUsername.substring(0, 30) + '...');
      console.log('  - Password:', '*'.repeat(brightDataProxyPassword.length));
    }

    // Создаем временный конфиг файл
    const configPath = path.join(process.cwd(), 'temp_bandlink_config.json');
    const config = {
      target_artists: artists, // Список имен артистов (например: ["Sour Diesel", "Wide Pie"])
      bright_data_proxy_username: process.env.BRIGHT_DATA_PROXY_USERNAME || "brd-customer-hl_94d02fd9-zone-web_unlocker1",
      bright_data_proxy_password: process.env.BRIGHT_DATA_PROXY_PASSWORD || "bp8k2m4ji1za"
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Конфиг файл создан с proxy credentials');
    console.log('📋 Конфиг содержит:');
    console.log('  - target_artists:', artists);
    console.log('  - bright_data_proxy_username:', config.bright_data_proxy_username.substring(0, 30) + '...');
    console.log('  - bright_data_proxy_password:', '*'.repeat(config.bright_data_proxy_password.length));

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
            
            // Извлекаем HTML из логов
            const htmlData = extractHtmlFromOutput(output);
            
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
