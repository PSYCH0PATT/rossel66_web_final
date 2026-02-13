import * as fs from 'fs';
import * as path from 'path';
import { findArtistByName, normalizeArtistName } from '@/lib/storage';

export interface CsvRecord {
  title_artist: string;
  url: string;
  playlist_name: string;
  parsed_date: string;
  track_position: string;
  DSP: string;
  release_date: string;
  cpline: string;
  album_title: string;
  label: string;
  isrc: string;
  licensee: string;
}

export interface ParsedTrack {
  /** Полная строка из CSV: "Артист - Трек" */
  titleArtist: string;
  /** Название трека без артиста (извлечено из title_artist) */
  trackTitle: string;
  artistName: string;
  artistId: string | null;
  position: number;
  isrc: string;
  releaseDate: string;
  parsedDate: string;
  albumTitle: string;
  label: string;
}

export interface ParsedPlaylist {
  playlistUrl: string;
  playlistName: string;
  platform: string;
  tracks: ParsedTrack[];
  parsedDate: string;
}

const REQUIRED_CSV_HEADERS = [
  'title_artist',
  'url',
  'playlist_name',
  'parsed_date',
  'track_position',
  'DSP',
  'release_date',
  'cpline',
  'album_title',
  'label',
  'isrc',
  'licensee'
];

function validateCsvHeaders(headers: string[]): { valid: boolean; missing?: string[] } {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_CSV_HEADERS.filter(
    (required) => !normalized.includes(required.toLowerCase())
  );
  return missing.length === 0 ? { valid: true } : { valid: false, missing };
}

/**
 * Извлекает имя артиста из title_artist (формат "Артист - Трек")
 * "PLVT - stars" -> "PLVT"
 * "sadaround - Not Broken" -> "sadaround"
 * "MEELBRN & keroms - ROTTEN" -> "MEELBRN & keroms"
 */
export function extractArtistName(titleArtist: string): string {
  const match = titleArtist.match(/^([^-]+?)\s*-\s*/);
  return match ? match[1].trim() : titleArtist;
}

/**
 * Извлекает название трека из title_artist (формат "Артист - Трек")
 * "rompy - //M1NVT3" -> "//M1NVT3"
 * "sadaround - Not Broken" -> "Not Broken"
 * "MEELBRN & keroms - ROTTEN" -> "ROTTEN"
 */
export function extractTrackTitle(titleArtist: string): string {
  const sep = ' - ';
  const idx = titleArtist.indexOf(sep);
  return idx >= 0 ? titleArtist.slice(idx + sep.length).trim() : titleArtist;
}

/**
 * Маппинг DSP на название платформы
 */
export function mapDspToPlatform(dsp: string): string {
  const dspLower = dsp.toLowerCase().trim();
  
  const platformMap: Record<string, string> = {
    'yandex': 'Яндекс Музыка',
    'vk': 'VK Музыка',
    'mts': 'МТС Музыка',
    'sber': 'Сбер Музыка',
    'ок': 'Одноклассники',
    'ok': 'Одноклассники',
    'spotify': 'Spotify',
    'apple': 'Apple Music',
    'youtube': 'YouTube Music'
  };
  
  return platformMap[dspLower] || dsp;
}

/**
 * Парсит CSV файл с разделителем ;
 */
export function parseCsvFile(filePath: string): CsvRecord[] {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.length > 0 && content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const validation = validateCsvHeaders(headers);
  if (!validation.valid && validation.missing?.length) {
    throw new Error(
      `Неверная структура CSV: отсутствуют колонки: ${validation.missing.join(', ')}`
    );
  }

  const records: CsvRecord[] = [];
  
  // Парсим данные
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    
    if (values.length === 0 || !values[0]) {
      continue;
    }
    
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record as CsvRecord);
  }
  
  return records;
}

/**
 * Парсит строку CSV с учетом кавычек и разделителя ;
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Добавляем последнее значение
  values.push(current.trim());
  
  return values;
}

/**
 * Группирует записи по плейлистам
 */
export function groupByPlaylist(records: CsvRecord[]): Map<string, ParsedPlaylist> {
  const playlists = new Map<string, ParsedPlaylist>();
  
  for (const record of records) {
    const key = `${record.url}|${record.playlist_name}`;
    
    if (!playlists.has(key)) {
      playlists.set(key, {
        playlistUrl: record.url,
        playlistName: record.playlist_name,
        platform: mapDspToPlatform(record.DSP),
        tracks: [],
        parsedDate: record.parsed_date
      });
    }
    
    const playlist = playlists.get(key)!;
    const artistName = normalizeArtistName(extractArtistName(record.title_artist));
    const artist = findArtistByName(artistName);
    
    playlist.tracks.push({
      titleArtist: record.title_artist,
      trackTitle: extractTrackTitle(record.title_artist),
      artistName,
      artistId: artist?.id || null,
      position: parseInt(record.track_position) || 0,
      isrc: record.isrc,
      releaseDate: record.release_date,
      parsedDate: record.parsed_date,
      albumTitle: record.album_title,
      label: record.label
    });
  }
  
  // Сортируем треки по позиции
  playlists.forEach(playlist => {
    playlist.tracks.sort((a, b) => a.position - b.position);
  });
  
  return playlists;
}

/**
 * Обрабатывает все CSV файлы и возвращает плейлисты
 */
export function processCsvFiles(filePaths: string[]): ParsedPlaylist[] {
  const allPlaylists = new Map<string, ParsedPlaylist>();
  
  console.log(`📊 Начинаю обработку ${filePaths.length} CSV файлов...`);
  
  for (const filePath of filePaths) {
    try {
      console.log(`📄 Обрабатываю файл: ${path.basename(filePath)}`);
      const records = parseCsvFile(filePath);
      console.log(`   Найдено записей: ${records.length}`);
      
      if (records.length === 0) {
        console.log(`   ⚠️  Файл пуст или не содержит данных`);
        continue;
      }
      
      const playlists = groupByPlaylist(records);
      console.log(`   Сгруппировано плейлистов: ${playlists.size}`);
      
      // Объединяем плейлисты (если плейлист уже есть, добавляем треки)
      playlists.forEach((playlist, key) => {
        if (allPlaylists.has(key)) {
          // Плейлист уже есть - добавляем треки
          const existing = allPlaylists.get(key)!;
          existing.tracks.push(...playlist.tracks);
          // Сортируем по позиции
          existing.tracks.sort((a, b) => a.position - b.position);
          // Обновляем дату парсинга на более новую
          if (playlist.parsedDate > existing.parsedDate) {
            existing.parsedDate = playlist.parsedDate;
          }
        } else {
          allPlaylists.set(key, playlist);
        }
      });
    } catch (error: any) {
      console.error(`❌ Ошибка обработки файла ${filePath}:`, error.message);
      console.error(error.stack);
    }
  }
  
  console.log(`✅ Всего обработано плейлистов: ${allPlaylists.size}`);
  return Array.from(allPlaylists.values());
}
