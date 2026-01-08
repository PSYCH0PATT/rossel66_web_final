import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sqlite3 from 'sqlite3';

// Путь к БД для VK
const DB_PATH = path.join(process.cwd(), 'vk_playlists.db');

// Вспомогательная функция для работы с БД
function getDb() {
  const db = new sqlite3.Database(DB_PATH);
  
  // Создаем таблицу если не существует
  db.run(`
    CREATE TABLE IF NOT EXISTS vk_cookies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cookie_name TEXT NOT NULL UNIQUE,
      cookie_value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
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

// Парсинг cookies из текстового формата (name\nvalue\nname\nvalue...)
function parseTextCookies(text: string): { name: string; value: string }[] {
  const cookies: { name: string; value: string }[] = [];
  
  // Разбиваем текст на строки и обрабатываем пары
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (let i = 0; i < lines.length; i += 2) {
    const name = lines[i];
    const value = lines[i + 1];
    
    if (name && value) {
      cookies.push({ name, value });
    }
  }
  
  return cookies;
}

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
    const value = valueParts.join('=');
    
    if (name && value) {
      cookies.push({
        name: name.trim(),
        value: value.trim()
      });
    }
  }
  
  return cookies;
}

// Парсинг cookies из JSON формата (массив объектов {name, value})
function parseJsonCookies(jsonData: any): { name: string; value: string }[] {
  const cookies: { name: string; value: string }[] = [];
  
  if (Array.isArray(jsonData)) {
    for (const item of jsonData) {
      if (item.name && item.value) {
        cookies.push({ name: item.name, value: item.value });
      }
    }
  }
  
  return cookies;
}

// GET: Получение текущих VK cookies
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    // Небольшая задержка чтобы таблица успела создаться
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Получаем cookies
    const cookies = await dbAll(db, 'SELECT cookie_name, cookie_value, updated_at FROM vk_cookies ORDER BY id');
    
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
    console.error('Ошибка получения VK cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения VK cookies' },
      { status: 500 }
    );
  }
}

// POST: Обновление VK cookies
export async function POST(request: NextRequest) {
  const db = getDb();
  
  try {
    // Небольшая задержка чтобы таблица успела создаться
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const body = await request.json();
    const { curlCommand, textCookies, jsonCookies } = body;
    
    let cookies: { name: string; value: string }[] = [];
    
    // Пробуем разные форматы
    if (curlCommand) {
      cookies = parseCurlCookies(curlCommand);
    } else if (textCookies) {
      cookies = parseTextCookies(textCookies);
    } else if (jsonCookies) {
      cookies = parseJsonCookies(jsonCookies);
    }
    
    if (cookies.length === 0) {
      db.close();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cookies не найдены. Поддерживаемые форматы: curl команда с -H "Cookie: ...", текст (name\\nvalue\\n...), или JSON массив [{name, value}]' 
        },
        { status: 400 }
      );
    }
    
    console.log(`📥 VK: Получено ${cookies.length} cookies для обновления`);
    
    // Удаляем старые cookies
    await dbRun(db, 'DELETE FROM vk_cookies');
    console.log('🗑️  VK: Старые cookies удалены');
    
    // Вставляем новые cookies
    const now = new Date().toISOString();
    for (const cookie of cookies) {
      await dbRun(db, `
        INSERT INTO vk_cookies (cookie_name, cookie_value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `, [cookie.name, cookie.value, now, now]);
    }
    
    console.log(`✅ VK: Вставлено ${cookies.length} новых cookies`);
    
    db.close();
    
    return NextResponse.json({
      success: true,
      message: `VK Cookies успешно обновлены (${cookies.length} шт.)`,
      count: cookies.length,
      cookieNames: cookies.map(c => c.name)
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка обновления VK cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления VK cookies' },
      { status: 500 }
    );
  }
}

// DELETE: Удаление всех VK cookies
export async function DELETE(request: NextRequest) {
  const db = getDb();
  
  try {
    await dbRun(db, 'DELETE FROM vk_cookies');
    
    db.close();
    
    return NextResponse.json({
      success: true,
      message: 'Все VK cookies удалены'
    });
    
  } catch (error) {
    db.close();
    console.error('Ошибка удаления VK cookies:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления VK cookies' },
      { status: 500 }
    );
  }
}

