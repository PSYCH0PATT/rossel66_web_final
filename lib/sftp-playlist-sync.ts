import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';
import {
  resolvePlaylistRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from '@/lib/sftp-connect';

interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
}

interface SyncIndex {
  lastSync: string;
  downloadedFiles: Array<{
    filename: string;
    date: string;
    downloadedAt: string;
    processed: boolean;
  }>;
}

interface SyncResult {
  downloaded: number;
  processed: number;
  files: string[];
  errors: string[];
}

const SYNC_INDEX_FILE = path.join(process.cwd(), 'data', 'sftp_sync_index.json');
const DOWNLOADS_DIR = path.join(process.cwd(), 'sftp_downloads');

const SFTP_MAX_ATTEMPTS = 3;
const SFTP_RETRY_DELAY_MS = 2500;

/**
 * Загружает индекс синхронизации
 */
function loadSyncIndex(): SyncIndex {
  try {
    if (fs.existsSync(SYNC_INDEX_FILE)) {
      const content = fs.readFileSync(SYNC_INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Ошибка загрузки индекса синхронизации:', error);
  }
  
  return {
    lastSync: '',
    downloadedFiles: []
  };
}

/**
 * Сохраняет индекс синхронизации
 */
function saveSyncIndex(index: SyncIndex): void {
  try {
    const dataDir = path.dirname(SYNC_INDEX_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(SYNC_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  } catch (error) {
    console.error('Ошибка сохранения индекса синхронизации:', error);
  }
}

/**
 * Извлекает дату из имени файла
 * rossel_playlist_2026_01_22.csv -> 2026-01-22
 */
function extractDateFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{4})_(\d{2})_(\d{2})\.csv$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

/**
 * Получает список новых файлов на SFTP сервере
 */
async function getNewFiles(
  sftp: SftpClient,
  remoteBase: string,
  existingFiles: Set<string>
): Promise<Array<{ name: string; size: number; date: string | null }>> {
  try {
    const files = await sftp.list(remoteBase);
    const csvFiles = files
      .filter((file: any) => file.type === '-' && file.name.endsWith('.csv'))
      .map((file: any) => ({
        name: file.name,
        size: file.size || 0,
        date: extractDateFromFilename(file.name)
      }))
      .filter(file => !existingFiles.has(file.name));
    
    return csvFiles;
  } catch (error) {
    console.error('Ошибка получения списка файлов:', error);
    return [];
  }
}

/**
 * Скачивает новые файлы с SFTP сервера
 */
async function downloadNewFiles(
  sftp: SftpClient,
  remoteBase: string,
  files: Array<{ name: string; size: number; date: string | null }>
): Promise<string[]> {
  const downloadedFiles: string[] = [];
  
  // Создаем директорию для загрузок
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
  
  for (const file of files) {
    const remoteFilePath = path.posix.join(remoteBase, file.name);
    const localFilePath = path.join(DOWNLOADS_DIR, file.name);
    
    try {
      console.log(`⬇️  Скачиваю: ${file.name} (${formatBytes(file.size)})`);
      await sftp.fastGet(remoteFilePath, localFilePath);
      downloadedFiles.push(localFilePath);
      console.log(`✅ Скачан: ${file.name}`);
    } catch (error: any) {
      console.error(`❌ Ошибка при скачивании ${file.name}: ${error.message}`);
    }
  }
  
  return downloadedFiles;
}

/**
 * Обновляет индекс синхронизации
 */
function updateSyncIndex(downloadedFiles: string[]): void {
  const index = loadSyncIndex();
  const now = new Date().toISOString();
  
  for (const filePath of downloadedFiles) {
    const filename = path.basename(filePath);
    const date = extractDateFromFilename(filename);
    
    // Проверяем, нет ли уже этого файла в индексе
    if (!index.downloadedFiles.some(f => f.filename === filename)) {
      index.downloadedFiles.push({
        filename,
        date: date || '',
        downloadedAt: now,
        processed: false
      });
    }
  }
  
  index.lastSync = now;
  saveSyncIndex(index);
}

/**
 * Основная функция синхронизации SFTP плейлистов
 */
export async function syncSftpPlaylists(): Promise<SyncResult> {
  const username = process.env.SFTP_USERNAME;
  const password = process.env.SFTP_PASSWORD;

  const result: SyncResult = {
    downloaded: 0,
    processed: 0,
    files: [],
    errors: []
  };

  if (!username || !password) {
    result.errors.push('SFTP: не заданы SFTP_USERNAME или SFTP_PASSWORD');
    return result;
  }

  const config: SftpConfig = {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22'),
    username,
    password,
    remotePath: process.env.SFTP_REMOTE_PATH || 'rossel_playlist'
  };

  for (let attempt = 1; attempt <= SFTP_MAX_ATTEMPTS; attempt++) {
    const sftp = new SftpClient();
    try {
      console.log(
        `🔌 Подключаюсь к SFTP серверу: ${config.host}:${config.port} (попытка ${attempt}/${SFTP_MAX_ATTEMPTS})`
      );

      const connectOpts = await withIpv4SocketIfRequested(
        sftpConnectOptions({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
        })
      );
      await sftp.connect(connectOpts as any);

      console.log('✅ Подключение установлено');

      const remoteBase = await resolvePlaylistRemoteDir(sftp);
      if (!remoteBase) {
        result.errors.push(
          'SFTP: не найден каталог плейлистов (SFTP_REMOTE_PATH / rossel_playlist)'
        );
        await sftp.end().catch(() => {});
        return result;
      }
      console.log(`📁 Каталог плейлистов на сервере: ${remoteBase}`);

      const index = loadSyncIndex();
      const existingFiles = new Set(index.downloadedFiles.map((f) => f.filename));

      console.log(`📋 Найдено уже скачанных файлов: ${existingFiles.size}`);

      const newFiles = await getNewFiles(sftp, remoteBase, existingFiles);
      console.log(`📊 Найдено новых файлов: ${newFiles.length}`);

      if (newFiles.length === 0) {
        console.log('✅ Нет новых файлов для скачивания');
        try {
          await Promise.race([
            sftp.end(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          console.log('✅ SFTP соединение закрыто');
        } catch (endErr: any) {
          sftp.end().catch(() => {});
        }
        return result;
      }

      const downloadedFiles = await downloadNewFiles(sftp, remoteBase, newFiles);
      result.downloaded = downloadedFiles.length;
      result.files = downloadedFiles;

      updateSyncIndex(downloadedFiles);

      console.log(`✅ Скачано файлов: ${result.downloaded}`);

      try {
        await Promise.race([
          sftp.end(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log('✅ SFTP соединение закрыто');
      } catch (endErr: any) {
        sftp.end().catch(() => {});
      }

      return result;
    } catch (error: any) {
      console.error(`❌ Ошибка при синхронизации SFTP (попытка ${attempt}/${SFTP_MAX_ATTEMPTS}):`, error.message);
      await sftp.end().catch(() => {});

      if (attempt === SFTP_MAX_ATTEMPTS) {
        result.errors.push(error.message);
        return result;
      }

      console.log(`Повтор через ${SFTP_RETRY_DELAY_MS} мс...`);
      await new Promise((r) => setTimeout(r, SFTP_RETRY_DELAY_MS));
    }
  }

  return result;
}

/**
 * Получает список необработанных файлов
 */
export function getUnprocessedFiles(): string[] {
  const index = loadSyncIndex();
  return index.downloadedFiles
    .filter(f => !f.processed)
    .map(f => path.join(DOWNLOADS_DIR, f.filename))
    .filter(filePath => fs.existsSync(filePath));
}

/**
 * Возвращает количество строк данных в CSV (без заголовка).
 * Пустой файл или только заголовок → 0.
 */
export function countCsvDataRows(filePath: string): number {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.length > 0 && content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    // Первая строка — заголовок
    return Math.max(0, lines.length - 1);
  } catch {
    return 0;
  }
}

/**
 * Получает последний (самый новый) CSV файл.
 * Если он полностью пустой (только заголовок, без строк данных),
 * возвращает последний непустой файл.
 */
export function getLatestCsvFile(): string | null {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      return null;
    }

    const files = fs
      .readdirSync(DOWNLOADS_DIR)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => ({
        name: f,
        path: path.join(DOWNLOADS_DIR, f),
        stats: fs.statSync(path.join(DOWNLOADS_DIR, f)),
      }))
      .sort((a, b) => {
        const dateA = a.name.match(/(\d{4})_(\d{2})_(\d{2})/);
        const dateB = b.name.match(/(\d{4})_(\d{2})_(\d{2})/);

        if (dateA && dateB) {
          const dateAStr = `${dateA[1]}-${dateA[2]}-${dateA[3]}`;
          const dateBStr = `${dateB[1]}-${dateB[2]}-${dateB[3]}`;
          return dateBStr.localeCompare(dateAStr); // новее первыми
        }
        return b.stats.mtime.getTime() - a.stats.mtime.getTime();
      });

    if (files.length === 0) {
      return null;
    }

    // Если последний по дате файл пустой — берём последний непустой
    for (const file of files) {
      const dataRows = countCsvDataRows(file.path);
      if (dataRows > 0) {
        if (file.path !== files[0].path) {
          console.log(
            `📄 Последний файл "${files[0].name}" пустой, обрабатываю последний непустой: ${file.name} (${dataRows} строк)`
          );
        }
        return file.path;
      }
    }

    // Все файлы пустые — возвращаем самый новый (обработка даст 0 плейлистов)
    return files[0].path;
  } catch (error) {
    console.error('Ошибка получения последнего CSV файла:', error);
    return null;
  }
}

/**
 * Отмечает файл как обработанный
 */
export function markFileAsProcessed(filename: string): void {
  const index = loadSyncIndex();
  const file = index.downloadedFiles.find(f => f.filename === filename);
  if (file) {
    file.processed = true;
    saveSyncIndex(index);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export type LocalCsvInfo = {
  name: string
  path: string
  dataRows: number
  sizeBytes: number
  mtimeISO: string
}

/** CSV в `sftp_downloads/` (для ручного выбора в админке). */
export function listLocalPlaylistCsvFiles(): LocalCsvInfo[] {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      return []
    }
    const names = fs.readdirSync(DOWNLOADS_DIR).filter((f) => f.toLowerCase().endsWith('.csv'))
    const rows: LocalCsvInfo[] = []
    for (const name of names) {
      const fp = path.join(DOWNLOADS_DIR, name)
      try {
        const st = fs.statSync(fp)
        rows.push({
          name,
          path: fp,
          dataRows: countCsvDataRows(fp),
          sizeBytes: st.size,
          mtimeISO: st.mtime.toISOString(),
        })
      } catch {
        continue
      }
    }
    rows.sort((a, b) => b.mtimeISO.localeCompare(a.mtimeISO))
    return rows
  } catch {
    return []
  }
}

export type DownloadLatestCsvResult = {
  ok: boolean
  localPath: string | null
  filename: string | null
  errors: string[]
}

/**
 * Скачивает с SFTP самый новый CSV (по дате в имени или по mtime на сервере), перезаписывая локальный файл.
 */
export async function downloadLatestCsvFromSftp(): Promise<DownloadLatestCsvResult> {
  const errors: string[] = []
  const username = process.env.SFTP_USERNAME
  const password = process.env.SFTP_PASSWORD

  if (!username || !password) {
    return {
      ok: false,
      localPath: null,
      filename: null,
      errors: ['SFTP: не заданы SFTP_USERNAME или SFTP_PASSWORD'],
    }
  }

  const sftp = new SftpClient()
  try {
    const connectOpts = await withIpv4SocketIfRequested(
      sftpConnectOptions({
        host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
        port: parseInt(process.env.SFTP_PORT || '22', 10),
        username,
        password,
      })
    )
    await sftp.connect(connectOpts as any)

    const remoteBase = await resolvePlaylistRemoteDir(sftp)
    if (!remoteBase) {
      await sftp.end().catch(() => {})
      return {
        ok: false,
        localPath: null,
        filename: null,
        errors: ['SFTP: не найден каталог плейлистов (SFTP_REMOTE_PATH / rossel_playlist)'],
      }
    }

    const list = await sftp.list(remoteBase)
    const csvRows = list.filter(
      (file): file is { name: string; modifyTime?: number; type: string } =>
        file.type === "-" && (file.name || "").endsWith(".csv")
    )

    if (csvRows.length === 0) {
      await sftp.end().catch(() => {})
      return { ok: true, localPath: null, filename: null, errors: ['На SFTP нет CSV файлов'] }
    }

    const sorted = [...csvRows].sort((a, b) => {
      const da = extractDateFromFilename(a.name)
      const db = extractDateFromFilename(b.name)
      if (da && db) return db.localeCompare(da)
      const ma = typeof a.modifyTime === 'number' ? a.modifyTime : 0
      const mb = typeof b.modifyTime === 'number' ? b.modifyTime : 0
      return mb - ma
    })

    const chosen = sorted[0]
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    }
    const localPath = path.join(DOWNLOADS_DIR, chosen.name)
    const remoteFilePath = path.posix.join(remoteBase, chosen.name)
    await sftp.fastGet(remoteFilePath, localPath)

    const index = loadSyncIndex()
    const now = new Date().toISOString()
    const dateStr = extractDateFromFilename(chosen.name) || ''
    const hit = index.downloadedFiles.find((f) => f.filename === chosen.name)
    if (hit) {
      hit.downloadedAt = now
      hit.processed = false
      if (dateStr) hit.date = dateStr
    } else {
      index.downloadedFiles.push({
        filename: chosen.name,
        date: dateStr,
        downloadedAt: now,
        processed: false,
      })
    }
    index.lastSync = now
    saveSyncIndex(index)

    try {
      await Promise.race([
        sftp.end(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ])
    } catch {
      sftp.end().catch(() => {})
    }

    return { ok: true, localPath, filename: chosen.name, errors: [] }
  } catch (e: any) {
    await sftp.end().catch(() => {})
    return {
      ok: false,
      localPath: null,
      filename: null,
      errors: [e?.message || String(e)],
    }
  }
}
