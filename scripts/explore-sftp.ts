import { exploreSftpServer } from '../lib/sftp-explorer';

async function main() {
  const config = {
    host: 'sftp1.sp-digital.ru', // Можно использовать IP: '195.46.167.154'
    port: 22,
    username: 'Rossel66',
    password: '9us)!7xvZr_(!5',
    remotePath: 'rossel_playlist'
  };
  
  try {
    console.log('🚀 Начинаю исследование SFTP сервера...\n');
    const results = await exploreSftpServer(config);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(60));
    
    console.log(`\n📁 Всего файлов в папке: ${results.targetFolderFiles.length}`);
    console.log(`📅 Период данных: с ${results.targetFolderFiles[0]?.name} по ${results.targetFolderFiles[results.targetFolderFiles.length - 1]?.name}`);
    
    if (results.fileSamples && results.fileSamples.length > 0) {
      console.log('\n📋 Структура данных:');
      const firstSample = results.fileSamples[0];
      if (firstSample.headers) {
        console.log(`   Колонки (${firstSample.headers.length}):`);
        firstSample.headers.forEach((h: string, i: number) => {
          console.log(`     ${i + 1}. ${h.trim()}`);
        });
      }
      
      if (firstSample.sampleRows && firstSample.sampleRows.length > 0) {
        console.log('\n   Пример данных:');
        firstSample.sampleRows.slice(0, 3).forEach((row: string, i: number) => {
          console.log(`     Строка ${i + 1}: ${row.substring(0, 150)}${row.length > 150 ? '...' : ''}`);
        });
      }
    }
    
    console.log('\n✅ Анализ завершен');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
