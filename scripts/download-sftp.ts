import { downloadSftpFiles } from '../lib/sftp-downloader';

async function main() {
  const host = process.env.SFTP_HOST || 'sftp1.sp-digital.ru';
  const port = parseInt(process.env.SFTP_PORT || '22', 10);
  const username = process.env.SFTP_USERNAME;
  const password = process.env.SFTP_PASSWORD;
  const remotePath = process.env.SFTP_REMOTE_PATH || 'rossel_playlist';

  if (!username || !password) {
    console.error('Задайте SFTP_USERNAME и SFTP_PASSWORD в окружении.');
    process.exit(1);
  }

  const config = { host, port, username, password, remotePath };

  try {
    console.log('🚀 Начинаю скачивание файлов с SFTP сервера...\n');
    const result = await downloadSftpFiles(config, './sftp_downloads');

    console.log('\n' + '='.repeat(60));
    console.log('📊 РЕЗУЛЬТАТ СКАЧИВАНИЯ');
    console.log('='.repeat(60));
    console.log(`✅ Скачано файлов: ${result.downloaded}`);
    console.log(`📁 Директория: ./sftp_downloads`);

    if (result.files.length > 0) {
      console.log(`\n📄 Первые 10 файлов:`);
      result.files.slice(0, 10).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
      if (result.files.length > 10) {
        console.log(`  ... и еще ${result.files.length - 10} файлов`);
      }
    }

    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('\n❌ Критическая ошибка:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
