import { downloadSftpFiles } from '../lib/sftp-downloader';

async function main() {
  const config = {
    host: 'sftp1.sp-digital.ru',
    port: 22,
    username: 'Rossel66',
    password: '9us)!7xvZr_(!5',
    remotePath: 'rossel_playlist'
  };
  
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
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Прервано пользователем');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Завершение процесса');
  process.exit(0);
});

main();
