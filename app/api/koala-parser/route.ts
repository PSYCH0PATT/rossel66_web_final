import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { 
  getReleaseByKoalaId,
  findArtistByName,
  addActivity,
  updateRelease,
  addReleaseWithActivities,
  addUser,
  getUserByUsername,
  assignReleasesToNewArtist
} from '@/lib/storage';
import { nicknameToUsername } from '@/lib/utils';
import { splitCollaboratingArtistDisplayNames } from '@/lib/split-artist-names';
import { requireAdminOrCron } from '@/lib/server-auth';
import { rateLimitParser } from '@/lib/rate-limit';

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
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = rateLimitParser(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Слишком много запросов' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
    );
  }

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
export async function GET(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;

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

// Нормализует статус релиза к стандартным значениям
function normalizeStatus(status: string): string {
  const statusLower = status.toLowerCase().trim();
  
  // Маппинг старых статусов на новые
  const statusMap: Record<string, string> = {
    'новый': 'Доставлен',
    'на модерации': 'Модерируется',
    'модерируется': 'Модерируется',
    'модерация': 'Модерируется',
    'одобрен': 'Доставлен',
    'отклонён': 'Отклонен',
    'отклонен': 'Отклонен',
    'в доставке': 'В доставке',
    'доставлен': 'Доставлен',
    'снят': 'Отклонен',
    'released': 'Доставлен',
    'moderation': 'Модерируется',
    'delivery': 'В доставке',
    'scheduled': 'Модерируется',
  };
  
  return statusMap[statusLower] || 'Доставлен';
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
  
  for (const koalaRelease of koalaReleases) {
    try {
      // Парсим список артистов: запятая, &, feat/ft/featuring, x, и/and
      const artistNames = splitCollaboratingArtistDisplayNames(koalaRelease.artist || "");
      if (artistNames.length === 0) {
        stats.errors.push(`${koalaRelease.title}: пустое поле артиста`);
        stats.skipped++;
        continue;
      }

      // Ищем артистов в системе, создаём если не найдены
      const validArtists = [];
      for (const artistName of artistNames) {
        let artist = await findArtistByName(artistName);
        
        if (!artist) {
          // Автоматически создаём профиль артиста (неподтвержденный). Логин = ник (транслит)
          const baseLogin = nicknameToUsername(artistName);
          let username = baseLogin;
          if (await getUserByUsername(username)) {
            username = baseLogin + '_' + Date.now().toString(36);
          }
          console.log(`➕ Создаём нового артиста: ${artistName} (логин: ${username})`);
          const newArtist = await addUser({
            username,
            name: artistName,
            email: '',
            role: 'artist',
            password: Math.random().toString(36).slice(-12),
            verified: false
          });
          artist = newArtist;
          
          await addActivity({
            type: 'artist_auto_created',
            userId: 'system',
            userRole: 'admin',
            title: 'Артист создан автоматически',
            description: `Профиль артиста "${artistName}" создан парсером Koala`,
            metadata: { artistId: newArtist.id, source: 'koala' }
          });
          
          // Привязываем существующие релизы без артиста к новому артисту
          try {
            const assignedCount = await assignReleasesToNewArtist(newArtist.id, artistName, username);
            if (assignedCount > 0) {
              console.log(`  ✅ Привязано ${assignedCount} релиз(ов) к артисту ${artistName}`);
            }
          } catch (error) {
            console.error(`  ⚠️ Ошибка привязки релизов к артисту ${artistName}:`, error);
          }
        }
        
        validArtists.push(artist);
      }
      
      // Проверяем, существует ли релиз с таким koalaId
      const existingRelease = await getReleaseByKoalaId(koalaRelease.koala_id);
      
      if (existingRelease) {
        // Обновляем существующий релиз (без нового уведомления)
        const updates: any = {
          status: normalizeStatus(koalaRelease.status),
          updatedAt: new Date().toISOString()
        };
        
        // Добавляем UPC если статус "Доставлен" и UPC есть
        if (koalaRelease.status === 'Доставлен' && koalaRelease.upc) {
          updates.upc = koalaRelease.upc;
        }
        
        // Обновляем BandLink если есть
        if (koalaRelease.bandlink_url) {
          updates.bandlinkUrl = koalaRelease.bandlink_url;
        }

        if (validArtists.length > 1) {
          updates.featuredArtistIds = validArtists.slice(1).map((a) => a.id);
        }
        
        await updateRelease(existingRelease.id, updates);
        console.log(`🔄 Обновлен релиз "${koalaRelease.title}"`);
        stats.updated++;
      } else {
        // Один релиз на один koala-релиз (первый артист из списка) — без дублей и двойных уведомлений
        const artist = validArtists[0];
        let releaseDate = new Date().toISOString().split('T')[0];
        if (koalaRelease.release_date) {
          const dateParts = koalaRelease.release_date.split('.');
          if (dateParts.length === 3) {
            releaseDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
          }
        }
        
        let tracks = koalaRelease.isrc_codes.map((isrc, index) => ({
          id: `track_${Date.now()}_${index}`,
          title: koalaRelease.title,
          duration: '0:00',
          isrc: isrc || undefined,
        }));
        if (tracks.length === 0) {
          tracks = [
            {
              id: `track_${Date.now()}_0`,
              title: koalaRelease.title,
              duration: '0:00',
              isrc: undefined,
            },
          ];
        }
        
        const normalizedStatus = normalizeStatus(koalaRelease.status);
        const featuredArtistIds =
          validArtists.length > 1 ? validArtists.slice(1).map((a) => a.id) : undefined;
        const newReleaseData: any = {
          title: koalaRelease.title,
          artistId: artist.id,
          artistName: koalaRelease.artist,
          ...(featuredArtistIds?.length ? { featuredArtistIds } : {}),
          releaseDate,
          type: tracks.length > 1 ? 'album' : 'single' as 'single' | 'album' | 'ep',
          coverUrl: koalaRelease.cover_url || '',
          tracks,
          status: normalizedStatus,
          koalaId: koalaRelease.koala_id,
          bandlinkUrl: koalaRelease.bandlink_url || undefined,
          upc: koalaRelease.upc || undefined
        };
        
        await addReleaseWithActivities(newReleaseData, (createdRelease) => [
          {
            type: 'release_added',
            userId: artist.id,
            userRole: 'artist',
            title: 'Новый релиз добавлен',
            description: `Добавлен релиз "${koalaRelease.title}"`,
            metadata: {
              releaseId: createdRelease.id,
              koalaId: koalaRelease.koala_id,
              status: koalaRelease.status
            }
          },
          {
            type: 'release_added',
            userId: 'system',
            userRole: 'admin',
            title: 'Новый релиз добавлен',
            description: `Добавлен релиз "${koalaRelease.title}" (артист: ${artist.name || artist.username})`,
            metadata: {
              releaseId: createdRelease.id,
              koalaId: koalaRelease.koala_id,
              status: koalaRelease.status,
              artistId: artist.id,
              artistName: artist.name
            }
          }
        ]);
        console.log(`✅ Добавлен релиз "${koalaRelease.title}" для артиста ${artist.name}`);
        stats.added++;
      }
      
    } catch (error) {
      console.error(`❌ Ошибка обработки релиза "${koalaRelease.title}":`, error);
      stats.errors.push(`${koalaRelease.title}: ${String(error)}`);
    }
  }
  
  return stats;
}


