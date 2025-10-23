import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sqlite3 from 'sqlite3';

// Путь к БД
const DB_PATH = path.join(process.cwd(), 'bandlink_playlists.db');

// Вспомогательная функция для работы с БД
function getDb() {
  return new sqlite3.Database(DB_PATH);
}

const dbGet = (db: sqlite3.Database, sql: string, params?: any[]) => {
  return new Promise<any>((resolve, reject) => {
    db.get(sql, params || [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// GET: Проверка уведомлений о необходимости новых cookies
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    // Получаем статус парсера
    const status = await dbGet(db, `
      SELECT status, last_run, needs_new_cookies, failed_attempts 
      FROM parser_status 
      WHERE id = 1
    `);
    
    db.close();
    
    if (!status) {
      return NextResponse.json({
        success: true,
        hasNotification: false,
        message: null
      });
    }
    
    // Проверяем нужны ли новые cookies
    const needsNewCookies = status.needs_new_cookies === 1;
    
    let message = null;
    if (needsNewCookies) {
      message = `⚠️ Требуются новые cookies! Парсинг не работает после ${status.failed_attempts} неудачных попыток.`;
    }
    
    return NextResponse.json({
      success: true,
      hasNotification: needsNewCookies,
      message,
      status: {
        status: status.status,
        lastRun: status.last_run,
        needsNewCookies: needsNewCookies,
        failedAttempts: status.failed_attempts
      }
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка проверки уведомлений:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка проверки уведомлений' },
      { status: 500 }
    );
  }
}



