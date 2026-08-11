import * as fs from 'fs'
import * as path from 'path'

// Вручную парсим .env.local и .env файлы для тестирования
const loadEnvFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8')
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let value = match[2] || ''
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    })
  }
}

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

async function main() {
  const { ensureBucketExists, supabase } = await import('../../lib/supabase')
  
  console.log('📊 Проверка подключения к Supabase Storage...\n')
  
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log(`  Секретный ключ (SUPABASE_SERVICE_ROLE_KEY): ${hasKey ? 'ОБНАРУЖЕН' : 'ОТСУТСТВУЕТ ❌'}`)
  
  if (!hasKey) {
    console.error('\n❌ Ошибка: Вы не добавили SUPABASE_SERVICE_ROLE_KEY в .env.local')
    process.exit(1)
  }
  
  console.log('\n🔄 Выполняем проверку и создание приватного бакета "reports"...')
  await ensureBucketExists('reports')
  
  console.log('\n🔎 Получаем список текущих бакетов из Supabase Storage:')
  const { data: buckets, error } = await supabase.storage.listBuckets()
  
  if (error) {
    console.error('  ❌ Ошибка при получении списка бакетов:', error.message)
    process.exit(1)
  }
  
  console.log('  Список найденных бакетов:')
  buckets.forEach(bucket => {
    console.log(`  - ${bucket.name} (Доступ: ${bucket.public ? 'Публичный' : 'Приватный'}, Лимит размера: ${bucket.file_size_limit ? (bucket.file_size_limit / 1024 / 1024) + 'MB' : 'нет'})`)
  })
  
  const created = buckets.some(b => b.name === 'reports')
  if (created) {
    console.log('\n✅ Supabase Storage успешно настроен! Бакет "reports" создан и готов к работе.')
  } else {
    console.error('\n❌ Бакет "reports" не был найден в списке после попытки создания.')
  }
}

main()
