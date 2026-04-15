/**
 * Скачивает последние 5 CSV с SFTP и формирует таблицы для просмотра.
 * Запуск: npx tsx scripts/download-sftp-last5-and-tables.ts
 * Нужны SFTP_USERNAME, SFTP_PASSWORD в .env.local или окружении.
 */
import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';
import {
  resolvePlaylistRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from '../lib/sftp-connect';

const projectRoot = path.join(__dirname, '..');
const LAST5_DIR = path.join(projectRoot, 'sftp_downloads', 'last5');
const TABLES_FILE = path.join(LAST5_DIR, 'TABLES.md');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;
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
}

function getConfig() {
  const username = process.env.SFTP_USERNAME;
  const password = process.env.SFTP_PASSWORD;
  if (!username || !password) {
    throw new Error('Задайте SFTP_USERNAME и SFTP_PASSWORD в .env.local или в окружении');
  }
  return {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username,
    password,
    remotePath: process.env.SFTP_REMOTE_PATH || 'rossel_playlist',
  };
}

/** Дата из имени файла rossel_playlist_2026_01_22.csv */
function dateFromFilename(name: string): string | null {
  const m = name.match(/(\d{4})_(\d{2})_(\d{2})\.csv$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Парсинг одной строки CSV (разделитель ;, кавычки учитываем) */
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
  values.push(current.trim());
  return values;
}

function formatTable(header: string[], rows: string[][], maxColWidth = 30): string {
  const pad = (s: string) => s.slice(0, maxColWidth).padEnd(maxColWidth);
  const lines: string[] = [];
  lines.push(header.map(pad).join(' | '));
  lines.push(header.map(() => '-'.repeat(maxColWidth)).join('-+-'));
  for (const row of rows) {
    const cells = header.map((_, i) => pad(row[i] ?? ''));
    lines.push(cells.join(' | '));
  }
  return lines.join('\n');
}

async function main() {
  loadEnvLocal();
  const config = getConfig();

  if (!fs.existsSync(LAST5_DIR)) {
    fs.mkdirSync(LAST5_DIR, { recursive: true });
  }
  console.log('📁 Папка для файлов:', LAST5_DIR);
  console.log('📄 Таблицы будут записаны в:', TABLES_FILE);

  const sftp = new SftpClient();
  try {
    console.log('\n🔌 Подключение к SFTP...');
    const connectOpts = await withIpv4SocketIfRequested(
      sftpConnectOptions({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
      })
    );
    await sftp.connect(connectOpts as any);
    console.log('✅ Подключено');

    const remoteBase = await resolvePlaylistRemoteDir(sftp);
    if (!remoteBase) {
      console.error('❌ Не найден каталог плейлистов на SFTP');
      process.exit(1);
    }
    console.log('📁 Каталог:', remoteBase);

    const files = await sftp.list(remoteBase);
    const csvFiles = files
      .filter((f: any) => f.type === '-' && f.name.endsWith('.csv'))
      .map((f: any) => ({ name: f.name, date: dateFromFilename(f.name) }))
      .filter((f: { date: string | null }) => f.date)
      .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))
      .slice(0, 5);

    if (csvFiles.length === 0) {
      console.log('❌ CSV файлов с датой в имени не найдено');
      process.exit(1);
    }

    console.log(`\n📥 Скачиваю последние ${csvFiles.length} файлов:`);
    const downloaded: string[] = [];
    for (const f of csvFiles) {
      const remotePath = path.posix.join(remoteBase, f.name);
      const localPath = path.join(LAST5_DIR, f.name);
      await sftp.fastGet(remotePath, localPath);
      downloaded.push(localPath);
      console.log('  ✅', f.name);
    }

    await sftp.end();
    console.log('🔌 Соединение закрыто');

    // Формируем таблицы
    const out: string[] = [];
    out.push('# Последние 5 CSV с SFTP — превью таблиц\n');
    out.push(`Скачано: ${new Date().toISOString()}\n`);

    for (const filePath of downloaded) {
      const name = path.basename(filePath);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch (e) {
        out.push(`## ${name}\n\nОшибка чтения: ${e}\n\n`);
        continue;
      }
      if (content.length > 0 && content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        out.push(`## ${name}\n\nФайл пустой.\n\n`);
        continue;
      }

      const header = parseCsvLine(lines[0]);
      const rows = lines.slice(1, 21).map((line) => parseCsvLine(line));
      const table = formatTable(header, rows);
      out.push(`## ${name}\n\n`);
      out.push('Заголовки: `' + header.join('`, `') + '`\n\n');
      out.push('```\n' + table + '\n```\n\n');
      if (lines.length > 21) {
        out.push(`_Показано первых ${rows.length} строк из ${lines.length - 1}._\n\n`);
      }
    }

    fs.writeFileSync(TABLES_FILE, out.join(''), 'utf-8');
    console.log('\n✅ Таблицы записаны в', TABLES_FILE);
    console.log('\nФайлы в папке last5:', fs.readdirSync(LAST5_DIR).join(', '));
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
