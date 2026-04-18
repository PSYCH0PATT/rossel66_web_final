import { exploreSftpServer } from '../lib/sftp-explorer';

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
  } catch (error: unknown) {
    const err = error as Error;
    console.error('\n❌ Критическая ошибка:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
