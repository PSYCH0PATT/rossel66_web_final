import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';
import { requireAdminOrCron } from '@/lib/server-auth';

export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdminOrCron(request);
    if (denied) return denied;

    const sqlite3 = require('sqlite3').verbose();
    
    // Очищаем VK результаты
    const vkDbPath = path.join(process.cwd(), 'vk_playlists.db');
    if (fs.existsSync(vkDbPath)) {
      const vkDb = new sqlite3.Database(vkDbPath);
      await new Promise((resolve, reject) => {
        vkDb.run('DELETE FROM artist_playlists', (err: any) => {
          if (err) reject(err);
          else resolve(true);
        });
        vkDb.close();
      });
    }
    
    // Очищаем Bandlink результаты
    const bandlinkDbPath = path.join(process.cwd(), 'bandlink_playlists.db');
    if (fs.existsSync(bandlinkDbPath)) {
      const bandlinkDb = new sqlite3.Database(bandlinkDbPath);
      await new Promise((resolve, reject) => {
        bandlinkDb.run('DELETE FROM bandlink_playlists', (err: any) => {
          if (err) reject(err);
          else resolve(true);
        });
        bandlinkDb.close();
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Все результаты парсинга очищены' 
    });
    
  } catch (error) {
    console.error('Ошибка очистки результатов:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Ошибка очистки результатов' 
    }, { status: 500 });
  }
}


