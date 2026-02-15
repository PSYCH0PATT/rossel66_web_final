/**
 * Однократное скачивание последней таблицы из папки rossel_flash на SFTP.
 * Сохраняет файл локально в sftp_downloads/. Никуда не встраивается.
 *
 * Запуск: npx tsx scripts/download-flash-latest.ts
 * (или: node --loader ts-node/esm scripts/download-flash-latest.ts)
 *
 * Нужны переменные окружения: SFTP_USERNAME, SFTP_PASSWORD
 * (опционально: SFTP_HOST, SFTP_PORT)
 */

import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';

const REMOTE_PATH = 'rossel_flash';
const LOCAL_DIR = path.join(process.cwd(), 'sftp_downloads');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

function extractDateFromFilename(name: string): string | null {
  const m = name.match(/rossel_flash_(\d{4})_(\d{2})_(\d{2})\.csv$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function main() {
  loadEnvLocal();

  const username = process.env.SFTP_USERNAME;
  const password = process.env.SFTP_PASSWORD;
  if (!username || !password) {
    console.error('❌ Задайте SFTP_USERNAME и SFTP_PASSWORD (в .env.local или в окружении)');
    process.exit(1);
  }

  const config = {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username,
    password,
  };

  const sftp = new SftpClient();
  try {
    console.log(`🔌 Подключение к ${config.host}:${config.port}...`);
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 20000,
    });
    console.log('✅ Подключено');

    console.log(`📋 Список файлов в /${REMOTE_PATH}...`);
    const files = await sftp.list(REMOTE_PATH);
    const csvFiles = (files as any[])
      .filter((f: any) => f.type === '-' && f.name.endsWith('.csv'))
      .map((f: any) => ({
        name: f.name,
        size: f.size || 0,
        date: extractDateFromFilename(f.name),
      }))
      .filter((f) => f.date);

    if (csvFiles.length === 0) {
      console.log('⚠️ CSV файлов не найдено');
      await sftp.end();
      process.exit(0);
    }

    csvFiles.sort((a, b) => (b.date!).localeCompare(a.date!));
    const arg = process.argv[2];
    // Поддержка: дата YYYY-MM-DD или "11" (день) — скачать файл за эту дату
    let targetDate: string | null = null;
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      targetDate = arg;
    } else if (arg && /^\d{1,2}$/.test(arg)) {
      const day = arg.padStart(2, '0');
      const last = csvFiles[0];
      const m = last.date!.match(/^(\d{4})-(\d{2})-/);
      targetDate = m ? `${m[1]}-${m[2]}-${day}` : null;
    }
    const latest = targetDate
      ? csvFiles.find((f) => f.date === targetDate) || null
      : csvFiles[arg === '2' || arg === 'предпоследний' ? 1 : 0];
    if (!latest) {
      if (targetDate) console.log(`⚠️ Файл за ${targetDate} не найден на SFTP`);
      else if (arg === '2' || arg === 'предпоследний') console.log('⚠️ Нет предпоследнего файла');
      await sftp.end();
      process.exit(0);
    }
    console.log(`📄 Файл: ${latest.name} (${latest.date})`);

    if (!fs.existsSync(LOCAL_DIR)) {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
    }
    const localPath = path.join(LOCAL_DIR, latest.name);

    console.log(`⬇️  Скачиваю в ${localPath}...`);
    await sftp.fastGet(`${REMOTE_PATH}/${latest.name}`, localPath);
    console.log('✅ Готово. Файл сохранён локально.');
    await sftp.end();
  } catch (err: any) {
    console.error('❌ Ошибка:', err.message);
    await sftp.end().catch(() => {});
    process.exit(1);
  }
}

main();
