/**
 * Синхронизация структуры формы Pyrus «Бэк-каталог» (2312633) в snapshot JSON.
 * Запуск: pnpm sync:pyrus-catalog
 */
import { writeFileSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { assertPyrusConfigured } from "../lib/pyrus-env"
import { getPyrusAccessToken } from "../lib/pyrus"

export const PYRUS_CATALOG_FORM_ID = 2312633

export type PyrusFieldSnapshot = {
  id: number
  type: string
  name: string
  parentId?: number
  columns?: PyrusFieldSnapshot[]
  children?: PyrusFieldSnapshot[]
}

export type CatalogFormSnapshot = {
  formId: number
  formName: string
  syncedAt: string
  fields: PyrusFieldSnapshot[]
  flat: PyrusFieldSnapshot[]
}

type RawPyrusField = {
  id: number
  type: string
  name?: string
  info?: {
    columns?: RawPyrusField[]
    fields?: RawPyrusField[]
  }
}

function mapField(raw: RawPyrusField, parentId?: number): PyrusFieldSnapshot {
  const node: PyrusFieldSnapshot = {
    id: raw.id,
    type: raw.type,
    name: raw.name ?? "",
    ...(parentId !== undefined ? { parentId } : {}),
  }
  if (raw.type === "table" && raw.info?.columns) {
    node.columns = raw.info.columns.map((c) => mapField(c, raw.id))
  }
  if (raw.info?.fields) {
    node.children = raw.info.fields.map((c) => mapField(c, raw.id))
  }
  return node
}

function flatten(fields: PyrusFieldSnapshot[], acc: PyrusFieldSnapshot[] = []): PyrusFieldSnapshot[] {
  for (const f of fields) {
    acc.push({ id: f.id, type: f.type, name: f.name, parentId: f.parentId })
    if (f.columns) flatten(f.columns, acc)
    if (f.children) flatten(f.children, acc)
  }
  return acc
}

function validateSnapshot(snapshot: CatalogFormSnapshot): string[] {
  const errors: string[] = []
  const typeFields = snapshot.flat.filter((f) => f.type === "multiple_choice" && /тип/i.test(f.name))
  if (typeFields.length < 5) {
    errors.push(`Ожидалось 5 полей «Тип релиза», найдено ${typeFields.length}`)
  }

  const fourthSingleGenre = snapshot.flat.find((f) => f.id === 245)
  if (!fourthSingleGenre || fourthSingleGenre.type !== "text") {
    errors.push("Поле id 245 (Жанр, 4-й сингл) не найдено или не text")
  }
  const fourthSingleDate = snapshot.flat.find((f) => f.id === 175)
  if (!fourthSingleDate || fourthSingleDate.type !== "date") {
    errors.push("Поле id 175 (дата, 4-й сингл) не найдено или не date")
  }

  return errors
}

async function main() {
  const { login, apiKey } = assertPyrusConfigured()
  const token = await getPyrusAccessToken(apiKey)
  if (!token) {
    console.error("Не удалось получить access_token Pyrus для", login)
    process.exit(1)
  }

  const res = await fetch(`https://api.pyrus.com/v4/forms/${PYRUS_CATALOG_FORM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json()) as { id?: number; name?: string; fields?: RawPyrusField[]; error?: string }
  if (!data.fields) {
    console.error("Ошибка загрузки формы:", data)
    process.exit(1)
  }

  const fields = data.fields.map((f) => mapField(f))
  const snapshot: CatalogFormSnapshot = {
    formId: PYRUS_CATALOG_FORM_ID,
    formName: data.name ?? "Бэк-каталог",
    syncedAt: new Date().toISOString(),
    fields,
    flat: flatten(fields),
  }

  const validationErrors = validateSnapshot(snapshot)
  if (validationErrors.length > 0) {
    console.error("Валидация snapshot не прошла:")
    validationErrors.forEach((e) => console.error(" -", e))
    process.exit(1)
  }

  const root = dirname(fileURLToPath(import.meta.url))
  const outPath = join(root, "../lib/pyrus-catalog/form-2312633.snapshot.json")
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8")

  console.log(`Snapshot сохранён: ${outPath}`)
  console.log(`Полей (flat): ${snapshot.flat.length}, форма: ${snapshot.formName}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
