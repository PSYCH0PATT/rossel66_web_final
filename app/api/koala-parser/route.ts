import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { 
  loadReleases, 
  saveReleases, 
  loadUsers, 
  getReleaseByKoalaId,
  findArtistByName,
  addActivity 
} from '@/lib/storage';

// Интерфейс для результата парсинга
interface KoalaRelease {
  koala_id: string;
  title: string;
  artist: string;
  status: string;
  release_date: string | null;
  upc: string | null;
  bandlink_url: string | null;
  cover_url: string | null;
  isrc_codes: string[];
  parsed_at: string;
}

// Интерфейс для статистики парсинга
interface ParseStats {
  total: number;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Файл для хранения статуса последнего парсинга
const STATUS_FILE = path.join(process.cwd(), 'data', 'koala_parser_status.json');

// Сохранение статуса парсинга
function saveParserStatus(status: {
  lastRun: string;
  success: boolean;
  stats: ParseStats;
  message: string;
}) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения статуса:', error);
  }
}

// Загрузка статуса парсинга
function loadParserStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка загрузки статуса:', error);
  }
  return null;
}

// POST - запуск парсинга
export async function POST(request: NextRequest) {
  console.log('🚀 Запуск Koala Parser...');
  
  try {
    const pythonScript = path.join(process.cwd(), 'parsers', 'koala_releases_parser.py');
    const configPath = path.join(process.cwd(), 'parsers', 'koala_config.json');
    const outputPath = path.join(process.cwd(), 'parsers', 'koala_output.json');
    
    // Проверяем наличие файлов
    if (!fs.existsSync(pythonScript)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Python парсер не найден' 
      }, { status: 500 });
    }
    
    return new Promise<NextResponse>((resolve) => {
      let output = '';
      let errorOutput = '';
      
      // Запускаем Python парсер
      const pythonProcess = spawn('python3', [pythonScript, '-c', configPath, '-o', outputPath], {
        cwd: process.cwd()
      });
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Koala Parser:', data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Koala Parser Error:', data.toString());
      });
      
      pythonProcess.on('close', async (code) => {
        console.log(`Python процесс завершился с кодом ${code}`);
        
        if (code !== 0) {
          saveParserStatus({
            lastRun: new Date().toISOString(),
            success: false,
            stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [errorOutput] },
            message: `Python процесс завершился с кодом ${code}`
          });
          
          resolve(NextResponse.json({ 
            success: false, 
            error: `Python процесс завершился с кодом ${code}`,
            stderr: errorOutput 
          }, { status: 500 }));
          return;
        }
        
        // Читаем результаты из JSON файла
        let parsedReleases: KoalaRelease[] = [];
        try {
          if (fs.existsSync(outputPath)) {
            const outputData = fs.readFileSync(outputPath, 'utf8');
            parsedReleases = JSON.parse(outputData);
          }
        } catch (e) {
          // Пробуем извлечь JSON из stdout
          const jsonMatch = output.match(/JSON_OUTPUT_START\n([\s\S]*?)\nJSON_OUTPUT_END/);
          if (jsonMatch) {
            parsedReleases = JSON.parse(jsonMatch[1]);
          }
        }
        
        if (parsedReleases.length === 0) {
          saveParserStatus({
            lastRun: new Date().toISOString(),
            success: true,
            stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [] },
            message: 'Новых релизов не найдено'
          });
          
          resolve(NextResponse.json({ 
            success: true, 
            message: 'Новых релизов не найдено',
            stats: { total: 0, added: 0, updated: 0, skipped: 0 }
          }));
          return;
        }
        
        // Обрабатываем релизы
        const stats = await processReleases(parsedReleases);
        
        saveParserStatus({
          lastRun: new Date().toISOString(),
          success: true,
          stats,
          message: `Обработано ${stats.total} релизов`
        });
        
        resolve(NextResponse.json({ 
          success: true, 
          message: 'Парсинг завершен успешно',
          stats,
          releases: parsedReleases
        }));
      });
    });
    
  } catch (error) {
    console.error('Ошибка Koala Parser:', error);
    
    saveParserStatus({
      lastRun: new Date().toISOString(),
      success: false,
      stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [String(error)] },
      message: String(error)
    });
    
    return NextResponse.json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
}

// GET - получить статус последнего парсинга
export async function GET() {
  try {
    const status = loadParserStatus();
    
    if (!status) {
      return NextResponse.json({ 
        success: true, 
        message: 'Парсинг еще не запускался',
        status: null
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      status 
    });
    
  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Ошибка получения статуса' 
    }, { status: 500 });
  }
}

// Функция обработки релизов
async function processReleases(koalaReleases: KoalaRelease[]): Promise<ParseStats> {
  const stats: ParseStats = {
    total: koalaReleases.length,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };
  
  const releases = loadReleases();
  const users = loadUsers();
  
  for (const koalaRelease of koalaReleases) {
    try {
      // Парсим список артистов из строки
      const artistNames = koalaRelease.artist
        .split(/[,&]/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
      
      // Ищем артистов в системе
      const matchedArtists = artistNames
        .map(name => findArtistByName(name))
        .filter((artist): artist is NonNullable<typeof artist> => artist !== null);
      
      if (matchedArtists.length === 0) {
        console.log(`⏭️ Пропускаем "${koalaRelease.title}" - артисты не найдены в системе`);
        stats.skipped++;
        continue;
      }
      
      // Проверяем, существует ли релиз с таким koalaId
      const existingRelease = getReleaseByKoalaId(koalaRelease.koala_id);
      
      if (existingRelease) {
        // Обновляем существующий релиз
        const releaseIndex = releases.findIndex(r => r.id === existingRelease.id);
        if (releaseIndex !== -1) {
          // Обновляем статус
          releases[releaseIndex].status = koalaRelease.status;
          
          // Добавляем UPC если статус "Доставлен" и UPC есть
          if (koalaRelease.status === 'Доставлен' && koalaRelease.upc) {
            releases[releaseIndex].upc = koalaRelease.upc;
          }
          
          // Обновляем BandLink если есть
          if (koalaRelease.bandlink_url) {
            releases[releaseIndex].bandlinkUrl = koalaRelease.bandlink_url;
          }
          
          releases[releaseIndex].updatedAt = new Date().toISOString();
          
          console.log(`🔄 Обновлен релиз "${koalaRelease.title}"`);
          stats.updated++;
        }
      } else {
        // Создаем новый релиз для каждого найденного артиста
        for (const artist of matchedArtists) {
          // Парсим дату релиза
          let releaseDate = new Date().toISOString().split('T')[0];
          if (koalaRelease.release_date) {
            // Конвертируем из ДД.ММ.ГГГГ в YYYY-MM-DD
            const dateParts = koalaRelease.release_date.split('.');
            if (dateParts.length === 3) {
              releaseDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
          }
          
          // Создаем треки из ISRC кодов
          const tracks = koalaRelease.isrc_codes.map((isrc, index) => ({
            id: `track_${Date.now()}_${index}`,
            title: koalaRelease.title, // Используем название релиза для трека
            duration: '0:00',
            isrc
          }));
          
          // Если нет ISRC, создаем один трек без него
          if (tracks.length === 0) {
            tracks.push({
              id: `track_${Date.now()}_0`,
              title: koalaRelease.title,
              duration: '0:00',
              isrc: undefined
            });
          }
          
          const newRelease = {
            id: `release_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: koalaRelease.title,
            artistId: artist.id,
            releaseDate,
            type: tracks.length > 1 ? 'album' : 'single' as 'single' | 'album' | 'ep',
            coverUrl: koalaRelease.cover_url || '',
            tracks,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: koalaRelease.status,
            koalaId: koalaRelease.koala_id,
            bandlinkUrl: koalaRelease.bandlink_url || undefined,
            upc: koalaRelease.upc || undefined
          };
          
          releases.push(newRelease);
          
          // Создаем активность
          addActivity({
            type: 'release_added',
            userId: artist.id,
            userRole: 'artist',
            title: 'Новый релиз добавлен',
            description: `Релиз "${koalaRelease.title}" добавлен из Koala Music`,
            metadata: { 
              releaseId: newRelease.id, 
              koalaId: koalaRelease.koala_id,
              status: koalaRelease.status
            }
          });
          
          console.log(`✅ Добавлен релиз "${koalaRelease.title}" для артиста ${artist.name}`);
        }
        
        stats.added++;
      }
      
    } catch (error) {
      console.error(`❌ Ошибка обработки релиза "${koalaRelease.title}":`, error);
      stats.errors.push(`${koalaRelease.title}: ${String(error)}`);
    }
  }
  
  // Сохраняем обновленные релизы
  saveReleases(releases);
  
  return stats;
}


