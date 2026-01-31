import SftpClient from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';

interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
}

export async function downloadSftpFiles(
  config: SftpConfig,
  localDir: string = './sftp_downloads'
): Promise<{ downloaded: number; files: string[] }> {
  const sftp = new SftpClient();
  
  try {
    console.log(`🔌 Подключаюсь к SFTP серверу: ${config.host}:${config.port}`);
    
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 20000,
    });
    
    console.log('✅ Подключение установлено');
    
    // Создаем локальную директорию
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
      console.log(`📁 Создана локальная директория: ${localDir}`);
    }
    
    // Получаем список файлов
    console.log(`📋 Получаю список файлов из "${config.remotePath}"...`);
    const files = await sftp.list(config.remotePath);
    
    const csvFiles = files.filter((file: any) => 
      file.type === '-' && file.name.endsWith('.csv')
    );
    
    console.log(`📊 Найдено CSV файлов: ${csvFiles.length}`);
    
    const downloadedFiles: string[] = [];
    let downloaded = 0;
    
    // Скачиваем каждый файл
    for (let i = 0; i < csvFiles.length; i++) {
      const file = csvFiles[i];
      const remoteFilePath = `${config.remotePath}/${file.name}`;
      const localFilePath = path.join(localDir, file.name);
      
      try {
        console.log(`⬇️  [${i + 1}/${csvFiles.length}] Скачиваю: ${file.name} (${formatBytes(file.size || 0)})`);
        
        // Используем Promise с таймаутом
        const downloadPromise = sftp.fastGet(remoteFilePath, localFilePath);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 30000)
        );
        
        await Promise.race([downloadPromise, timeoutPromise]);
        
        downloadedFiles.push(localFilePath);
        downloaded++;
        console.log(`✅ Скачан: ${file.name}`);
      } catch (error: any) {
        if (error.message === 'Timeout') {
          console.error(`⏱️  Таймаут при скачивании ${file.name}`);
        } else {
          console.error(`❌ Ошибка при скачивании ${file.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n🔌 Закрываю соединение...');
    try {
      await Promise.race([
        sftp.end(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    } catch (error: any) {
      console.log('⚠️  Принудительное закрытие соединения');
      sftp.end().catch(() => {});
    }
    
    console.log(`\n✅ Скачано файлов: ${downloaded}/${csvFiles.length}`);
    
    return {
      downloaded,
      files: downloadedFiles
    };
    
  } catch (error: any) {
    console.error('❌ Ошибка при работе с SFTP:', error.message);
    await sftp.end().catch(() => {});
    throw error;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
