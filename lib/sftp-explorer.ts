import SftpClient from 'ssh2-sftp-client';
import * as path from 'path';
import {
  resolveSftpRemoteDir,
  sftpConnectOptions,
  sftpRemoteDirCandidates,
  withIpv4SocketIfRequested,
} from '@/lib/sftp-connect';

interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
}

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifyTime?: Date;
  accessTime?: Date;
  rights?: {
    user: string;
    group: string;
    other: string;
  };
}

export async function exploreSftpServer(config: SftpConfig): Promise<any> {
  const sftp = new SftpClient();
  
  try {
    console.log(`🔌 Подключаюсь к SFTP серверу: ${config.host}:${config.port}`);
    console.log(`👤 Пользователь: ${config.username}`);
    console.log(`📁 Целевая папка: ${config.remotePath}`);
    
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

    const remoteBase =
      (await resolveSftpRemoteDir(sftp, sftpRemoteDirCandidates(config.remotePath))) ||
      config.remotePath;
    console.log(`📁 Используемый путь на сервере: ${remoteBase}`);
    
    // Проверяем существование целевой папки
    const remotePathExists = await sftp.exists(remoteBase);
    console.log(`📂 Папка "${remoteBase}" существует: ${remotePathExists}`);
    
    let results: any = {
      connected: true,
      remotePath: remoteBase,
      remotePathExists: remotePathExists !== false,
      rootFiles: [],
      targetFolderFiles: [],
      structure: {}
    };
    
    // Смотрим корневую директорию
    console.log('\n📋 Содержимое корневой директории:');
    const rootFiles = await sftp.list('/');
    results.rootFiles = rootFiles.map((file: any) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      modifyTime: file.modifyTime,
      accessTime: file.accessTime,
      rights: file.rights
    }));
    
    rootFiles.forEach((file: any) => {
      const icon = file.type === 'd' ? '📁' : '📄';
      const size = file.size ? ` (${formatBytes(file.size)})` : '';
      const date = file.modifyTime ? ` - ${new Date(file.modifyTime).toLocaleString('ru-RU')}` : '';
      console.log(`  ${icon} ${file.name}${size}${date}`);
    });
    
    // Если целевая папка существует, смотрим её содержимое
    if (remotePathExists) {
      console.log(`\n📋 Содержимое папки "${remoteBase}":`);
      const targetFiles = await sftp.list(remoteBase);
      results.targetFolderFiles = targetFiles.map((file: any) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        modifyTime: file.modifyTime,
        accessTime: file.accessTime,
        rights: file.rights
      }));
      
      targetFiles.forEach((file: any) => {
        const icon = file.type === 'd' ? '📁' : '📄';
        const size = file.size ? ` (${formatBytes(file.size)})` : '';
        const date = file.modifyTime ? ` - ${new Date(file.modifyTime).toLocaleString('ru-RU')}` : '';
        console.log(`  ${icon} ${file.name}${size}${date}`);
      });
      
      // Рекурсивно обходим подпапки (максимум 2 уровня вложенности)
      results.structure = await exploreDirectory(sftp, remoteBase, 0, 2);
    } else {
      console.log(`\n⚠️ Папка "${remoteBase}" не существует`);
    }
    
    // Скачиваем несколько файлов для анализа
    if (results.targetFolderFiles.length > 0) {
      console.log('\n📥 Скачиваю файлы для анализа...');
      const sampleFiles = results.targetFolderFiles
        .filter((f: any) => f.type === 'file')
        .slice(0, 3); // Берем первые 3 файла
      
      results.sampleFiles = [];
      
      for (const file of sampleFiles) {
        try {
          const remotePath = path.posix.join(remoteBase, file.name);
          const content = await sftp.get(remotePath);
          const textContent = content.toString('utf-8');
          
          results.sampleFiles.push({
            filename: file.name,
            size: file.size,
            content: textContent,
            lines: textContent.split('\n').length,
            firstLines: textContent.split('\n').slice(0, 10)
          });
          
          console.log(`  ✅ Скачан: ${file.name} (${file.size} bytes, ${textContent.split('\n').length} строк)`);
        } catch (error: any) {
          console.log(`  ⚠️ Ошибка при скачивании ${file.name}: ${error.message}`);
        }
      }
    }
    
    // Читаем содержимое нескольких файлов для анализа структуры
    if (results.targetFolderFiles.length > 0) {
      console.log('\n📖 Анализ содержимого файлов:');
      
      // Берем первый, средний и последний файл для анализа
      const sampleFiles = [
        results.targetFolderFiles[0],
        results.targetFolderFiles[Math.floor(results.targetFolderFiles.length / 2)],
        results.targetFolderFiles[results.targetFolderFiles.length - 1]
      ].filter(f => f.type === 'file');
      
      results.fileSamples = [];
      
      for (const file of sampleFiles) {
        try {
          const filePath = path.posix.join(remoteBase, file.name);
          console.log(`\n  📄 Анализирую: ${file.name}`);
          const fileContent = await sftp.get(filePath);
          const contentStr = fileContent.toString('utf-8');
          
          // Анализируем структуру CSV
          const lines = contentStr.split('\n').filter((l: string) => l.trim());
          const headers = lines[0]?.split(',') || [];
          const sampleRows = lines.slice(1, Math.min(4, lines.length));
          
          results.fileSamples.push({
            filename: file.name,
            size: file.size,
            lineCount: lines.length,
            headers: headers,
            sampleRows: sampleRows,
            fullContent: contentStr.substring(0, 1000) // Первые 1000 символов
          });
          
          console.log(`    ✅ Строк: ${lines.length}`);
          console.log(`    📋 Колонки: ${headers.join(', ')}`);
          if (sampleRows.length > 0) {
            console.log(`    📝 Пример данных (первая строка): ${sampleRows[0]?.substring(0, 100)}...`);
          }
        } catch (error: any) {
          console.log(`    ❌ Ошибка чтения: ${error.message}`);
          results.fileSamples.push({
            filename: file.name,
            error: error.message
          });
        }
      }
    }
    
    await sftp.end();
    console.log('\n✅ Отключение от сервера');
    
    return results;
    
  } catch (error: any) {
    console.error('❌ Ошибка при работе с SFTP:', error.message);
    await sftp.end().catch(() => {});
    throw error;
  }
}

async function exploreDirectory(
  sftp: SftpClient, 
  path: string, 
  currentDepth: number, 
  maxDepth: number
): Promise<any> {
  if (currentDepth >= maxDepth) {
    return { note: 'Max depth reached' };
  }
  
  try {
    const files = await sftp.list(path);
    const structure: any = {};
    
    for (const file of files) {
      const fullPath = `${path}/${file.name}`;
      
      if (file.type === 'd') {
        // Это директория, рекурсивно обходим
        structure[file.name] = {
          type: 'directory',
          path: fullPath,
          contents: await exploreDirectory(sftp, fullPath, currentDepth + 1, maxDepth)
        };
      } else {
        // Это файл
        structure[file.name] = {
          type: 'file',
          path: fullPath,
          size: file.size,
          modifyTime: file.modifyTime,
          extension: getFileExtension(file.name)
        };
      }
    }
    
    return structure;
  } catch (error: any) {
    return { error: error.message };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
