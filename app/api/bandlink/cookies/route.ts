import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Путь к БД
const DB_PATH = path.join(process.cwd(), 'bandlink_playlists.db');

// Вспомогательная функция для работы с БД
function getDb() {
  return new sqlite3.Database(DB_PATH);
}

// Промисифицированные методы
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
      else resolve(rows);
    });
  });
};

// Парсинг cookies из curl команды
function parseCurlCookies(curlCommand: string): { name: string; value: string }[] {
  const cookies: { name: string; value: string }[] = [];
  
  // Ищем строку с Cookie заголовком
  const cookieMatch = curlCommand.match(/-H\s+['"]Cookie:\s*(.+?)['"]/i);
  
  if (!cookieMatch) {
    return cookies;
  }
  
  const cookieString = cookieMatch[1];
  
  // Разбиваем на отдельные cookies
  const cookiePairs = cookieString.split(/;\s*/);
  
  for (const pair of cookiePairs) {
    const [name, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // На случай если в значении есть '='
    
    if (name && value) {
      cookies.push({
        name: name.trim(),
        value: value.trim()
      });
    }
  }
  
  return cookies;
}

// GET: Получение текущих cookies
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    // Получаем cookies
    const cookies = await dbAll(db, 'SELECT cookie_name, cookie_value, updated_at FROM bandlink_cookies ORDER BY id');
    
    // Получаем время последнего обновления
    let lastUpdated = null;
    if (cookies.length > 0) {
      const maxUpdated = cookies.reduce((max, cookie) => {
        const date = new Date(cookie.updated_at);
        return date > max ? date : max;
      }, new Date(0));
      lastUpdated = maxUpdated.toISOString();
    }
    
    db.close();
    
    return NextResponse.json({
      success: true,
      cookies: cookies.map(c => ({
        name: c.cookie_name,
        value: c.cookie_value
      })),
      count: cookies.length,
      lastUpdated
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка получения cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения cookies' },
      { status: 500 }
    );
  }
}

// POST: Обновление cookies из curl команды
export async function POST(request: NextRequest) {
  const db = getDb();
  
  try {
    const body = await request.json();
    const { curlCommand } = body;
    
    if (!curlCommand) {
      db.close();
      return NextResponse.json(
        { success: false, error: 'Curl команда не предоставлена' },
        { status: 400 }
      );
    }
    
    // Парсим cookies из curl команды
    const cookies = parseCurlCookies(curlCommand);
    
    if (cookies.length === 0) {
      db.close();
      return NextResponse.json(
        { success: false, error: 'Cookies не найдены в curl команде. Убедитесь, что присутствует заголовок -H \'Cookie: ...\'' },
        { status: 400 }
      );
    }
    
    console.log(`📥 Получено ${cookies.length} cookies для обновления`);
    
    // Удаляем старые cookies
    await dbRun(db, 'DELETE FROM bandlink_cookies');
    console.log('🗑️  Старые cookies удалены');
    
    // Вставляем новые cookies
    const now = new Date().toISOString();
    for (const cookie of cookies) {
      await dbRun(db, `
        INSERT INTO bandlink_cookies (cookie_name, cookie_value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `, [cookie.name, cookie.value, now, now]);
    }
    
    console.log(`✅ Вставлено ${cookies.length} новых cookies`);
    
    // Сбрасываем флаг needs_new_cookies в parser_status
    await dbRun(db, `
      UPDATE parser_status 
      SET needs_new_cookies = 0, failed_attempts = 0 
      WHERE id = 1
    `);
    
    console.log('🔄 Статус парсера сброшен (needs_new_cookies = 0)');
    
    db.close();
    
    return NextResponse.json({
      success: true,
      message: `Cookies успешно обновлены (${cookies.length} шт.)`,
      count: cookies.length,
      cookieNames: cookies.map(c => c.name)
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка обновления cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления cookies' },
      { status: 500 }
    );
  }
}

// DELETE: Удаление всех cookies
export async function DELETE(request: NextRequest) {
  const db = getDb();
  
  try {
    await dbRun(db, 'DELETE FROM bandlink_cookies');
    
    db.close();
    
    return NextResponse.json({
      success: true,
      message: 'Все cookies удалены'
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка удаления cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления cookies' },
      { status: 500 }
    );
  }
}

