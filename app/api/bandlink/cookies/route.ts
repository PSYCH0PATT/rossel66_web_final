import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { Database } from 'sqlite3';
import { openSqlite } from '@/lib/sqlite3-lazy';
import { requireAdmin } from '@/lib/server-auth';

// Путь к БД
const DB_PATH = path.join(process.cwd(), 'bandlink_playlists.db');

function getDb(): Database {
  return openSqlite(DB_PATH);
}

// Промисифицированные методы
const dbRun = (db: Database, sql: string, params?: any[]) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (db: Database, sql: string, params?: any[]) => {
  return new Promise<any[]>((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Парсинг cookies из curl команды или строки
function parseCookies(input: string): { name: string; value: string }[] {
  const cookies: { name: string; value: string }[] = [];
  
  // Проверяем, это curl команда или строка с куками
  let cookieString = '';
  
  // Если это curl команда, извлекаем Cookie заголовок
  const curlMatch = input.match(/-H\s+['"]Cookie:\s*(.+?)['"]/i);
  if (curlMatch) {
    cookieString = curlMatch[1];
  } else {
    // Иначе считаем, что это строка с куками в формате:
    // cookie_name1cookie_value1
    // cookie_name2cookie_value2
    // или
    // cookie_name1=cookie_value1
    // cookie_name2=cookie_value2
    cookieString = input;
  }
  
  // Разбиваем на строки
  const lines = cookieString.split('\n').map(line => line.trim()).filter(line => line);
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Пробуем формат "name=value"
    if (line.includes('=')) {
      const [name, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      if (name && value) {
        cookies.push({
          name: name.trim(),
          value: value.trim()
        });
      }
      i++;
    } else {
      // Формат без "=" - пробуем разные варианты
      const parts = line.split(/\s+/);
      
      if (parts.length >= 2) {
        // Если есть пробелы, первая часть - имя, остальное - значение
        const name = parts[0];
        const value = parts.slice(1).join(' ');
        if (name) {
          cookies.push({
            name: name.trim(),
            value: value.trim()
          });
        }
        i++;
      } else if (parts.length === 1) {
        // Если только одна часть, это может быть имя куки
        // Проверяем следующую строку - возможно, там значение
        const name = parts[0];
        
        // Если строка выглядит как имя куки (только буквы, цифры, подчеркивания, дефисы)
        if (name.match(/^[a-zA-Z0-9_\-]+$/)) {
          // Проверяем следующую строку
          if (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].match(/^[a-zA-Z0-9_\-]+$/)) {
            // Следующая строка - это значение
            cookies.push({
              name: name.trim(),
              value: lines[i + 1].trim()
            });
            i += 2;
            continue;
          } else {
            // Следующая строка тоже похожа на имя куки или нет следующей строки
            // Пропускаем эту строку (нет значения)
            i++;
            continue;
          }
        } else {
          // Строка не похожа на имя куки - возможно, это значение предыдущей строки
          // Но мы уже обработали предыдущую строку, так что пропускаем
          i++;
          continue;
        }
      } else {
        i++;
      }
    }
  }
  
  // Если не получилось распарсить построчно, пробуем через ";"
  if (cookies.length === 0) {
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
  }
  
  return cookies;
}

// GET: Получение текущих cookies
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

// POST: Обновление cookies из curl команды или строки
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = getDb();
  
  try {
    const body = await request.json();
    const { curlCommand, cookieString } = body;
    
    const input = curlCommand || cookieString;
    
    if (!input) {
      db.close();
      return NextResponse.json(
        { success: false, error: 'Curl команда или строка с cookies не предоставлена' },
        { status: 400 }
      );
    }
    
    // Парсим cookies из curl команды или строки
    const cookies = parseCookies(input);
    
    if (cookies.length === 0) {
      db.close();
      return NextResponse.json(
        { success: false, error: 'Cookies не найдены. Убедитесь, что формат правильный (curl команда или строка с cookies в формате name=value)' },
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
  const denied = await requireAdmin(request);
  if (denied) return denied;

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








