/**
 * Тест SFTP-плейлистов: парсер, валидация CSV, нормализация артистов, sync.
 * Запуск: npx tsx scripts/test-sftp-playlist-sync.ts
 * Подгружает .env.local для SFTP_USERNAME/SFTP_PASSWORD при запуске через tsx.
 */
import * as path from 'path';
import * as fs from 'fs';

const projectRoot = path.join(__dirname, '..');

// Подгрузить .env.local (Next.js не подхватывает его при запуске скрипта через tsx)
const envPath = path.join(projectRoot, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
  console.log('Загружен .env.local (SFTP_USERNAME:', process.env.SFTP_USERNAME ? 'задан' : 'нет', ')');
}
const csvPath = path.join(projectRoot, 'sftp_downloads', 'rossel_playlist_2026_01_22.csv');

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

async function main() {
  console.log('Корень проекта:', projectRoot);
  console.log('CSV файл:', csvPath);
  console.log('Существует:', fs.existsSync(csvPath));

  // --- 1. Парсер CSV (parseCsvFile: BOM, валидация заголовков) ---
  logSection('1. Парсинг CSV (parseCsvFile)');
  const parser = await import('../lib/sftp-playlist-parser');
  const { parseCsvFile, processCsvFiles } = parser;

  try {
    const records = parseCsvFile(csvPath);
    console.log('Записей прочитано:', records.length);
    records.forEach((r, i) => {
      console.log(`  [${i + 1}] title_artist="${r.title_artist}" | url=${r.url?.slice(0, 40)}... | playlist_name="${r.playlist_name}" | DSP=${r.DSP}`);
    });
  } catch (e: any) {
    console.error('Ошибка parseCsvFile:', e.message);
  }

  // --- 2. Группировка по плейлистам и нормализация имён артистов ---
  logSection('2. Группировка по плейлистам (groupByPlaylist, нормализация артиста)');
  const syncLib = await import('../lib/sftp-playlist-sync');
  const { getLatestCsvFile } = syncLib;
  const latestFile = getLatestCsvFile();
  console.log('Последний CSV файл:', latestFile ?? '(нет)');

  if (latestFile) {
    const playlists = await processCsvFiles([latestFile]);
    console.log('Плейлистов после processCsvFiles:', playlists.length);
    playlists.forEach((p, i) => {
      console.log(`  Плейлист [${i + 1}]: "${p.playlistName}" (${p.platform}), треков: ${p.tracks.length}`);
      p.tracks.forEach((t, j) => {
        console.log(`    Трек ${j + 1}: artistName="${t.artistName}" artistId=${t.artistId ?? 'null'} position=${t.position}`);
      });
    });
  }

  // --- 3. Sync SFTP (ожидаем ранний выход из-за отсутствия кредов) ---
  logSection('3. syncSftpPlaylists (проверка раннего выхода без кредов)');
  const { syncSftpPlaylists } = await import('../lib/sftp-playlist-sync');
  const syncResult = await syncSftpPlaylists();
  console.log('downloaded:', syncResult.downloaded);
  console.log('processed:', syncResult.processed);
  console.log('files:', syncResult.files);
  console.log('errors:', syncResult.errors);

  // --- 4. getPlaylistsByArtist с нормализацией (если есть БД) ---
  logSection('4. getPlaylistsByArtist (нормализация имени)');
  const dbPath = path.join(projectRoot, 'sftp_playlists.db');
  if (fs.existsSync(dbPath)) {
    const { getPlaylistsByArtist } = await import('../lib/sftp-playlist-storage');
    for (const name of ['sadaround', 'Sadaround', 'PLVT', 'plvt']) {
      try {
        const list = await getPlaylistsByArtist(name);
        console.log(`  getPlaylistsByArtist("${name}") -> ${list.length} плейлистов`);
      } catch (e: any) {
        console.log(`  getPlaylistsByArtist("${name}") -> ошибка:`, e.message);
      }
    }
  } else {
    console.log('БД sftp_playlists.db не найдена, шаг пропущен.');
  }

  console.log('\nТест завершён.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
