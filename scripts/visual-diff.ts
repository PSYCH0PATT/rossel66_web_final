/**
 * Пиксельное сравнение двух наборов скринов из `visual-baseline.ts`.
 *
 * Сверяет `screens/baseline` с текущим прогоном файл в файл и печатает процент
 * отличий по каждому. Порог по умолчанию 0.5 %: ниже — шум рендера (сглаживание
 * шрифтов, субпиксели), выше — экран действительно поехал. Порог считается от
 * общего числа пикселей кадра, поэтому длинные full-page-скрины не «размывают»
 * локальную поломку — для них 0.5 % это всё ещё заметный блок.
 *
 * Usage:
 *   npx tsx scripts/visual-baseline.ts --out screens/after
 *   npx tsx scripts/visual-diff.ts --current screens/after
 *
 * Флаги:
 *   --baseline <dir>   эталон (по умолчанию screens/baseline)
 *   --current <dir>    что сравнивать (по умолчанию screens/current)
 *   --out <dir>        куда класть diff-картинки (по умолчанию screens/diff)
 *   --threshold <%>    порог в процентах (по умолчанию 0.5)
 *
 * Код возврата 1, если хоть один файл выше порога, пропал или сменил размер, —
 * чтобы скрипт годился как шаг CI.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { dirname, join, relative, resolve } from "path"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

function parseArgs(argv: string[]) {
  const out = {
    baselineDir: "screens/baseline",
    currentDir: "screens/current",
    outDir: "screens/diff",
    threshold: 0.5,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`У флага ${arg} нет значения`)
      return v
    }
    if (arg === "--baseline") out.baselineDir = value()
    else if (arg === "--current") out.currentDir = value()
    else if (arg === "--out") out.outDir = value()
    else if (arg === "--threshold") {
      const raw = Number(value())
      if (!Number.isFinite(raw) || raw < 0) throw new Error("--threshold ждёт число процентов")
      out.threshold = raw
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "npx tsx scripts/visual-diff.ts [--baseline screens/baseline] [--current screens/current] [--out screens/diff] [--threshold 0.5]"
      )
      process.exit(0)
    } else throw new Error(`Неизвестный аргумент: ${arg}`)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

/** Все .png внутри dir, путями относительно него. */
function listPngs(dir: string): string[] {
  const root = resolve(process.cwd(), dir)
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith(".png")) out.push(relative(root, full))
    }
  }
  walk(root)
  return out.sort()
}

type Row = {
  file: string
  verdict: "ok" | "diff" | "missing" | "added" | "size"
  percent: number | null
  note: string
}

function compare(baselineFile: string, currentFile: string, diffFile: string, file: string): Row {
  const baseline = PNG.sync.read(readFileSync(baselineFile))
  const current = PNG.sync.read(readFileSync(currentFile))

  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      file,
      verdict: "size",
      percent: null,
      note: `${baseline.width}x${baseline.height} → ${current.width}x${current.height}`,
    }
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const changed = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
    // 0.1 — стандартный порог цветовой чувствительности pixelmatch: ловит сдвиги
    // и перекраску, не срываясь на сглаживание шрифтов.
    threshold: 0.1,
    includeAA: false,
  })
  const percent = (changed / (baseline.width * baseline.height)) * 100

  if (percent > args.threshold) {
    mkdirSync(dirname(diffFile), { recursive: true })
    writeFileSync(diffFile, PNG.sync.write(diff))
    return { file, verdict: "diff", percent, note: relative(process.cwd(), diffFile) }
  }
  return { file, verdict: "ok", percent, note: "" }
}

function main() {
  const baselineFiles = listPngs(args.baselineDir)
  const currentFiles = new Set(listPngs(args.currentDir))
  if (baselineFiles.length === 0) {
    throw new Error(`В ${args.baselineDir} нет ни одного .png — сначала снимите baseline`)
  }

  const rows: Row[] = []
  for (const file of baselineFiles) {
    if (!currentFiles.has(file)) {
      rows.push({ file, verdict: "missing", percent: null, note: "нет в current" })
      continue
    }
    currentFiles.delete(file)
    rows.push(
      compare(
        resolve(process.cwd(), args.baselineDir, file),
        resolve(process.cwd(), args.currentDir, file),
        resolve(process.cwd(), args.outDir, file),
        file
      )
    )
  }
  for (const file of currentFiles) {
    rows.push({ file, verdict: "added", percent: null, note: "нет в baseline" })
  }

  const label: Record<Row["verdict"], string> = {
    ok: "ok",
    diff: "DIFF",
    missing: "ПРОПАЛ",
    added: "НОВЫЙ",
    size: "РАЗМЕР",
  }
  const nameWidth = Math.max(4, ...rows.map((r) => r.file.length))
  console.log(`${"ФАЙЛ".padEnd(nameWidth)}  ${"СТАТУС".padEnd(6)}  ${"ОТЛИЧИЙ".padStart(8)}  ЗАМЕТКА`)
  console.log("─".repeat(nameWidth + 30))
  for (const r of rows) {
    const percent = r.percent === null ? "—" : `${r.percent.toFixed(3)}%`
    console.log(
      `${r.file.padEnd(nameWidth)}  ${label[r.verdict].padEnd(6)}  ${percent.padStart(8)}  ${r.note}`
    )
  }

  const failed = rows.filter((r) => r.verdict !== "ok")
  console.log(
    `\nПорог ${args.threshold}%. Совпало ${rows.length - failed.length}/${rows.length}` +
      (failed.length > 0 ? `, расхождений ${failed.length} (diff-картинки в ${args.outDir})` : "")
  )
  if (failed.length > 0) process.exit(1)
}

try {
  main()
} catch (err) {
  console.error(`\n${(err as Error).message}`)
  process.exit(1)
}
