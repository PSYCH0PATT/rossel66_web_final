import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'sftp_playlists.db');

export interface PlaylistHistoryRecord {
  playlistUrl: string;
  playlistName: string;
  platform: string;
  changeType: 'added' | 'updated' | 'removed' | 'position_changed';
  changeDate: string;
  artistName?: string;
  artistId?: string | null;
  trackTitle?: string;
  oldPosition?: number;
  newPosition?: number;
  metadata?: Record<string, any>;
}

/**
 * Инициализирует таблицу истории
 */
export async function ensurePlaylistHistoryDatabase(): Promise<void> {
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS playlist_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playlist_url TEXT NOT NULL,
          playlist_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          change_type TEXT NOT NULL,
          change_date TEXT NOT NULL,
          artist_name TEXT,
          artist_id TEXT,
          track_title TEXT,
          old_position INTEGER,
          new_position INTEGER,
          metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err: any) => {
        if (err) {
          console.error('❌ Ошибка создания таблицы playlist_history:', err);
          reject(err);
        } else {
          console.log('✅ Таблица playlist_history инициализирована');
        }
      });
      
      // Создаем индексы для быстрого поиска
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_playlist_history_url_name 
        ON playlist_history(playlist_url, playlist_name)
      `, () => {});
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_playlist_history_date 
        ON playlist_history(change_date)
      `, () => {});
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_playlist_history_artist 
        ON playlist_history(artist_name)
      `, () => {});
    });
    
    db.close((err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Записывает изменение в историю
 */
export async function recordPlaylistChange(record: PlaylistHistoryRecord): Promise<void> {
  await ensurePlaylistHistoryDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(`
      INSERT INTO playlist_history 
      (playlist_url, playlist_name, platform, change_type, change_date, 
       artist_name, artist_id, track_title, old_position, new_position, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.playlistUrl,
      record.playlistName,
      record.platform,
      record.changeType,
      record.changeDate,
      record.artistName || null,
      record.artistId || null,
      record.trackTitle || null,
      record.oldPosition || null,
      record.newPosition || null,
      record.metadata ? JSON.stringify(record.metadata) : null
    ], (err: any) => {
      if (err) {
        console.error('Ошибка записи в историю:', err);
        reject(err);
      } else {
        resolve();
      }
      db.close();
    });
  });
}

/**
 * Получает историю изменений с фильтрами
 */
export async function getPlaylistHistory(filters?: {
  startDate?: string;
  endDate?: string;
  changeType?: string;
  artistName?: string;
  playlistUrl?: string;
  limit?: number;
}): Promise<any[]> {
  await ensurePlaylistHistoryDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    let query = 'SELECT * FROM playlist_history WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.startDate) {
      query += ' AND change_date >= ?';
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      query += ' AND change_date <= ?';
      params.push(filters.endDate);
    }
    
    if (filters?.changeType) {
      query += ' AND change_type = ?';
      params.push(filters.changeType);
    }
    
    if (filters?.artistName) {
      query += ' AND artist_name = ?';
      params.push(filters.artistName);
    }
    
    if (filters?.playlistUrl) {
      query += ' AND playlist_url = ?';
      params.push(filters.playlistUrl);
    }
    
    query += ' ORDER BY change_date DESC, created_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    db.all(query, params, (err: any, rows: any) => {
      if (err) {
        reject(err);
      } else {
        // Парсим metadata из JSON
        const history = (rows || []).map((row: any) => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));
        resolve(history);
      }
      db.close();
    });
  });
}

/**
 * Очищает плейлисты, которых нет в новых файлах
 */
export async function cleanupRemovedPlaylists(
  currentPlaylistKeys: Set<string>
): Promise<{ removed: number; errors: string[] }> {
  await ensurePlaylistHistoryDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  const result = { removed: 0, errors: [] as string[] };
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    // Получаем все плейлисты из базы (теперь с учетом артиста)
    db.all(`
      SELECT playlist_url, playlist_name, platform, artist_name, artist_id 
      FROM sftp_playlists
    `, async (err: any, rows: any) => {
      if (err) {
        reject(err);
        db.close();
        return;
      }
      
      const now = new Date().toISOString().split('T')[0];
      
      for (const row of rows) {
        // Ключ теперь включает только URL и название (без артиста)
        const key = `${row.playlist_url}|${row.playlist_name}`;
        
        // Если плейлиста нет в текущих файлах (проверяем только URL и название)
        if (!currentPlaylistKeys.has(key)) {
          try {
            // Записываем в историю
            await recordPlaylistChange({
              playlistUrl: row.playlist_url,
              playlistName: row.playlist_name,
              platform: row.platform,
              changeType: 'removed',
              changeDate: now,
              artistName: row.artist_name,
              artistId: row.artist_id
            });
            
            // Удаляем из базы (теперь с учетом артиста)
            await new Promise<void>((resolveDelete, rejectDelete) => {
              db.run(
                'DELETE FROM sftp_playlists WHERE playlist_url = ? AND playlist_name = ? AND artist_name = ?',
                [row.playlist_url, row.playlist_name, row.artist_name],
                (err: any) => {
                  if (err) rejectDelete(err);
                  else {
                    result.removed++;
                    resolveDelete();
                  }
                }
              );
            });
          } catch (error: any) {
            result.errors.push(`Ошибка удаления плейлиста ${row.playlist_name} (${row.artist_name}): ${error.message}`);
          }
        }
      }
      
      db.close();
      resolve(result);
    });
  });
}
