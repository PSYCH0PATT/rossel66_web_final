import * as path from 'path';
import { ParsedPlaylist, ParsedTrack } from './sftp-playlist-parser';
import { recordPlaylistChange } from './playlist-history';
import { findArtistByName, normalizeArtistName } from '@/lib/storage';

const DB_PATH = path.join(process.cwd(), 'sftp_playlists.db');

/**
 * Инициализирует базу данных
 */
export async function ensureSftpPlaylistDatabase(): Promise<void> {
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.serialize(() => {
      // Проверяем, существует ли таблица со старым constraint
      db.get(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='sftp_playlists'
      `, (err: any, row: any) => {
        if (err) {
          console.error('❌ Ошибка проверки таблицы:', err);
          reject(err);
          db.close();
          return;
        }
        
        // Если таблица существует и имеет старый constraint (без artist_name в UNIQUE), пересоздаем
        const hasOldUnique = row?.sql?.includes('UNIQUE(playlist_url, playlist_name)') === true;
        const hasNewUnique = row?.sql?.includes('UNIQUE(playlist_url, playlist_name, artist_name)') === true;
        if (row && row.sql && hasOldUnique && !hasNewUnique) {
          console.log('🔄 Обновляю схему таблицы sftp_playlists...');
          
          // Создаем временную таблицу с новой схемой
          db.run(`
            CREATE TABLE IF NOT EXISTS sftp_playlists_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              playlist_url TEXT NOT NULL,
              playlist_name TEXT NOT NULL,
              platform TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              artist_id TEXT,
              track_data TEXT,
              first_seen_date TEXT,
              last_seen_date TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(playlist_url, playlist_name, artist_name)
            )
          `, (err: any) => {
            if (err) {
              console.error('❌ Ошибка создания новой таблицы:', err);
              reject(err);
              db.close();
              return;
            }
            
            // Копируем данные, разделяя по артистам
            // Сначала получаем все записи
            db.all('SELECT * FROM sftp_playlists', async (err: any, rows: any) => {
              if (err) {
                console.error('❌ Ошибка чтения данных:', err);
                reject(err);
                db.close();
                return;
              }
              
              // Обрабатываем каждую запись
              for (const row of rows) {
                try {
                  const tracks = JSON.parse(row.track_data || '[]');
                  const tracksByArtist = new Map<string, any[]>();
                  
                  // Группируем треки по артистам
                  tracks.forEach((track: any) => {
                    const artistName = track.artistName || row.artist_name || 'Unknown';
                    if (!tracksByArtist.has(artistName)) {
                      tracksByArtist.set(artistName, []);
                    }
                    tracksByArtist.get(artistName)!.push(track);
                  });
                  
                  // Создаем отдельную запись для каждого артиста
                  for (const [artistName, artistTracks] of tracksByArtist.entries()) {
                    const artistId = artistTracks[0]?.artistId || row.artist_id || null;
                    const artistTrackData = JSON.stringify(artistTracks);
                    
                    await new Promise<void>((resolveInsert, rejectInsert) => {
                      db.run(`
                        INSERT INTO sftp_playlists_new 
                        (playlist_url, playlist_name, platform, artist_name, artist_id, track_data, first_seen_date, last_seen_date, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `, [
                        row.playlist_url,
                        row.playlist_name,
                        row.platform,
                        artistName,
                        artistId,
                        artistTrackData,
                        row.first_seen_date,
                        row.last_seen_date,
                        row.created_at,
                        row.updated_at
                      ], (err: any) => {
                        if (err) rejectInsert(err);
                        else resolveInsert();
                      });
                    });
                  }
                } catch (error: any) {
                  console.error(`Ошибка обработки записи ${row.id}:`, error.message);
                }
              }
              
              // После копирования всех данных, удаляем старую таблицу
              db.run('DROP TABLE sftp_playlists', (err: any) => {
                if (err) {
                  console.error('❌ Ошибка удаления старой таблицы:', err);
                  reject(err);
                  db.close();
                  return;
                }
                
                // Переименовываем новую таблицу
                db.run('ALTER TABLE sftp_playlists_new RENAME TO sftp_playlists', (err: any) => {
                  if (err) {
                    console.error('❌ Ошибка переименования таблицы:', err);
                    reject(err);
                  } else {
                    console.log('✅ Схема таблицы обновлена, данные разделены по артистам');
                  }
                  db.close();
                  resolve();
                });
              });
            });
          });
        } else {
          // Создаем таблицу с новой схемой
          db.run(`
            CREATE TABLE IF NOT EXISTS sftp_playlists (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              playlist_url TEXT NOT NULL,
              playlist_name TEXT NOT NULL,
              platform TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              artist_id TEXT,
              track_data TEXT,
              first_seen_date TEXT,
              last_seen_date TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(playlist_url, playlist_name, artist_name)
            )
          `, (err: any) => {
            if (err) {
              console.error('❌ Ошибка создания таблицы sftp_playlists:', err);
              reject(err);
            } else {
              console.log('✅ Таблица sftp_playlists инициализирована');
            }
            db.close();
            resolve();
          });
        }
      });
    });
  });
}

/**
 * Сохраняет или обновляет плейлисты
 */
export async function savePlaylists(playlists: ParsedPlaylist[]): Promise<{
  added: number;
  updated: number;
  errors: string[];
}> {
  await ensureSftpPlaylistDatabase();
  
  console.log(`💾 Начинаю сохранение ${playlists.length} плейлистов...`);
  
  const sqlite3 = require('sqlite3').verbose();
  const stats = { added: 0, updated: 0, errors: [] as string[] };
  
  return new Promise(async (resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    try {
      // Обрабатываем плейлисты последовательно
      for (let i = 0; i < playlists.length; i++) {
        const playlist = playlists[i];
        try {
          console.log(`   [${i + 1}/${playlists.length}] Обрабатываю: ${playlist.playlistName} (${playlist.platform})`);
          
          // Группируем треки по артистам
          const tracksByArtist = groupTracksByArtist(playlist.tracks);
          
          console.log(`      Найдено артистов в плейлисте: ${tracksByArtist.size}`);
          
          // Создаем отдельную запись для КАЖДОГО артиста в плейлисте
          for (const [artistName, artistTracks] of tracksByArtist.entries()) {
            const artistId = artistTracks[0]?.artistId || null;
            
            console.log(`      Сохраняю для артиста: ${artistName}, Треков: ${artistTracks.length}`);
            
            // Сохраняем только треки этого артиста
            const trackData = JSON.stringify(artistTracks);
            
            // Получаем старые данные для сравнения (для этого конкретного артиста)
            const oldData = await getExistingPlaylistDataForArtist(
              db, 
              playlist.playlistUrl, 
              playlist.playlistName, 
              artistName
            );
            
            // Сохраняем плейлист для этого артиста
            await new Promise<void>((resolveSave, rejectSave) => {
              const sql = `INSERT INTO sftp_playlists 
                (playlist_url, playlist_name, platform, artist_name, artist_id, track_data, first_seen_date, last_seen_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(playlist_url, playlist_name, artist_name) DO UPDATE SET
                  platform = excluded.platform,
                  artist_id = excluded.artist_id,
                  track_data = excluded.track_data,
                  last_seen_date = excluded.last_seen_date,
                  updated_at = CURRENT_TIMESTAMP`;
              
              const params = [
                playlist.playlistUrl,
                playlist.playlistName,
                playlist.platform,
                artistName,
                artistId,
                trackData,
                playlist.parsedDate,
                playlist.parsedDate
              ];
              
              db.run(sql, params, (err: any) => {
                if (err) {
                  console.error(`      ❌ Ошибка SQL для ${artistName}: ${err.message}`);
                  stats.errors.push(`Ошибка сохранения плейлиста ${playlist.playlistName} для ${artistName}: ${err.message}`);
                  rejectSave(err);
                } else {
                  // Определяем, добавлен или обновлен плейлист
                  if (oldData) {
                    stats.updated++;
                    console.log(`      ✅ Обновлен для ${artistName}`);
                    
                    // Сравниваем позиции треков
                    const oldTracks: ParsedTrack[] = JSON.parse(oldData.track_data || '[]');
                    compareAndRecordPositionChanges(
                      playlist.playlistUrl,
                      playlist.playlistName,
                      playlist.platform,
                      artistName,
                      artistId,
                      oldTracks,
                      artistTracks
                    );
                    
                    // Записываем в историю
                    recordPlaylistChange({
                      playlistUrl: playlist.playlistUrl,
                      playlistName: playlist.playlistName,
                      platform: playlist.platform,
                      changeType: 'updated',
                      changeDate: playlist.parsedDate,
                      artistName,
                      artistId,
                      metadata: {
                        tracksCount: artistTracks.length
                      }
                    }).catch(err => console.error('Ошибка записи в историю:', err));
                  } else {
                    stats.added++;
                    console.log(`      ✅ Добавлен для ${artistName}`);
                    
                    // Записываем в историю
                    recordPlaylistChange({
                      playlistUrl: playlist.playlistUrl,
                      playlistName: playlist.playlistName,
                      platform: playlist.platform,
                      changeType: 'added',
                      changeDate: playlist.parsedDate,
                      artistName,
                      artistId,
                      metadata: {
                        tracksCount: artistTracks.length
                      }
                    }).catch(err => console.error('Ошибка записи в историю:', err));
                  }
                  resolveSave();
                }
              });
            });
          }
        } catch (error: any) {
          console.error(`      ❌ Ошибка обработки: ${error.message}`);
          stats.errors.push(`Ошибка сохранения плейлиста ${playlist.playlistName}: ${error.message}`);
        }
      }
      
      db.close((err: any) => {
        if (err) {
          console.error('Ошибка закрытия БД:', err);
          reject(err);
        } else {
          console.log(`💾 Сохранение завершено: добавлено ${stats.added}, обновлено ${stats.updated}`);
          resolve(stats);
        }
      });
    } catch (error: any) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Группирует треки по артистам
 */
function groupTracksByArtist(tracks: ParsedTrack[]): Map<string, ParsedTrack[]> {
  const grouped = new Map<string, ParsedTrack[]>();
  
  for (const track of tracks) {
    const key = track.artistName;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(track);
  }
  
  return grouped;
}

/**
 * Получает существующие данные плейлиста для конкретного артиста
 */
function getExistingPlaylistDataForArtist(
  db: any,
  playlistUrl: string,
  playlistName: string,
  artistName: string
): Promise<{ track_data: string } | null> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT track_data FROM sftp_playlists WHERE playlist_url = ? AND playlist_name = ? AND artist_name = ?',
      [playlistUrl, playlistName, artistName],
      (err: any, row: any) => {
        if (err) {
          console.error(`Ошибка получения данных для ${playlistName} (${artistName}):`, err);
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

/**
 * Сравнивает позиции треков и записывает изменения в историю
 */
function compareAndRecordPositionChanges(
  playlistUrl: string,
  playlistName: string,
  platform: string,
  artistName: string,
  artistId: string | null,
  oldTracks: ParsedTrack[],
  newTracks: ParsedTrack[]
): void {
  // Создаем карту старых позиций по ISRC
  const oldPositions = new Map<string, number>();
  oldTracks.forEach(track => {
    if (track.isrc) {
      oldPositions.set(track.isrc, track.position);
    }
  });
  
  // Проверяем изменения позиций
  newTracks.forEach(track => {
    if (track.isrc && oldPositions.has(track.isrc)) {
      const oldPosition = oldPositions.get(track.isrc)!;
      if (oldPosition !== track.position) {
        recordPlaylistChange({
          playlistUrl,
          playlistName,
          platform,
          changeType: 'position_changed',
          changeDate: track.parsedDate,
          artistName,
          artistId,
          trackTitle: track.titleArtist,
          oldPosition,
          newPosition: track.position,
          metadata: {
            isrc: track.isrc
          }
        }).catch(err => console.error('Ошибка записи изменения позиции:', err));
      }
    }
  });
}

/**
 * Получает все плейлисты из базы данных
 */
export async function getAllPlaylists(): Promise<any[]> {
  await ensureSftpPlaylistDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.all(`
      SELECT * FROM sftp_playlists 
      ORDER BY last_seen_date DESC, playlist_name ASC
    `, (err: any, rows: any) => {
      if (err) {
        reject(err);
      } else {
        // Парсим track_data из JSON
        const playlists = (rows || []).map((row: any) => ({
          ...row,
          tracks: JSON.parse(row.track_data || '[]')
        }));
        resolve(playlists);
      }
      db.close();
    });
  });
}

/**
 * Получает плейлисты по имени артиста
 */
export async function getPlaylistsByArtist(artistName: string): Promise<any[]> {
  await ensureSftpPlaylistDatabase();
  
  const normalized = normalizeArtistName(artistName);
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    // Теперь ищем плейлисты напрямую по artist_name (каждая запись - отдельный артист)
    db.all(`
      SELECT * FROM sftp_playlists 
      WHERE artist_name = ?
      ORDER BY last_seen_date DESC, playlist_name ASC
    `, [normalized], (err: any, rows: any) => {
      if (err) {
        reject(err);
      } else {
        // Парсим track_data из JSON
        const playlists = (rows || []).map((row: any) => ({
          ...row,
          tracks: JSON.parse(row.track_data || '[]')
        }));
        resolve(playlists);
      }
      db.close();
    });
  });
}

/**
 * Получает плейлисты по ID артиста (artist_id в таблице)
 */
export async function getPlaylistsByArtistId(artistId: string): Promise<any[]> {
  await ensureSftpPlaylistDatabase();

  const sqlite3 = require('sqlite3').verbose();

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);

    db.all(
      `SELECT * FROM sftp_playlists 
       WHERE artist_id = ?
       ORDER BY last_seen_date DESC, playlist_name ASC`,
      [artistId],
      (err: any, rows: any) => {
        if (err) {
          reject(err);
        } else {
          const playlists = (rows || []).map((row: any) => ({
            ...row,
            tracks: JSON.parse(row.track_data || '[]')
          }));
          resolve(playlists);
        }
        db.close();
      }
    );
  });
}

/**
 * Получает все уникальные URL плейлистов из базы (без учета артистов)
 */
export async function getAllPlaylistUrls(): Promise<Set<string>> {
  await ensureSftpPlaylistDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.all(`
      SELECT DISTINCT playlist_url, playlist_name FROM sftp_playlists
    `, (err: any, rows: any) => {
      if (err) {
        reject(err);
      } else {
        const urls = new Set<string>();
        rows.forEach((row: any) => {
          urls.add(`${row.playlist_url}|${row.playlist_name}`);
        });
        resolve(urls);
      }
      db.close();
    });
  });
}

/**
 * Удаляет плейлист из базы данных (для конкретного артиста или все записи плейлиста)
 */
export async function deletePlaylist(
  playlistUrl: string, 
  playlistName: string, 
  artistName?: string
): Promise<void> {
  await ensureSftpPlaylistDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    if (artistName) {
      // Удаляем только для конкретного артиста
      db.run(
        'DELETE FROM sftp_playlists WHERE playlist_url = ? AND playlist_name = ? AND artist_name = ?',
        [playlistUrl, playlistName, artistName],
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
          db.close();
        }
      );
    } else {
      // Удаляем все записи этого плейлиста (для всех артистов)
      db.run(
        'DELETE FROM sftp_playlists WHERE playlist_url = ? AND playlist_name = ?',
        [playlistUrl, playlistName],
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
          db.close();
        }
      );
    }
  });
}

/**
 * Assigns existing playlists to a new artist by name matching
 */
export async function assignPlaylistsToArtist(
  artistId: string,
  artistName: string,
  username: string
): Promise<number> {
  await ensureSftpPlaylistDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  const normalizedName = normalizeArtistName(artistName);
  const normalizedUsername = normalizeArtistName(username);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    // Find playlists without artist_id that match by name
    db.all(
      `SELECT * FROM sftp_playlists 
       WHERE artist_id IS NULL OR artist_id = ''`,
      [],
      (err: any, rows: any[]) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        let assignedCount = 0;
        const updates: Promise<void>[] = [];
        
        rows.forEach((row) => {
          const rowArtistName = normalizeArtistName(row.artist_name || '');
          
          // Match by artist name or username
          if (rowArtistName === normalizedName || rowArtistName === normalizedUsername) {
            const updatePromise = new Promise<void>((resolveUpdate, rejectUpdate) => {
              db.run(
                `UPDATE sftp_playlists 
                 SET artist_id = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [artistId, row.id],
                (updateErr: any) => {
                  if (updateErr) {
                    rejectUpdate(updateErr);
                  } else {
                    assignedCount++;
                    resolveUpdate();
                  }
                }
              );
            });
            updates.push(updatePromise);
          }
        });
        
        Promise.all(updates)
          .then(() => {
            db.close();
            resolve(assignedCount);
          })
          .catch((updateErr) => {
            db.close();
            reject(updateErr);
          });
      }
    );
  });
}

/**
 * Manually assign a specific playlist to an artist
 */
export async function assignPlaylistToArtistManually(
  playlistId: number,
  artistId: string
): Promise<boolean> {
  await ensureSftpPlaylistDatabase();
  
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(
      `UPDATE sftp_playlists 
       SET artist_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [artistId, playlistId],
      function(this: any, err: any) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}
