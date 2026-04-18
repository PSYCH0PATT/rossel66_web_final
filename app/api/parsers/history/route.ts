import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { requireAdminOrCron } from '@/lib/server-auth';

// Пути к БД
const BANDLINK_DB_PATH = path.join(process.cwd(), 'bandlink_playlists.db');
const VK_DB_PATH = path.join(process.cwd(), 'vk_playlists.db');

// Вспомогательные функции для работы с БД
function getDb(dbPath: string) {
  return new sqlite3.Database(dbPath);
}

const dbRun = (db: sqlite3.Database, sql: string, params?: any[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (db: sqlite3.Database, sql: string, params?: any[]) => {
  return new Promise<any[]>((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Инициализация таблицы истории парсинга
async function ensureParsingHistoryTable(dbPath: string, tableName: string) {
  const db = getDb(dbPath);
  
  try {
    await dbRun(db, `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parser_type TEXT NOT NULL,
        artists TEXT NOT NULL,
        playlists_found INTEGER DEFAULT 0,
        playlists_added INTEGER DEFAULT 0,
        errors TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status TEXT DEFAULT 'running'
      )
    `);
    console.log(`✅ Таблица ${tableName} инициализирована`);
  } catch (error) {
    console.error(`❌ Ошибка создания таблицы ${tableName}:`, error);
  } finally {
    db.close();
  }
}

// GET: Получение истории парсинга
export async function GET(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;

  const parserType = request.nextUrl.searchParams.get('type') || 'all'; // 'bandlink', 'vk', 'all'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  
  try {
    const history: any[] = [];
    
    // Получаем историю Bandlink
    if (parserType === 'all' || parserType === 'bandlink') {
      await ensureParsingHistoryTable(BANDLINK_DB_PATH, 'parsing_history');
      const db = getDb(BANDLINK_DB_PATH);
      const bandlinkHistory = await dbAll(db, `
        SELECT * FROM parsing_history 
        WHERE parser_type = 'bandlink'
        ORDER BY started_at DESC 
        LIMIT ?
      `, [limit]);
      db.close();
      history.push(...bandlinkHistory);
    }
    
    // Получаем историю VK
    if (parserType === 'all' || parserType === 'vk') {
      await ensureParsingHistoryTable(VK_DB_PATH, 'parsing_history');
      const db = getDb(VK_DB_PATH);
      const vkHistory = await dbAll(db, `
        SELECT * FROM parsing_history 
        WHERE parser_type = 'vk'
        ORDER BY started_at DESC 
        LIMIT ?
      `, [limit]);
      db.close();
      history.push(...vkHistory);
    }
    
    // Сортируем по дате
    history.sort((a, b) => {
      const dateA = new Date(a.started_at).getTime();
      const dateB = new Date(b.started_at).getTime();
      return dateB - dateA;
    });
    
    return NextResponse.json({
      success: true,
      history: history.slice(0, limit)
    });
    
  } catch (error) {
    console.error('Ошибка получения истории парсинга:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения истории парсинга'
    }, { status: 500 });
  }
}

// POST: Создание записи истории парсинга
export async function POST(request: NextRequest) {
  const denied = await requireAdminOrCron(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { parserType, artists, playlistsFound = 0, playlistsAdded = 0, errors, status = 'completed' } = body;
    
    if (!parserType || !artists) {
      return NextResponse.json({
        success: false,
        error: 'parserType и artists обязательны'
      }, { status: 400 });
    }
    
    const dbPath = parserType === 'bandlink' ? BANDLINK_DB_PATH : VK_DB_PATH;
    await ensureParsingHistoryTable(dbPath, 'parsing_history');
    
    const db = getDb(dbPath);
    const artistsStr = Array.isArray(artists) ? artists.join(', ') : artists;
    const errorsStr = errors ? (typeof errors === 'string' ? errors : JSON.stringify(errors)) : null;
    
    await dbRun(db, `
      INSERT INTO parsing_history 
      (parser_type, artists, playlists_found, playlists_added, errors, status, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [parserType, artistsStr, playlistsFound, playlistsAdded, errorsStr, status]);
    
    db.close();
    
    return NextResponse.json({
      success: true,
      message: 'История парсинга сохранена'
    });
    
  } catch (error) {
    console.error('Ошибка сохранения истории парсинга:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка сохранения истории парсинга'
    }, { status: 500 });
  }
}
