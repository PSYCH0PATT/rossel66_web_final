import * as fs from 'fs'
import * as path from 'path'

// Load env
function loadEnv(fp: string) {
  if (fs.existsSync(fp)) {
    fs.readFileSync(fp, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?$/)
      if (m) {
        let v = (m[2] || '').trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1)
        process.env[m[1]] = v
      }
    })
  }
}
loadEnv(path.join(process.cwd(), '.env'))
loadEnv(path.join(process.cwd(), '.env.local'))

async function main() {
  const { supabase } = await import('../lib/supabase')
  const { prisma } = await import('../lib/prisma')

  // List buckets
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
  if (bucketsErr) { console.error('Ошибка listBuckets:', bucketsErr); return }
  console.log('=== БАКЕТЫ ===')
  for (const b of buckets) {
    console.log(`  ${b.name} (public: ${b.public})`)
  }

  // List files in reports bucket
  console.log('\n=== ФАЙЛЫ В БАКЕТЕ reports ===')
  const { data: folders, error: foldersErr } = await supabase.storage.from('reports').list('', { limit: 100 })
  if (foldersErr) {
    console.error('Ошибка list reports:', foldersErr)
  } else {
    for (const item of (folders || [])) {
      if (item.id === null) {
        // folder
        const { data: files } = await supabase.storage.from('reports').list(item.name, { limit: 200 })
        console.log(`  📁 ${item.name}/ (${files?.length || 0} файлов)`)
        for (const f of (files || []).slice(0, 5)) {
          const sz = f.metadata?.size ? Math.round(f.metadata.size / 1024) + 'KB' : '?'
          console.log(`     - ${f.name} (${sz})`)
        }
        if ((files?.length || 0) > 5) console.log(`     ... и ещё ${(files!.length - 5)}`)
      } else {
        console.log(`  📄 ${item.name}`)
      }
    }
  }

  // covers
  console.log('\n=== БАКЕТ covers ===')
  const coversExists = buckets.some(b => b.name === 'covers')
  if (coversExists) {
    const { data: coverFiles } = await supabase.storage.from('covers').list('', { limit: 20 })
    console.log(`  Файлов: ${coverFiles?.length || 0}`)
    for (const f of (coverFiles || []).slice(0, 5)) console.log(`     - ${f.name}`)
  } else {
    console.log('  Бакет ещё не создан (создастся при первой загрузке)')
  }

  // avatars
  console.log('\n=== БАКЕТ avatars ===')
  const avatarsExists = buckets.some(b => b.name === 'avatars')
  if (avatarsExists) {
    const { data: avatarFiles } = await supabase.storage.from('avatars').list('', { limit: 20 })
    console.log(`  Файлов: ${avatarFiles?.length || 0}`)
  } else {
    console.log('  Бакет ещё не создан (создастся при первой загрузке)')
  }

  // Cross-check DB
  console.log('\n=== КРОСС-ПРОВЕРКА: БД vs STORAGE ===')
  const totalReports = await prisma.report.count()
  const reportsWithPath = await prisma.report.count({ where: { filePath: { not: '' } } })
  console.log(`  Отчетов в БД: ${totalReports}`)
  console.log(`  С путём к файлу: ${reportsWithPath}`)

  // Sample paths to see format
  const sampleReports = await prisma.report.findMany({
    take: 10,
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, artistName: true, filePath: true, quarter: true, year: true }
  })
  console.log('  Последние 10 отчетов (пути):')
  for (const r of sampleReports) {
    console.log(`    ${r.artistName} (${r.quarter} ${r.year}) -> ${r.filePath}`)
  }

  // Try downloading a sample file to verify it works
  console.log('\n=== ТЕСТ СКАЧИВАНИЯ ===')
  const testReport = sampleReports[0]
  if (testReport?.filePath) {
    // Use same getStoragePath logic
    function getStoragePath(dbPath: string): string {
      const reportsIndex = dbPath.indexOf('reports/')
      if (reportsIndex !== -1) return dbPath.substring(reportsIndex + 8)
      const qMatch = dbPath.match(/(Q[1-4]\/.*)$/)
      if (qMatch) return qMatch[1]
      return dbPath
    }
    const sp = getStoragePath(testReport.filePath)
    console.log(`  Пробуем скачать: ${sp}`)
    const { data, error } = await supabase.storage.from('reports').download(sp)
    if (error) {
      console.error(`  ❌ Ошибка скачивания: ${error.message}`)
    } else if (data) {
      const ab = await data.arrayBuffer()
      console.log(`  ✅ Успешно скачан! Размер: ${Math.round(ab.byteLength / 1024)} KB`)
    }
  } else {
    console.log('  Нет отчетов для тестирования')
  }
}

main().catch(console.error)
