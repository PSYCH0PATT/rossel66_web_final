/**
 * Копирует файлы Supabase Storage из боевого проекта в стейджинговый.
 *
 *   pnpm storage:clone-to-staging
 *
 * Нужен вместе с копией базы: в таблице Report лежат пути к файлам отчётов, и без
 * файлов скачивание на стейдже отдавало бы 404. Раньше стейдж читал и ПЕРЕЗАПИСЫВАЛ
 * (upsert: true) файлы в боевом бакете — ради этого разделение и делается.
 *
 * Читает:
 *   .env.local          — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (прод)
 *   .env.staging.local  — STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

/** Ref боевого проекта — предохранитель против записи в прод. */
const PROD_REF = "whygmlakldsunkjkhrsi"

function readEnvFile(name: string): Record<string, string> {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    out[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1")
  }
  return out
}

function die(message: string): never {
  console.error(`\n✘ ${message}`)
  process.exit(1)
}

const prodEnv = readEnvFile(".env.local")
const stagingEnv = readEnvFile(".env.staging.local")

const PROD_URL = prodEnv.NEXT_PUBLIC_SUPABASE_URL || `https://${PROD_REF}.supabase.co`
const PROD_KEY = prodEnv.SUPABASE_SERVICE_ROLE_KEY
const STAGING_URL = stagingEnv.STAGING_SUPABASE_URL
const STAGING_KEY = stagingEnv.STAGING_SUPABASE_SERVICE_ROLE_KEY

if (!PROD_KEY) die("В .env.local нет SUPABASE_SERVICE_ROLE_KEY (боевой проект)")
if (!STAGING_URL || !STAGING_KEY) {
  die(
    "В .env.staging.local нужны STAGING_SUPABASE_URL и STAGING_SUPABASE_SERVICE_ROLE_KEY.\n" +
      "   Взять: дашборд Supabase проекта rossel-staging → Settings → API"
  )
}
if (STAGING_URL.includes(PROD_REF)) {
  die(`ОТКАЗ: адрес назначения указывает на БОЕВОЙ проект (${PROD_REF})`)
}
if (STAGING_URL === PROD_URL) die("ОТКАЗ: источник и назначение совпадают")

const prod = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } })
const staging = createClient(STAGING_URL, STAGING_KEY, { auth: { persistSession: false } })

/** Рекурсивный обход: list отдаёт только один уровень. */
async function listAll(bucket: string, prefix = ""): Promise<string[]> {
  const { data, error } = await prod.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) die(`не удалось прочитать ${bucket}/${prefix}: ${error.message}`)
  const files: string[] = []
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    // У папок нет metadata — спускаемся внутрь.
    if (entry.id === null || entry.metadata === null) {
      files.push(...(await listAll(bucket, path)))
    } else {
      files.push(path)
    }
  }
  return files
}

async function main() {
  console.log(`источник : ${PROD_URL}`)
  console.log(`назначение: ${STAGING_URL}\n`)

  const { data: buckets, error } = await prod.storage.listBuckets()
  if (error) die(`не удалось получить список бакетов: ${error.message}`)
  if (!buckets?.length) {
    console.log("в боевом проекте нет бакетов — копировать нечего")
    return
  }

  let copied = 0
  let failed = 0

  for (const bucket of buckets) {
    // Сохраняем публичность как на проде: у аватаров и отчётов она разная.
    const { error: createError } = await staging.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    })
    if (createError && !/already exists/i.test(createError.message)) {
      die(`не удалось создать бакет ${bucket.name}: ${createError.message}`)
    }

    const files = await listAll(bucket.name)
    console.log(`▶ ${bucket.name}: ${files.length} файлов (public=${bucket.public})`)

    for (const path of files) {
      const { data: blob, error: downloadError } = await prod.storage
        .from(bucket.name)
        .download(path)
      if (downloadError || !blob) {
        console.error(`   ✘ ${path}: скачать не удалось — ${downloadError?.message}`)
        failed++
        continue
      }
      const buffer = Buffer.from(await blob.arrayBuffer())
      const { error: uploadError } = await staging.storage
        .from(bucket.name)
        .upload(path, buffer, {
          upsert: true,
          contentType: blob.type || "application/octet-stream",
        })
      if (uploadError) {
        console.error(`   ✘ ${path}: залить не удалось — ${uploadError.message}`)
        failed++
        continue
      }
      copied++
    }
  }

  console.log(`\n✔ Скопировано файлов: ${copied}${failed ? `, с ошибками: ${failed}` : ""}`)
  if (failed) process.exit(1)
}

main().catch((error) => die(String(error)))
