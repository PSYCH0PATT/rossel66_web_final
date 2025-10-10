import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { addActivity, getUserByUsername } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const { artists } = await request.json();
    
    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json({ error: 'Список артистов не предоставлен' }, { status: 400 });
    }

    console.log('Запуск VK парсера для артистов:', artists);

    // Создаем временный конфиг файл
    const configPath = path.join(process.cwd(), 'temp_vk_config.json');
    const config = {
      target_artists: artists.map(artist => `https://vk.com/artist/${artist}`)
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
            
            // Создаем активность для каждого найденного артиста
            for (const artist of artists) {
              const artistData = getUserByUsername(artist);
              if (artistData) {
                const artistPlaylists = results.filter((r: any) => r.artist_name === artistData.name);
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
                  
                  addActivity({
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

async function readVKResults() {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(process.cwd(), 'vk_playlists.db');
    
    if (!fs.existsSync(dbPath)) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      
      db.all(`
        SELECT * FROM artist_playlists 
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

export async function GET() {
  try {
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
