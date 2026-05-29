import { createClient } from '@supabase/supabase-js'

// Mock global WebSocket for Node.js environments without native WebSocket (like Node < 22)
// This is required because `@supabase/supabase-js` attempts to initialize the Realtime client.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {} as any
}

// Вытаскиваем project ref из DATABASE_URL если переменная URL не задана
const getFallbackUrl = () => {
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl) {
    const match = dbUrl.match(/@db\.(.+?)\.supabase\.co/) || dbUrl.match(/\.pooler\.supabase\.co/)
    if (match) {
      // Ищем project ref в pooler url: postgres.whygmlakldsunkjkhrsi:password@aws...
      const refMatch = dbUrl.match(/postgres\.(.+?):/)
      if (refMatch) {
        return `https://${refMatch[1]}.supabase.co`
      }
    }
  }
  return 'https://whygmlakldsunkjkhrsi.supabase.co' // fallback по умолчанию
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || getFallbackUrl()
// На бэкенде нам нужен Service Role Key для работы в обход RLS и автоматического создания бакетов
const actualKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!actualKey) {
  console.warn(
    '⚠️ Предупреждение: SUPABASE_SERVICE_ROLE_KEY не задан в переменных окружения. Работа с файлами Supabase Storage может завершаться ошибкой.'
  )
}

// Передаем фиктивный ключ для статического анализа Next.js (pnpm build) в Docker
const supabaseServiceKey = actualKey || 'dummy_key_for_build_purposes_only'

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
})

/**
 * Гарантирует, что бакет существует с заданными параметрами.
 */
export async function ensureBucketExists(bucketName: string = 'reports', isPublic: boolean = false) {
  if (!supabaseServiceKey) {
    console.warn(`[Supabase Storage] Пропуск создания бакета "${bucketName}" — отсутствует ключ сервисной роли.`)
    return
  }

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.warn(`[Supabase Storage] Не удалось получить список бакетов:`, listError.message)
      return
    }

    const exists = buckets.some((b) => b.name === bucketName)
    if (!exists) {
      console.log(`[Supabase Storage] Создаем бакет "${bucketName}" (public: ${isPublic})...`)
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
        fileSizeLimit: 52428800 // 50MB
      })
      if (createError) {
        console.error(`[Supabase Storage] Ошибка при создании бакета "${bucketName}":`, createError.message)
      } else {
        console.log(`[Supabase Storage] Бакет "${bucketName}" успешно создан.`)
      }
    }
  } catch (err) {
    console.error(`[Supabase Storage] Ошибка при инициализации бакета "${bucketName}":`, err)
  }
}
