/**
 * Карта фактического дизайна кабинетов — генератор.
 *
 * Инвентаризация, а не рефакторинг: скрипт читает код и выписывает, что там
 * НА САМОМ ДЕЛЕ используется. Ничего не чинит и не унифицирует. Результат —
 * `app/dev/design-map/design-map.json`, который рендерит страница
 * `/dev/design-map`.
 *
 * Зачем генератор, а не документ руками: карта, написанная руками, устаревает
 * на первой же правке экрана и начинает врать. Здесь единственный источник —
 * сам код, поэтому `pnpm design:map` в любой момент даёт актуальный срез.
 *
 * Что сканируется:
 *   app/dashboard/**       — экраны обоих кабинетов;
 *   components/** (кроме ui) — тело экранов, вынесенное в компоненты;
 *   components/ui/**       — кит, отдельной секцией как эталон;
 *   app/tokens.css, app/dashboard/dashboard.css, app/globals.css, tailwind.config.js.
 *
 * Usage: npx tsx scripts/design-map.ts   (он же `pnpm design:map`)
 */
import ts from "typescript"
import { execFileSync } from "child_process"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { createRequire } from "module"
import { dirname, join, normalize, relative } from "path"

const ROOT = process.cwd()
const OUT = "app/dev/design-map/design-map.json"

// ---------------------------------------------------------------------------
// 1. Файлы и зоны
// ---------------------------------------------------------------------------

/**
 * Зона файла решает, как считать частоту. Кит — эталон, лендинг — не наш скоуп,
 * но `components/**` сканируется целиком, поэтому лендинговые файлы честнее
 * пометить, чем молча выкинуть.
 */
export type Zone = "page" | "cabinet-component" | "landing-component" | "kit"

const ZONE_TITLE: Record<Zone, string> = {
  page: "экраны кабинета",
  "cabinet-component": "компоненты кабинета",
  "landing-component": "компоненты вне кабинета",
  kit: "кит components/ui",
}

const PAGES_ROOT = "app/dashboard"
const COMPONENTS_ROOT = "components"
const KIT_ROOT = "components/ui"

function walk(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p, keep)
    return keep(e.name) ? [p] : []
  })
}

const isTsx = (n: string) => n.endsWith(".tsx") || n.endsWith(".ts")

const pageFiles = walk(PAGES_ROOT, isTsx).sort()
const allComponentFiles = walk(COMPONENTS_ROOT, isTsx)
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
  .sort()
const kitFiles = allComponentFiles.filter((f) => f.startsWith(KIT_ROOT + "/"))
const nonKitComponentFiles = allComponentFiles.filter((f) => !f.startsWith(KIT_ROOT + "/"))

/** Разрешение импорта в путь файла репозитория (только свой код, не node_modules). */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = spec.slice(2)
  else if (spec.startsWith("./") || spec.startsWith("../")) base = normalize(join(dirname(fromFile), spec))
  else return null
  const candidates = [base, base + ".tsx", base + ".ts", join(base, "index.tsx"), join(base, "index.ts")]
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

const sourceCache = new Map<string, ts.SourceFile>()
function sourceOf(file: string): ts.SourceFile {
  const cached = sourceCache.get(file)
  if (cached) return cached
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  sourceCache.set(file, sf)
  return sf
}

function importsOf(file: string): string[] {
  const sf = sourceOf(file)
  const out: string[] = []
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const r = resolveImport(st.moduleSpecifier.text, file)
      if (r) out.push(r)
    }
  }
  return out
}

/** Роут страницы: `app/dashboard/admin/artists/page.tsx` → `/dashboard/admin/artists`. */
function routeOf(file: string): string {
  return "/" + dirname(file).replace(/^app\//, "")
}

const routeFiles = pageFiles.filter((f) => f.endsWith("/page.tsx"))
const routes = routeFiles.map(routeOf).sort()

/** Файлы, до которых дотягивается страница роута (транзитивно, только свой код). */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>([entry])
  const queue = [entry]
  while (queue.length) {
    const cur = queue.pop() as string
    for (const next of importsOf(cur)) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

/**
 * Точки входа роута: сама страница плюс все её layout/loading/error по пути
 * вверх. Без layout'ов шелл кабинета (`dashboard-shell` → `sidebar`, `top-nav`)
 * не считался бы частью кабинета вовсе: он монтируется из layout, а не из page.
 */
function entryPointsOf(routeFile: string): string[] {
  const entries = [routeFile]
  let dir = dirname(routeFile)
  while (dir.startsWith("app") && dir.length >= 3) {
    for (const special of ["layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx", "template.tsx"]) {
      const f = join(dir, special)
      if (existsSync(f)) entries.push(f)
    }
    if (dir === "app") break
    dir = dirname(dir)
  }
  return entries
}

/** file → роуты, которые его монтируют. Нужно и для зон, и для таблицы шапок. */
const mountedIn = new Map<string, string[]>()
for (const rf of routeFiles) {
  const route = routeOf(rf)
  const seen = new Set<string>()
  for (const entry of entryPointsOf(rf)) {
    for (const f of reachableFrom(entry)) seen.add(f)
  }
  for (const f of seen) {
    const list = mountedIn.get(f) ?? []
    list.push(route)
    mountedIn.set(f, list)
  }
}
for (const list of mountedIn.values()) list.sort()

function zoneOf(file: string): Zone {
  if (file.startsWith(KIT_ROOT + "/")) return "kit"
  if (file.startsWith(PAGES_ROOT + "/") || file === "app/layout.tsx") return "page"
  return (mountedIn.get(file)?.length ?? 0) > 0 ? "cabinet-component" : "landing-component"
}

/**
 * Корневой layout приложения сканируется вместе с кабинетом: именно он рисует
 * фон под всеми экранами (`bg-[#0a0a0a]` на html и body) и монтирует
 * ParticlesBackground, то есть физически входит в кадр кабинета.
 */
const ROOT_LAYOUT = "app/layout.tsx"
const scannedFiles = [...(existsSync(ROOT_LAYOUT) ? [ROOT_LAYOUT] : []), ...pageFiles, ...nonKitComponentFiles, ...kitFiles]

// ---------------------------------------------------------------------------
// 2. Разбор JSX: классы, инлайн-стили, атрибуты
// ---------------------------------------------------------------------------

export type ElementRecord = {
  file: string
  line: number
  zone: Zone
  tag: string
  kind: string
  classes: string[]
  classText: string
  attrs: Record<string, string>
  attrNames: string[]
  styles: { prop: string; value: string }[]
}

/** Токен класса: без интерполяций и без обрубков вокруг `${…}`. */
const CLASS_TOKEN = /^[A-Za-z0-9@!:/\[\]&>._%(),'"+*=~|?^$#\\-]+$/

function pushTokens(text: string, cleanStart: boolean, cleanEnd: boolean, out: string[]) {
  const parts = text.split(/\s+/)
  const startsClean = cleanStart || /^\s/.test(text)
  const endsClean = cleanEnd || /\s$/.test(text)
  parts.forEach((p, i) => {
    if (!p) return
    if (i === 0 && !startsClean) return
    if (i === parts.length - 1 && !endsClean) return
    if (!CLASS_TOKEN.test(p)) return
    out.push(p)
  })
}

function collectClassTokens(node: ts.Node, out: string[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    pushTokens(node.text, true, true, out)
    return
  }
  if (ts.isTemplateExpression(node)) {
    pushTokens(node.head.text, true, false, out)
    node.templateSpans.forEach((span, i) => {
      collectClassTokens(span.expression, out)
      pushTokens(span.literal.text, false, i === node.templateSpans.length - 1, out)
    })
    return
  }
  ts.forEachChild(node, (c) => collectClassTokens(c, out))
}

const KIND_BY_COMPONENT: Record<string, string> = {
  Button: "кнопка",
  ToolbarButton: "кнопка",
  ActionMenu: "кнопка",
  SectionHeaderLink: "ссылка",
  ActionMenuItem: "пункт меню",
  DropdownMenuItem: "пункт меню",
  SelectItem: "пункт меню",
  CommandItem: "пункт меню",
  Card: "карточка",
  CardHeader: "карточка",
  CardContent: "карточка",
  CardFooter: "карточка",
  StatCard: "карточка",
  Input: "поле",
  Textarea: "поле",
  SearchInput: "поле",
  SelectTrigger: "поле",
  FormField: "поле",
  DatePicker: "поле",
  FileInput: "поле",
  Checkbox: "поле",
  Switch: "поле",
  Label: "подпись",
  Badge: "бейдж",
  StatusBadge: "бейдж",
  ReleaseStatusBadge: "бейдж",
  PlatformBadge: "бейдж",
  FilterChip: "чип",
  SegmentedControl: "переключатель",
  DialogContent: "оверлей",
  SheetContent: "оверлей",
  PopoverContent: "оверлей",
  DropdownMenuContent: "оверлей",
  TooltipContent: "оверлей",
  SelectContent: "оверлей",
  DialogOverlay: "оверлей",
  SheetOverlay: "оверлей",
  Table: "таблица",
  DataTable: "таблица",
  DataTableRow: "таблица",
  DataTableCell: "таблица",
  DataTableHeadCell: "таблица",
  DataTableResponsive: "таблица",
  TableCell: "таблица",
  TableRow: "таблица",
  Skeleton: "скелетон",
  SkeletonLine: "скелетон",
  SkeletonRows: "скелетон",
  SkeletonValue: "скелетон",
  SkeletonChart: "скелетон",
  SkeletonStatCard: "скелетон",
  Spinner: "загрузка",
  EmptyState: "пустое состояние",
  Banner: "баннер",
  Alert: "баннер",
  SectionHeader: "заголовок секции",
  PageHeader: "шапка страницы",
  Progress: "прогресс",
  Pagination: "пагинация",
  Toolbar: "тулбар",
  Image: "изображение",
  PlaylistCoverImage: "изображение",
  ChartTooltipPanel: "тултип графика",
}

const KIND_BY_TAG: Record<string, string> = {
  button: "кнопка (raw)",
  a: "ссылка",
  Link: "ссылка",
  input: "поле (raw)",
  select: "поле (raw)",
  textarea: "поле (raw)",
  table: "таблица (raw)",
  thead: "таблица",
  tbody: "таблица",
  tr: "таблица",
  th: "таблица",
  td: "таблица",
  img: "изображение",
  svg: "иконка",
  h1: "заголовок",
  h2: "заголовок",
  h3: "заголовок",
  h4: "заголовок",
  p: "текст",
  span: "текст",
  strong: "текст",
  small: "текст",
  ul: "список",
  ol: "список",
  li: "список",
  form: "форма",
  label: "подпись",
  header: "блок",
  footer: "блок",
  section: "блок",
  main: "блок",
  nav: "блок",
  aside: "блок",
  div: "блок",
}

function kindOf(tag: string, classes: string[]): string {
  if (KIND_BY_COMPONENT[tag]) return KIND_BY_COMPONENT[tag]
  if (classes.includes("card-glass") || classes.includes("stat-card-glass")) return "карточка"
  if (classes.includes("glass-panel")) return "панель"
  if (KIND_BY_TAG[tag]) return KIND_BY_TAG[tag]
  return /^[A-Z]/.test(tag) ? "компонент" : "блок"
}

/** Атрибуты, значения которых нужны карте (варианты, размеры, роли). */
const INTERESTING_ATTRS = new Set([
  "variant",
  "size",
  "kind",
  "side",
  "density",
  "asChild",
  "disabled",
  "type",
  "tone",
  "status",
])

function attrLiteral(a: ts.JsxAttribute): string {
  const init = a.initializer
  if (!init) return "true"
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
    if (e.kind === ts.SyntaxKind.TrueKeyword) return "true"
    if (e.kind === ts.SyntaxKind.FalseKeyword) return "false"
    return "{выражение}"
  }
  return "{выражение}"
}

/** Литеральные значения инлайн-стиля: `style={{ color: "#fff" }}`. */
function collectStyles(a: ts.JsxAttribute): { prop: string; value: string }[] {
  const init = a.initializer
  if (!init || !ts.isJsxExpression(init) || !init.expression) return []
  const out: { prop: string; value: string }[] = []
  const visit = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p)) continue
        const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : p.name.getText()
        const v = p.initializer
        let value: string
        if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) value = v.text
        else value = v.getText().replace(/\s+/g, " ").slice(0, 80)
        out.push({ prop: key, value })
      }
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(init.expression)
  return out
}

const elements: ElementRecord[] = []
/** Все JSX-узлы по файлам — нужны секциям, которым важна структура, а не класс. */
const jsxByFile = new Map<string, ts.JsxOpeningLikeElement[]>()

for (const file of scannedFiles) {
  if (!file.endsWith(".tsx")) continue
  const sf = sourceOf(file)
  const zone = zoneOf(file)
  const nodes: ts.JsxOpeningLikeElement[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      nodes.push(n)
      const tag = n.tagName.getText()
      const classes: string[] = []
      const attrs: Record<string, string> = {}
      const attrNames: string[] = []
      const styles: { prop: string; value: string }[] = []
      for (const a of n.attributes.properties) {
        if (!ts.isJsxAttribute(a)) continue
        const name = a.name.getText()
        attrNames.push(name)
        if (name === "className" && a.initializer) collectClassTokens(a.initializer, classes)
        else if (name === "style") styles.push(...collectStyles(a))
        else if (INTERESTING_ATTRS.has(name)) attrs[name] = attrLiteral(a)
      }
      elements.push({
        file,
        line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        zone,
        tag,
        kind: kindOf(tag, classes),
        classes,
        classText: classes.join(" "),
        attrs,
        attrNames,
        styles,
      })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  jsxByFile.set(file, nodes)
}

// ---------------------------------------------------------------------------
// 3. Агрегация классов
// ---------------------------------------------------------------------------

export type Sample = { file: string; line: number; zone: Zone; tag: string; kind: string; classText: string }
export type Counted = { name: string; count: number }
export type ClassEntry = {
  name: string
  count: number
  byZone: Partial<Record<Zone, number>>
  kinds: Counted[]
  tags: Counted[]
  samples: Sample[]
  /** Сколько вхождений не поместилось в samples. */
  more: number
}

const SAMPLE_CAP = 12

function toSample(e: ElementRecord): Sample {
  return { file: e.file, line: e.line, zone: e.zone, tag: e.tag, kind: e.kind, classText: e.classText }
}

function countBy<T>(items: T[], key: (t: T) => string): Counted[] {
  const m = new Map<string, number>()
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1)
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * Собрать записи по классам, отобранным предикатом.
 * `scope` по умолчанию — кабинет (страницы + их компоненты): кит и лендинг
 * считаются отдельно, иначе частоты перестают отвечать на вопрос «сколько
 * вариантов реально живёт на экранах».
 */
function classEntries(
  match: (cls: string) => boolean,
  opts: { zones?: Zone[]; cap?: number; lean?: boolean } = {}
): ClassEntry[] {
  const zones = opts.zones ?? ["page", "cabinet-component"]
  const cap = opts.cap ?? SAMPLE_CAP
  // `lean` выбрасывает из образцов полную строку классов: для утилит вроде
  // `text-gray-400` образец — сам класс, а соседние классы элемента только
  // раздувают JSON.
  const sample = (e: ElementRecord): Sample => (opts.lean ? { ...toSample(e), classText: "" } : toSample(e))
  const buckets = new Map<string, ElementRecord[]>()
  for (const e of elements) {
    if (!zones.includes(e.zone)) continue
    const seen = new Set<string>()
    for (const c of e.classes) {
      if (!match(c) || seen.has(c)) continue
      seen.add(c)
      const list = buckets.get(c) ?? []
      list.push(e)
      buckets.set(c, list)
    }
  }
  return [...buckets.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      byZone: countBy(list, (e) => e.zone).reduce<Partial<Record<Zone, number>>>((acc, c) => {
        acc[c.name as Zone] = c.count
        return acc
      }, {}),
      kinds: countBy(list, (e) => e.kind),
      tags: countBy(list, (e) => e.tag),
      samples: list.slice(0, cap).map(sample),
      more: Math.max(0, list.length - cap),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Комбинации классов одного семейства на одном элементе («p-6 md:p-8»). */
function comboEntries(
  match: (cls: string) => boolean,
  opts: { zones?: Zone[]; filter?: (e: ElementRecord) => boolean; cap?: number } = {}
): ClassEntry[] {
  const zones = opts.zones ?? ["page", "cabinet-component"]
  const cap = opts.cap ?? SAMPLE_CAP
  const buckets = new Map<string, ElementRecord[]>()
  for (const e of elements) {
    if (!zones.includes(e.zone)) continue
    if (opts.filter && !opts.filter(e)) continue
    const combo = e.classes.filter(match)
    if (combo.length === 0) continue
    const key = [...new Set(combo)].join(" ")
    const list = buckets.get(key) ?? []
    list.push(e)
    buckets.set(key, list)
  }
  return [...buckets.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      byZone: countBy(list, (e) => e.zone).reduce<Partial<Record<Zone, number>>>((acc, c) => {
        acc[c.name as Zone] = c.count
        return acc
      }, {}),
      kinds: countBy(list, (e) => e.kind),
      tags: countBy(list, (e) => e.tag),
      samples: list.slice(0, cap).map(toSample),
      more: Math.max(0, list.length - cap),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

const stripVariants = (cls: string) => cls.replace(/^(?:[-\w[\]().:%/#]+?:)+/, "").replace(/^!/, "")
const base = (cls: string) => stripVariants(cls)

// ---------------------------------------------------------------------------
// 4. CSS: токены и правила
// ---------------------------------------------------------------------------

export type CssRule = { selector: string; body: string; file: string; line: number }

function parseCssRules(file: string): CssRule[] {
  if (!existsSync(file)) return []
  const raw = readFileSync(file, "utf8")
  // Комментарии гасим пробелами, чтобы не съехали номера строк.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  const lineOf = (pos: number) => src.slice(0, pos).split("\n").length
  const rules: CssRule[] = []
  const stack: { selector: string; bodyStart: number; line: number }[] = []
  let chunkStart = 0
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === "{") {
      const selector = src.slice(chunkStart, i).trim().replace(/\s+/g, " ")
      stack.push({ selector, bodyStart: i + 1, line: lineOf(chunkStart + (src.slice(chunkStart).match(/^\s*/)?.[0].length ?? 0)) })
      chunkStart = i + 1
    } else if (ch === "}") {
      const open = stack.pop()
      if (open) {
        const body = src.slice(open.bodyStart, i)
        // Вложенные правила уже записаны сами; у @-правил тела не пишем.
        if (!open.selector.startsWith("@")) {
          const prefix = stack.filter((s) => s.selector.startsWith("@")).map((s) => s.selector).join(" ")
          rules.push({
            selector: prefix ? `${prefix} { ${open.selector}` : open.selector,
            body: body.replace(/\{[\s\S]*?\}/g, "").trim(),
            file,
            line: open.line,
          })
        }
      }
      chunkStart = i + 1
    } else if (ch === ";" && stack.length === 0) {
      chunkStart = i + 1
    }
  }
  return rules
}

export type CssVar = {
  name: string
  value: string
  file: string
  line: number
  comment: string | null
  /** rgb()/hsl() для образца, если значение похоже на цвет. */
  swatch: string | null
  utilities: string[]
  usage: number
  usageDetail?: { viaUtilities: number; viaVar: number }
}

/** `20 20 20` → rgb(20 20 20); `0 0% 4%` → hsl(0 0% 4%); `#fff` → как есть. */
function swatchOf(name: string, value: string): string | null {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^(rgb|hsl)a?\(/.test(v)) return v
  if (/^var\(--[\w-]+\)$/.test(v)) return v.replace(/^var\((--[\w-]+)\)$/, "rgb(var($1))")
  if (/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(v)) return `rgb(${v})`
  if (/^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(v)) return `hsl(${v})`
  return null
}

function parseCssVars(file: string, selector: string): Omit<CssVar, "utilities" | "usage">[] {
  if (!existsSync(file)) return []
  const raw = readFileSync(file, "utf8")
  const out: Omit<CssVar, "utilities" | "usage">[] = []
  // Блок нужного селектора (первый) — дальше идём по объявлениям построчно.
  const blockRe = new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m")
  const m = blockRe.exec(raw)
  if (!m) return []
  let depth = 0
  let i = raw.indexOf("{", m.index)
  const start = i + 1
  for (; i < raw.length; i++) {
    if (raw[i] === "{") depth++
    else if (raw[i] === "}") {
      depth--
      if (depth === 0) break
    }
  }
  const block = raw.slice(start, i)
  const blockLineOffset = raw.slice(0, start).split("\n").length
  const lines = block.split("\n")
  let pendingComment: string[] = []
  let inComment = false
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (inComment) {
      pendingComment.push(trimmed.replace(/^\*+\s?/, "").replace(/\*\/\s*$/, ""))
      if (trimmed.includes("*/")) inComment = false
      return
    }
    if (trimmed.startsWith("/*")) {
      pendingComment = [trimmed.replace(/^\/\*+\s?/, "").replace(/\*\/\s*$/, "")]
      if (!trimmed.includes("*/")) inComment = true
      return
    }
    const decl = /^(--[\w-]+)\s*:\s*([^;]+);/.exec(trimmed)
    if (decl) {
      const comment = pendingComment.filter(Boolean).join(" ").trim()
      out.push({
        name: decl[1],
        value: decl[2].trim(),
        file,
        line: blockLineOffset + idx - 1,
        comment: comment || null,
        swatch: swatchOf(decl[1], decl[2].trim()),
      })
      pendingComment = []
      return
    }
    if (trimmed === "") return
    pendingComment = []
  })
  return out
}

// ---------------------------------------------------------------------------
// 5. Сторожа
// ---------------------------------------------------------------------------

/**
 * Что в проекте уже канонизировано и чем это охраняется. Список ручной — но
 * каждый пункт проверяется на месте: `covers` считается по тем же файлам, что
 * и остальная карта, поэтому «охраняется» здесь означает «сторож реально видит
 * эти файлы», а не «где-то есть тест».
 */
export type Guard = {
  id: string
  title: string
  command: string
  source: string
  /** Человеческое описание охраняемого правила. */
  rule: string
  /** Файлы под охраной — glob словами. */
  scope: string
  /** Подробный список, если скоуп — перечисление (страницы e2e-спеки). */
  scopeDetail?: string[]
  filesCovered: number
  filesOutside: number
}

const eslintCovered = (f: string) => f.startsWith("app/dashboard/")
const shellCovered = (f: string) =>
  f.startsWith("app/dashboard/") &&
  (f.endsWith("/page.tsx") || f.endsWith("/loading.tsx") || f.endsWith("-client.tsx"))

const cabinetFiles = scannedFiles.filter((f) => zoneOf(f) === "page" || zoneOf(f) === "cabinet-component")

const GUARDS: Guard[] = [
  {
    id: "eslint-raw",
    title: "ESLint: raw-элементы вместо кита",
    command: "pnpm lint",
    source: ".eslintrc.json",
    rule: "raw <button>, <input>, <select>, <table> запрещены — только components/ui",
    scope: "app/dashboard/**",
    filesCovered: cabinetFiles.filter(eslintCovered).length,
    filesOutside: cabinetFiles.filter((f) => !eslintCovered(f)).length,
  },
  {
    id: "eslint-color",
    title: "ESLint: arbitrary-цвета и инлайн-цвет",
    command: "pnpm lint",
    source: ".eslintrc.json",
    rule: "bg-[#…] / text-[#…] / border-[#…] в className и style={{ color|background|borderColor|fill|stroke }} запрещены",
    scope: "app/dashboard/**",
    filesCovered: cabinetFiles.filter(eslintCovered).length,
    filesOutside: cabinetFiles.filter((f) => !eslintCovered(f)).length,
  },
  {
    id: "page-shell",
    title: "Рамка страницы (C-01)",
    command: "pnpm check:page-shell",
    source: "scripts/check-page-shell.ts",
    rule: "на корне страницы нет max-w-*, mx-auto, p-*, px-*, pb-* — ширину и поля даёт DashboardShell",
    scope: "app/dashboard/**/{page,loading}.tsx, *-client.tsx, components/artist-reports.tsx",
    filesCovered: cabinetFiles.filter((f) => shellCovered(f) || f === "components/artist-reports.tsx").length,
    filesOutside: cabinetFiles.filter((f) => !(shellCovered(f) || f === "components/artist-reports.tsx")).length,
  },
  {
    id: "page-header-canon",
    title: "Канон шапки (e2e, @smoke)",
    command: "pnpm test:e2e -- page-header-canon",
    source: "tests/e2e/page-header-canon.spec.ts",
    rule: "кегль H1, левая координата H1 и padding-bottom шапки совпадают на всех замеренных экранах",
    scope: "9 экранов из списка внутри спеки",
    filesCovered: 0,
    filesOutside: 0,
  },
  {
    id: "cn-merge",
    title: "cn() не съедает классы (B-11)",
    command: "pnpm test",
    source: "components/ui/cn-merge.test.ts",
    rule: "twMerge не выбрасывает text-balance и прочие утилиты переноса из строки заголовка",
    scope: "components/ui/page-header.tsx",
    filesCovered: 1,
    filesOutside: 0,
  },
]

/** Сколько экранов реально замеряет e2e-канон шапки — читаем из самой спеки. */
{
  const spec = "tests/e2e/page-header-canon.spec.ts"
  if (existsSync(spec)) {
    const text = readFileSync(spec, "utf8")
    const paths = [...text.matchAll(/path:\s*[`"']([^`"']+)[`"']/g)].map((m) => m[1])
    const g = GUARDS.find((x) => x.id === "page-header-canon")
    if (g) {
      g.filesCovered = paths.length
      g.filesOutside = Math.max(0, routes.length - paths.length)
      g.scope = `${paths.length} экранов из ${routes.length} — список зашит в спеке`
      g.scopeDetail = paths
    }
  }
}

export type GuardRef = {
  status: "canon" | "partial" | "none"
  /** id сторожей из GUARDS. */
  guards: string[]
  note: string
}

const canon = (note: string, ...guards: string[]): GuardRef => ({ status: "canon", guards, note })
const partial = (note: string, ...guards: string[]): GuardRef => ({ status: "partial", guards, note })
const none = (note: string): GuardRef => ({ status: "none", guards: [], note })

// ---------------------------------------------------------------------------
// 6. tailwind.config.js
// ---------------------------------------------------------------------------

const twSource = readFileSync("tailwind.config.js", "utf8")
function twLine(needle: string): number {
  const idx = twSource.indexOf(needle)
  return idx < 0 ? 1 : twSource.slice(0, idx).split("\n").length
}

const require_ = createRequire(join(ROOT, "package.json"))
const twConfig = require_(join(ROOT, "tailwind.config.js")) as {
  theme: { extend: { colors: Record<string, unknown>; borderRadius: Record<string, string>; fontFamily: Record<string, string[]> } }
}
const twColors = twConfig.theme.extend.colors
const twRadius = twConfig.theme.extend.borderRadius
const twFonts = twConfig.theme.extend.fontFamily

/** Плоский список утилит цвета: `surface.raised` → `surface-raised`. */
function flatColorNames(obj: Record<string, unknown>, prefix = ""): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = []
  for (const [k, v] of Object.entries(obj)) {
    const name = k === "DEFAULT" ? prefix : prefix ? `${prefix}-${k}` : k
    if (typeof v === "string") out.push({ name, value: v })
    else if (v && typeof v === "object") out.push(...flatColorNames(v as Record<string, unknown>, name))
  }
  return out
}
const twColorUtilities = flatColorNames(twColors)

// ---------------------------------------------------------------------------
// 7. Вспомогательное для секций
// ---------------------------------------------------------------------------

const COLOR_PREFIX = /^(bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|divide|placeholder|caret|accent|decoration)-/
const PALETTE =
  /^(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?(\/.+)?$/
const THEME_COLOR = /^(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(-foreground)?(\/.+)?$/
const TOKEN_COLOR = /^(surface|brand|status)(-[\w-]+)?(\/.+)?$/

type ColorFamily = "token" | "theme" | "palette" | "arbitrary" | "special" | "other"

function colorFamily(cls: string): ColorFamily | null {
  const b = base(cls)
  const m = COLOR_PREFIX.exec(b)
  if (!m) return null
  const rest = b.slice(m[0].length)
  if (!rest) return "special"
  if (rest.startsWith("[")) return "arbitrary"
  if (TOKEN_COLOR.test(rest)) return "token"
  if (THEME_COLOR.test(rest)) return "theme"
  if (PALETTE.test(rest)) return "palette"
  if (/^(transparent|current|inherit|none|auto)(\/.+)?$/.test(rest)) return "special"
  return "other"
}

/** Сколько раз утилита цвета встречается в кабинете (с любыми вариантами и прозрачностью). */
function utilityUsage(util: string): number {
  const re = new RegExp(`^(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|divide|placeholder|caret|accent|decoration)-${util.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\/.+)?$`)
  let n = 0
  for (const e of elements) {
    if (e.zone === "landing-component") continue
    for (const c of e.classes) if (re.test(base(c))) n++
  }
  return n
}

/** Сырые текстовые вхождения — для цветов, которые живут не в className. */
function rawMatches(
  files: string[],
  pattern: RegExp,
  opts: { skipComments?: boolean } = {}
): { file: string; line: number; value: string; context: string }[] {
  const re = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + "g")
  const out: { file: string; line: number; value: string; context: string }[] = []
  for (const file of files) {
    if (!existsSync(file)) continue
    const lines = readFileSync(file, "utf8").split("\n")
    let inBlockComment = false
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      const wasInBlock = inBlockComment
      if (inBlockComment && trimmed.includes("*/")) inBlockComment = false
      else if (!inBlockComment && /\/\*/.test(line) && !/\*\//.test(line)) inBlockComment = true
      if (opts.skipComments) {
        // Хекс внутри пояснения — не цвет в разметке, а рассказ о нём.
        if (wasInBlock || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return
      }
      for (const m of line.matchAll(re)) {
        if (opts.skipComments) {
          const before = line.slice(0, m.index ?? 0)
          if (before.includes("//") || before.includes("/*")) continue
        }
        out.push({ file, line: i + 1, value: m[0], context: trimmed.slice(0, 160) })
      }
    })
  }
  return out
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
const RGBA_RE = /rgba?\([^)]*\)|hsla?\([^)]*\)/g

/** Приблизительная светлота: нужна, чтобы отделить «тёмные фоны» от акцентов. */
function luminance(color: string): number | null {
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim())
  let r: number, g: number, b: number
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1]
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else {
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(color.trim())
    if (!rgb) return null
    r = +rgb[1]
    g = +rgb[2]
    b = +rgb[3]
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const dashboardCssRules = parseCssRules("app/dashboard/dashboard.css")
const globalCssRules = parseCssRules("app/globals.css")

/** Классы из CSS-файлов, которые реально используются в кабинете. */
const usedCssClasses = (() => {
  const used = new Set<string>()
  for (const e of elements) {
    if (e.zone === "landing-component") continue
    for (const c of e.classes) if (/^[a-z][a-z0-9-]*$/.test(c)) used.add(c)
  }
  return used
})()

function cssRulesForClass(cls: string): CssRule[] {
  return [...dashboardCssRules, ...globalCssRules].filter((r) => new RegExp(`\\.${cls}(?![\\w-])`).test(r.selector))
}

/** Корень страницы — тот же разбор, что у сторожа рамки (scripts/check-page-shell.ts). */
function defaultExportedFunction(src: ts.SourceFile): ts.Node | null {
  let found: ts.Node | null = null
  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st) && st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) found = st
    else if (ts.isExportAssignment(st) && !st.isExportEquals) {
      const e = st.expression
      if (ts.isIdentifier(e)) {
        for (const s2 of src.statements) {
          if (ts.isFunctionDeclaration(s2) && s2.name?.text === e.text) found = s2
          if (ts.isVariableStatement(s2)) {
            for (const d of s2.declarationList.declarations) {
              if (ts.isIdentifier(d.name) && d.name.text === e.text && d.initializer) found = d.initializer
            }
          }
        }
      } else if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) found = e
    }
  }
  return found
}

function isFunctionLike(n: ts.Node): boolean {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
}

function pageRoots(component: ts.Node): ts.JsxOpeningLikeElement[] {
  const roots: ts.JsxOpeningLikeElement[] = []
  const pushRoot = (e: ts.Node) => {
    if (ts.isJsxElement(e)) roots.push(e.openingElement)
    else if (ts.isJsxSelfClosingElement(e)) roots.push(e)
    else if (ts.isJsxFragment(e)) {
      for (const c of e.children) {
        if (ts.isJsxElement(c) && /^[a-z]/.test(c.openingElement.tagName.getText())) roots.push(c.openingElement)
      }
    }
  }
  const visit = (n: ts.Node) => {
    if (n !== component && isFunctionLike(n)) return
    if (ts.isReturnStatement(n) && n.expression) {
      let e: ts.Node = n.expression
      while (ts.isParenthesizedExpression(e)) e = e.expression
      pushRoot(e)
    }
    ts.forEachChild(n, visit)
  }
  const body = (component as ts.FunctionLikeDeclaration).body
  if (body && !ts.isBlock(body)) {
    let e: ts.Node = body
    while (ts.isParenthesizedExpression(e)) e = e.expression
    pushRoot(e)
  } else ts.forEachChild(component, visit)
  return roots
}

/** Первые JSX-элементы внутри выражения: слот `actions` шапки и подобные. */
function topLevelJsx(node: ts.Node, depth = 0): { el: ts.JsxOpeningLikeElement; conditional: boolean }[] {
  if (depth > 6) return []
  const out: { el: ts.JsxOpeningLikeElement; conditional: boolean }[] = []
  const walkNode = (n: ts.Node, conditional: boolean): void => {
    if (ts.isParenthesizedExpression(n)) return walkNode(n.expression, conditional)
    if (ts.isJsxExpression(n)) {
      if (n.expression) walkNode(n.expression, conditional)
      return
    }
    if (ts.isJsxElement(n)) {
      out.push({ el: n.openingElement, conditional })
      return
    }
    if (ts.isJsxSelfClosingElement(n)) {
      out.push({ el: n, conditional })
      return
    }
    if (ts.isJsxFragment(n)) {
      for (const c of n.children) {
        if (ts.isJsxText(c) && !c.text.trim()) continue
        walkNode(c, conditional)
      }
      return
    }
    if (ts.isConditionalExpression(n)) {
      walkNode(n.whenTrue, true)
      walkNode(n.whenFalse, true)
      return
    }
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      walkNode(n.right, true)
      return
    }
    ts.forEachChild(n, (c) => walkNode(c, conditional))
  }
  walkNode(node, false)
  return out
}

function jsxText(el: ts.JsxOpeningLikeElement): string {
  const parent = el.parent
  if (!parent || !ts.isJsxElement(parent)) return ""
  const parts: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const t = n.text.trim()
      if (t) parts.push(t)
    }
    ts.forEachChild(n, visit)
  }
  parent.children.forEach(visit)
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 60)
}

function attrsOf(el: ts.JsxOpeningLikeElement): Map<string, ts.JsxAttribute> {
  const m = new Map<string, ts.JsxAttribute>()
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a)) m.set(a.name.getText(), a)
  }
  return m
}

function attrText(a: ts.JsxAttribute | undefined): string | null {
  if (!a) return null
  const init = a.initializer
  if (!init) return "true"
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
    return "{выражение}"
  }
  return "{выражение}"
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 1. Токены
// ---------------------------------------------------------------------------

/** Прямые обращения `var(--token)` — в CSS кабинета и в коде. */
const varReferenceFiles = [
  "app/dashboard/dashboard.css",
  "app/globals.css",
  ...scannedFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")),
]

function varReferences(name: string): number {
  return rawMatches(varReferenceFiles, new RegExp(`var\\(${name}\\b`, "g"), { skipComments: true }).length
}

function withUtilities(vars: Omit<CssVar, "utilities" | "usage">[]): CssVar[] {
  return vars.map((v) => {
    const utilities = twColorUtilities.filter((u) => u.value.includes(`var(${v.name})`)).map((u) => u.name)
    const viaUtilities = utilities.reduce((n, u) => n + utilityUsage(u), 0)
    const viaVar = varReferences(v.name)
    return { ...v, utilities, usage: viaUtilities + viaVar, usageDetail: { viaUtilities, viaVar } }
  })
}

const tokenVars = withUtilities(parseCssVars("app/tokens.css", ":root"))
const themeVars = withUtilities(parseCssVars("app/dashboard/dashboard.css", ":root"))

function groupTokens(vars: CssVar[]) {
  const groups: { id: string; title: string; note: string; vars: CssVar[] }[] = [
    { id: "surface", title: "Поверхности", note: "Тёмные фоны кабинета. Значения равны тем, что были захардкожены до этапа 2.1.", vars: [] },
    { id: "brand", title: "Акценты", note: "`brand` (#10b981) и `primary` (тема shadcn) — намеренно разные зелёные.", vars: [] },
    { id: "status", title: "Статусы", note: "Семантика зафиксирована, значения не сводились «на глаз».", vars: [] },
    { id: "other", title: "Прочее", note: "", vars: [] },
  ]
  for (const v of vars) {
    if (v.name.startsWith("--surface")) groups[0].vars.push(v)
    else if (v.name.startsWith("--brand")) groups[1].vars.push(v)
    else if (v.name.startsWith("--status")) groups[2].vars.push(v)
    else groups[3].vars.push(v)
  }
  return groups.filter((g) => g.vars.length > 0)
}

const radiusUtilities = Object.entries(twRadius).map(([k, value]) => {
  const util = k === "DEFAULT" ? "rounded" : `rounded-${k}`
  const count = elements
    .filter((e) => e.zone !== "landing-component" && e.zone !== "kit")
    .reduce((n, e) => n + e.classes.filter((c) => base(c) === util).length, 0)
  return { name: util, value, usage: count }
})

const sectionTokens = {
  guard: partial(
    "Значения канонизированы (app/tokens.css + tailwind.config.js) и подстановка мимо них ловится ESLint — но только в app/dashboard/**; components/** вне охраны.",
    "eslint-color"
  ),
  cssVariables: {
    file: "app/tokens.css",
    groups: groupTokens(tokenVars),
  },
  themeVariables: {
    file: "app/dashboard/dashboard.css",
    note: "Переменные темы shadcn. Тёмный вид кабинета делают именно они: их читают bg-background / bg-card / bg-popover в ките.",
    vars: themeVars,
  },
  radius: {
    file: "tailwind.config.js",
    line: twLine("borderRadius"),
    values: radiusUtilities,
    note: "Шкала объявлена целиком. Правила «какой элемент — какой радиус» в проекте нет: см. секцию «Скругления».",
  },
  typography: {
    fonts: Object.entries(twFonts).map(([name, stack]) => ({ name: `font-${name}`, stack: (stack as string[]).join(", ") })),
    sizes: classEntries((c) => /^text-(xs|sm|base|lg|xl|\d?xl|\[)/.test(base(c)), { cap: 5, lean: true }),
    weights: classEntries((c) => /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(base(c)), { cap: 5, lean: true }),
    tracking: classEntries((c) => /^tracking-/.test(base(c)), { cap: 5, lean: true }),
    textColors: classEntries((c) => /^text-/.test(base(c)) && colorFamily(c) !== null, { cap: 5, lean: true }),
  },
  spacing: {
    padding: classEntries((c) => /^p[xytrbl]?-/.test(base(c)), { cap: 5, lean: true }),
    gap: classEntries((c) => /^gap(-[xy])?-/.test(base(c)), { cap: 5, lean: true }),
    space: classEntries((c) => /^space-[xy]-/.test(base(c)), { cap: 5, lean: true }),
    margin: classEntries((c) => /^-?m[xytrbl]?-/.test(base(c)), { cap: 5, lean: true }),
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 2. Поверхности и фоны
// ---------------------------------------------------------------------------

const bgEntries = (family: ColorFamily) =>
  classEntries((c) => /^bg-/.test(base(c)) && colorFamily(c) === family)

const CSS_SURFACE_CLASSES = [
  "card-glass",
  "stat-card-glass",
  "glass-panel",
  "platform-badge",
  "grid-bg",
  "noise-overlay",
  "releases-grid",
  "scroll-container",
  "dashboard-theme",
]

const cssSurfaces = CSS_SURFACE_CLASSES.filter((c) => usedCssClasses.has(c) || c === "dashboard-theme").map((cls) => {
  const uses = elements.filter((e) => e.zone !== "landing-component" && e.classes.includes(cls))
  return {
    name: cls,
    count: uses.length,
    rules: cssRulesForClass(cls),
    samples: uses.slice(0, SAMPLE_CAP).map(toSample),
    more: Math.max(0, uses.length - SAMPLE_CAP),
  }
})

/** Все цветовые литералы вне tokens.css: и в классах, и в стилях, и в CSS. */
const hardcodedColorSources = [
  ...scannedFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")),
  "app/dashboard/dashboard.css",
]

const hardcodedRaw = [
  ...rawMatches(hardcodedColorSources, HEX_RE, { skipComments: true }),
  ...rawMatches(hardcodedColorSources, RGBA_RE, { skipComments: true }),
]
  .filter((m) => !/^#\d+$/.test(m.value))
  // `rgb(var(--brand) / 0.3)` — это токен, а не литерал: regexp обрывается на
  // первой скобке и ловит его как «жёсткое значение».
  .filter((m) => !m.value.includes("var("))

const hardcodedColors = (() => {
  const buckets = new Map<string, typeof hardcodedRaw>()
  for (const m of hardcodedRaw) {
    const key = m.value.toLowerCase().replace(/\s+/g, "")
    const list = buckets.get(key) ?? []
    list.push(m)
    buckets.set(key, list)
  }
  return [...buckets.entries()]
    .map(([value, list]) => ({
      value,
      swatch: /^#|^rgba?\(|^hsla?\(/.test(value) ? list[0].value : null,
      luminance: luminance(value),
      count: list.length,
      zones: countBy(list, (m) => zoneOf(m.file)),
      occurrences: list.slice(0, 25).map((m) => ({ ...m, zone: zoneOf(m.file) })),
      more: Math.max(0, list.length - 25),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
})()

/** C-05: фон тёмных оверлеев — сколько разных значений на самом деле. */
const darkSurfaceValues = hardcodedColors.filter((h) => h.luminance !== null && (h.luminance as number) < 0.16)

const sectionSurfaces = {
  guard: partial(
    "Токены-поверхности есть и на экранах кабинета применены; arbitrary-хекс в className ловит ESLint в app/dashboard/**. Но фон конкретного блока правилом не назначен: одна и та же карточка может быть card-glass, bg-surface-raised или bg-white/5 — сторожа на это нет.",
    "eslint-color"
  ),
  families: [
    { id: "token", title: "Через токены кабинета (surface / brand / status)", entries: bgEntries("token") },
    { id: "theme", title: "Через тему shadcn (background / card / popover / muted / accent)", entries: bgEntries("theme") },
    { id: "palette", title: "Прямо из палитры Tailwind (white/black/gray/emerald…)", entries: bgEntries("palette") },
    { id: "arbitrary", title: "Arbitrary-значения мимо токенов", entries: bgEntries("arbitrary") },
    { id: "special", title: "Служебные (transparent / current / none)", entries: bgEntries("special") },
  ],
  gradients: classEntries((c) => /^(bg-gradient-|from-|via-|to-)/.test(base(c))),
  backdrop: classEntries((c) => /^(backdrop-|supports-\[backdrop)/.test(base(c))),
  cssSurfaces,
  hardcoded: {
    note: "Литералы цвета вне app/tokens.css: в классах, в инлайн-стилях, в dashboard.css и внутри кита. tokens.css исключён — там они и должны быть.",
    total: hardcodedRaw.length,
    values: hardcodedColors,
    darkSurfaces: {
      note: "Тёмные значения (относительная светлота < 0.16) — те, что задают фон панелей и подложек мимо токенов.",
      count: darkSurfaceValues.length,
      values: darkSurfaceValues,
    },
  },
  darkInventory: {
    note:
      "C-05 целиком: сколько всего РАЗНЫХ тёмных значений задаёт фон в кабинете — считая и те, что уже стали токенами, и те, что остались литералами. Токен — не то же самое, что канон: пять токенов поверхностей означают пять разных фонов, просто у каждого теперь есть имя.",
    tokens: tokenVars
      .filter((v) => v.name.startsWith("--surface"))
      .map((v) => ({ kind: "токен" as const, name: v.name, value: v.value, swatch: v.swatch, where: `${v.file}:${v.line}`, usage: v.usage, comment: v.comment })),
    themeVars: themeVars
      .filter((v) => ["--background", "--card", "--popover", "--muted", "--accent", "--secondary"].includes(v.name))
      .map((v) => ({ kind: "переменная темы" as const, name: v.name, value: v.value, swatch: v.swatch, where: `${v.file}:${v.line}`, usage: v.usage, comment: v.comment })),
    literals: darkSurfaceValues.map((v) => ({
      kind: "литерал" as const,
      name: v.value,
      value: v.value,
      swatch: v.swatch,
      where: v.occurrences.map((o) => `${o.file}:${o.line}`).slice(0, 6).join(", "),
      usage: v.count,
      comment: null,
    })),
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 3. Скругления
// ---------------------------------------------------------------------------

const radiiEntries = classEntries((c) => /^rounded/.test(base(c)))
const radiiKit = classEntries((c) => /^rounded/.test(base(c)), { zones: ["kit"] })

/** Есть ли логика «тип элемента → радиус»: для каждого типа — все его радиусы. */
const radiusByKind = (() => {
  const m = new Map<string, Map<string, number>>()
  for (const e of elements) {
    if (e.zone === "landing-component" || e.zone === "kit") continue
    const radii = [...new Set(e.classes.filter((c) => /^rounded/.test(base(c))).map(base))]
    if (radii.length === 0) continue
    const inner = m.get(e.kind) ?? new Map<string, number>()
    for (const r of radii) inner.set(r, (inner.get(r) ?? 0) + 1)
    m.set(e.kind, inner)
  }
  return [...m.entries()]
    .map(([kind, inner]) => ({
      kind,
      total: [...inner.values()].reduce((a, b) => a + b, 0),
      radii: [...inner.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total)
})()

const sectionRadii = {
  guard: none(
    `Канона нет. Шкала в tailwind.config.js объявлена, но правила «какой элемент — какой радиус» не существует, и ни один сторож радиусы не проверяет. Фактически в кабинете ${radiiEntries.length} разных написаний.`
  ),
  entries: radiiEntries,
  kit: radiiKit,
  byKind: radiusByKind,
  scale: radiusUtilities,
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 4. Границы и тени
// ---------------------------------------------------------------------------

const sectionBorders = {
  guard: none(
    "Канона нет. `border-white/5` и `border-white/10` соседствуют без правила, толщина и сторона выбираются по месту, тени описаны и утилитой, и arbitrary-строкой."
  ),
  widths: classEntries((c) => /^border(-[xytrbl])?(-\d+)?$/.test(base(c)), { cap: 8, lean: true }),
  colors: {
    token: classEntries((c) => /^border-/.test(base(c)) && colorFamily(c) === "token", { cap: 8, lean: true }),
    theme: classEntries((c) => /^border-/.test(base(c)) && colorFamily(c) === "theme", { cap: 8, lean: true }),
    palette: classEntries((c) => /^border-/.test(base(c)) && colorFamily(c) === "palette", { cap: 8, lean: true }),
    arbitrary: classEntries((c) => /^border-/.test(base(c)) && colorFamily(c) === "arbitrary", { cap: 8, lean: true }),
  },
  styles: classEntries((c) => /^border-(solid|dashed|dotted|double|none)$/.test(base(c)), { cap: 8, lean: true }),
  shadows: classEntries((c) => /^shadow/.test(base(c)), { cap: 8, lean: true }),
  shadowsKit: classEntries((c) => /^shadow/.test(base(c)), { zones: ["kit"], cap: 8, lean: true }),
  divides: classEntries((c) => /^divide-/.test(base(c)), { cap: 8, lean: true }),
  rings: classEntries((c) => /^ring/.test(base(c)), { cap: 5, lean: true }),
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 5. Контейнеры
// ---------------------------------------------------------------------------

const shellElement = (() => {
  const f = "components/dashboard-shell.tsx"
  const el = elements.find((e) => e.file === f && e.classes.includes("max-w-7xl"))
  return el ? { file: el.file, line: el.line, classText: el.classText } : null
})()

const pageRootRows = (() => {
  const rows: { file: string; route: string | null; line: number; classText: string; tag: string; forbidden: string[] }[] = []
  const FORBIDDEN = [/^(?:[a-z0-9]+:)*mx-auto$/, /^(?:[a-z0-9]+:)*!?max-w-\S+$/, /^(?:[a-z0-9]+:)*!?p-\S+$/, /^(?:[a-z0-9]+:)*!?px-\S+$/, /^(?:[a-z0-9]+:)*!?pb-\S+$/]
  const files = [...pageFiles.filter((f) => /(?:page|loading)\.tsx$|-client\.tsx$/.test(f)), "components/artist-reports.tsx"]
  for (const file of files) {
    if (!existsSync(file)) continue
    const sf = sourceOf(file)
    const comp = defaultExportedFunction(sf)
    if (!comp) continue
    for (const root of pageRoots(comp)) {
      const classes: string[] = []
      const attr = attrsOf(root).get("className")
      if (attr?.initializer) collectClassTokens(attr.initializer, classes)
      rows.push({
        file,
        route: file.endsWith("/page.tsx") ? routeOf(file) : (mountedIn.get(file) ?? [])[0] ?? null,
        line: sf.getLineAndCharacterOfPosition(root.getStart()).line + 1,
        tag: root.tagName.getText(),
        classText: classes.join(" "),
        forbidden: classes.filter((c) => FORBIDDEN.some((re) => re.test(c))),
      })
    }
  }
  return rows
})()

const isCardEl = (e: ElementRecord) =>
  e.classes.includes("card-glass") || e.classes.includes("stat-card-glass") || e.tag === "Card" || e.tag === "StatCard"

const sectionContainers = {
  guard: partial(
    "Канонизирован ровно один уровень — рамка страницы: ширину, поля и подвал задаёт DashboardShell, и это стережёт `pnpm check:page-shell` плюс попиксельный e2e. Всё, что внутри рамки — плотность карточек, ритм между блоками, сетки — без канона (B-02, B-06, B-07 бэклога).",
    "page-shell",
    "page-header-canon"
  ),
  shell: {
    element: shellElement,
    note: "Единственный контейнер, который имеет право задавать ширину и поля.",
  },
  pageRoots: {
    note: "Корневой JSX каждой страницы кабинета — то же место, куда смотрит сторож рамки.",
    rows: pageRootRows,
    violations: pageRootRows.filter((r) => r.forbidden.length > 0).length,
    rhythm: countBy(
      pageRootRows.flatMap((r) => r.classText.split(/\s+/).filter((c) => /^space-y-/.test(c))),
      (c) => c
    ),
  },
  cardPadding: {
    note: "Паддинг на элементах-карточках (card-glass / stat-card-glass / Card / StatCard). B-02 бэклога: правила «когда какой» нет.",
    combos: comboEntries((c) => /^p[xytrbl]?-/.test(base(c)), { filter: isCardEl }),
  },
  cardRadius: {
    note: "Скругление тех же карточек — отдельно, чтобы было видно, совпадает ли оно у соседних блоков.",
    combos: comboEntries((c) => /^rounded/.test(base(c)), { filter: isCardEl }),
  },
  verticalRhythm: {
    note: "Ритм между блоками. `space-y-8` на корне — канон; всё остальное задаётся по месту.",
    combos: comboEntries((c) => /^space-y-/.test(base(c))),
  },
  grids: {
    note: "B-07 бэклога: наборы колонок написаны несовпадающими способами, из-за чего на планшете соседние экраны дают разное число колонок.",
    combos: comboEntries((c) => /^(grid-cols-|sm:grid-cols-|md:grid-cols-|lg:grid-cols-|xl:grid-cols-|2xl:grid-cols-)/.test(c), {
      filter: (e) => e.classes.includes("grid"),
    }),
  },
  widths: {
    note: "Ограничители ширины внутри страниц: канон запрещает их только на корне.",
    entries: classEntries((c) => /^(max-w-|w-full|min-w-)/.test(base(c)), { cap: 6, lean: true }),
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 6. Кнопки
// ---------------------------------------------------------------------------

/** Разбор cva из components/ui/button.tsx: база, варианты, размеры. */
function parseCva(file: string) {
  const sf = sourceOf(file)
  let call: ts.CallExpression | null = null
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && n.expression.getText() === "cva" && !call) call = n
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!call) return null
  const args = (call as ts.CallExpression).arguments
  const litText = (n: ts.Node): string => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
    if (ts.isBinaryExpression(n)) return litText(n.left) + litText(n.right)
    return n.getText().replace(/\s+/g, " ")
  }
  const baseClasses = args[0] ? litText(args[0]) : ""
  const config = args[1] && ts.isObjectLiteralExpression(args[1]) ? args[1] : null
  const readGroup = (name: string) => {
    if (!config) return []
    const variants = config.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === "variants") as
      | ts.PropertyAssignment
      | undefined
    if (!variants || !ts.isObjectLiteralExpression(variants.initializer)) return []
    const group = variants.initializer.properties.find(
      (p) => ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, "") === name
    ) as ts.PropertyAssignment | undefined
    if (!group || !ts.isObjectLiteralExpression(group.initializer)) return []
    return group.initializer.properties.flatMap((p) => {
      if (!ts.isPropertyAssignment(p)) return []
      const classes = litText(p.initializer)
      return [
        {
          name: p.name.getText().replace(/['"]/g, ""),
          classes,
          line: sf.getLineAndCharacterOfPosition(p.getStart()).line + 1,
          /**
           * Классы `hover:` без префикса — чтобы витрина могла показать
           * состояние наведения статично, рядом с обычным. Свой Tailwind их
           * не сгенерирует (в исходниках они только с префиксом), поэтому
           * страница держит их литеральный список и сверяется с этим полем.
           */
          hoverPreview: classes
            .split(/\s+/)
            .filter((c) => c.startsWith("hover:"))
            .map((c) => c.slice("hover:".length)),
          disabledPreview: classes
            .split(/\s+/)
            .filter((c) => c.startsWith("disabled:"))
            .map((c) => c.slice("disabled:".length)),
        },
      ]
    })
  }
  const defaults = (() => {
    if (!config) return {}
    const dv = config.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === "defaultVariants") as
      | ts.PropertyAssignment
      | undefined
    if (!dv || !ts.isObjectLiteralExpression(dv.initializer)) return {}
    return Object.fromEntries(
      dv.initializer.properties.flatMap((p) =>
        ts.isPropertyAssignment(p) ? [[p.name.getText(), litText(p.initializer)]] : []
      )
    ) as Record<string, string>
  })()
  return { file, base: baseClasses, variants: readGroup("variant"), sizes: readGroup("size"), defaults }
}

const buttonCva = parseCva("components/ui/button.tsx")

const buttonUsages = elements.filter((e) => e.zone !== "landing-component" && e.zone !== "kit" && e.tag === "Button")
const buttonVariantUsage = countBy(buttonUsages, (e) => e.attrs.variant ?? "default (без пропа)")
const buttonSizeUsage = countBy(buttonUsages, (e) => e.attrs.size ?? "default (без пропа)")

/** Кнопка, собранная мимо кита: raw <button> или ссылка, стилизованная как кнопка. */
const looksLikeButton = (e: ElementRecord) => {
  const cls = e.classes.map(base)
  const hasPad = cls.some((c) => /^px-/.test(c)) && cls.some((c) => /^py-/.test(c) || /^h-\d/.test(c))
  const hasShape = cls.some((c) => /^rounded/.test(c))
  const hasSkin = cls.some((c) => /^bg-/.test(c)) || cls.some((c) => /^border/.test(c))
  return hasPad && hasShape && hasSkin
}

const inCabinet = (e: ElementRecord) => e.zone === "page" || e.zone === "cabinet-component"

const offKitButtons = [
  ...elements
    .filter((e) => inCabinet(e) && e.tag === "button")
    .map((e) => ({ ...toSample(e), why: "raw <button> вместо ui/button", guarded: eslintCovered(e.file) })),
  ...elements
    .filter((e) => inCabinet(e) && (e.tag === "a" || e.tag === "Link") && looksLikeButton(e))
    .map((e) => ({ ...toSample(e), why: "ссылка, стилизованная под кнопку", guarded: false })),
  ...elements
    .filter((e) => inCabinet(e) && (e.tag === "div" || e.tag === "span") && looksLikeButton(e) && e.attrNames.includes("onClick"))
    .map((e) => ({ ...toSample(e), why: "кликабельный div/span с видом кнопки", guarded: false })),
].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

const sectionButtons = {
  guard: partial(
    "Кит канонизирован: варианты и размеры живут в одном cva, а raw <button> в app/dashboard/** запрещён ESLint. Вне app/dashboard/** запрета нет, и ссылка, стилизованная под кнопку, не ловится нигде.",
    "eslint-raw"
  ),
  kit: buttonCva,
  usage: {
    total: buttonUsages.length,
    byVariant: buttonVariantUsage,
    bySize: buttonSizeUsage,
    samplesByVariant: Object.fromEntries(
      buttonVariantUsage.map((v) => [
        v.name,
        buttonUsages
          .filter((e) => (e.attrs.variant ?? "default (без пропа)") === v.name)
          .slice(0, SAMPLE_CAP)
          .map(toSample),
      ])
    ),
  },
  offKit: {
    note: "Кнопки кабинета, собранные мимо кита. Raw <button> запрещён линтером внутри app/dashboard/**; в components/** того же запрета нет, а ссылку, стилизованную под кнопку, не ловит никто.",
    total: offKitButtons.length,
    unguarded: offKitButtons.filter((b) => !b.guarded).length,
    items: offKitButtons,
    outsideCabinet: elements.filter((e) => e.zone === "landing-component" && e.tag === "button").length,
  },
  other: {
    toolbar: parseCva("components/ui/toolbar.tsx"),
    badge: parseCva("components/ui/badge.tsx"),
    banner: parseCva("components/ui/banner.tsx"),
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 7. Оверлеи
// ---------------------------------------------------------------------------

const twPalette = require_("tailwindcss/colors") as Record<string, string | Record<string, string>>
const varMap = new Map<string, CssVar>()
for (const v of [...tokenVars, ...themeVars]) varMap.set(v.name, v)

function hexToRgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`
}

/** Класс цвета → реальное CSS-значение и место, где это значение объявлено. */
export type ResolvedColor = { css: string; via: string; declaredIn: string | null }

function resolveColorClass(cls: string, prefix: string): ResolvedColor | null {
  const b = base(cls)
  if (!b.startsWith(prefix + "-")) return null
  let rest = b.slice(prefix.length + 1)
  let alpha: string | null = null
  const slash = rest.lastIndexOf("/")
  if (slash > 0 && !rest.slice(slash).includes("]")) {
    alpha = rest.slice(slash + 1)
    rest = rest.slice(0, slash)
  }
  if (alpha?.startsWith("[") && alpha.endsWith("]")) alpha = alpha.slice(1, -1)
  const a = alpha ? (alpha.startsWith("0.") || alpha.startsWith(".") ? alpha : String(Number(alpha) / 100)) : null

  if (rest.startsWith("[") && rest.endsWith("]")) {
    const literal = rest.slice(1, -1).replace(/_/g, " ")
    return { css: literal, via: `arbitrary-значение ${b}`, declaredIn: null }
  }
  const util = twColorUtilities.find((u) => u.name === rest)
  if (util) {
    let css = util.value.replace(/<alpha-value>/g, a ?? "1")
    const varRef = /var\((--[\w-]+)\)/.exec(css)
    let declaredIn: string | null = null
    if (varRef) {
      const v = varMap.get(varRef[1])
      if (v) {
        css = css.replace(varRef[0], v.value)
        declaredIn = `${v.file}:${v.line}`
      }
    }
    if (!a && css.includes("/ 1")) css = css.replace(/\s*\/\s*1\)/, ")")
    return { css, via: `утилита ${b} → ${util.value}`, declaredIn }
  }
  const [name, shade] = rest.split("-")
  const paletteEntry = twPalette[name]
  const hex =
    typeof paletteEntry === "string" ? paletteEntry : paletteEntry && shade ? (paletteEntry as Record<string, string>)[shade] : null
  if (typeof hex === "string") {
    const triplet = hexToRgbTriplet(hex)
    return {
      css: a && triplet ? `rgb(${triplet} / ${a})` : hex,
      via: `палитра Tailwind ${rest} = ${hex}`,
      declaredIn: null,
    }
  }
  return null
}

const OVERLAY_SPECS = [
  { file: "components/ui/dialog.tsx", title: "Dialog", tags: ["DialogPrimitive.Content", "DialogPrimitive.Overlay"] },
  { file: "components/ui/sheet.tsx", title: "Sheet", tags: ["SheetPrimitive.Content", "SheetPrimitive.Overlay"] },
  { file: "components/ui/popover.tsx", title: "Popover", tags: ["PopoverPrimitive.Content"] },
  { file: "components/ui/dropdown-menu.tsx", title: "DropdownMenu", tags: ["DropdownMenuPrimitive.Content", "DropdownMenuPrimitive.SubContent"] },
  { file: "components/ui/tooltip.tsx", title: "Tooltip", tags: ["TooltipPrimitive.Content"] },
  { file: "components/ui/select.tsx", title: "Select", tags: ["SelectPrimitive.Content"] },
  { file: "components/ui/command.tsx", title: "Command", tags: ["CommandPrimitive", "DialogContent"] },
  { file: "components/ui/action-menu.tsx", title: "ActionMenu", tags: ["DropdownMenuContent"] },
]

function facetsOf(classes: string[]) {
  const pick = (re: RegExp) => classes.filter((c) => re.test(base(c)))
  return {
    background: pick(/^bg-/),
    backdrop: pick(/^(backdrop-|supports-\[backdrop)/),
    radius: pick(/^rounded/),
    border: pick(/^border/),
    shadow: pick(/^shadow/),
    size: pick(/^(w-|h-|max-w-|max-h-|min-w-|min-h-)/),
    padding: pick(/^p[xytrbl]?-/),
    layer: pick(/^z-/),
  }
}

const overlays = OVERLAY_SPECS.filter((s) => existsSync(s.file)).map((spec) => {
  const parts = elements
    .filter((e) => e.file === spec.file && spec.tags.some((t) => e.tag === t))
    .map((e) => {
      const facets = facetsOf(e.classes)
      return {
        tag: e.tag,
        line: e.line,
        role: /Overlay$/.test(e.tag) ? ("подложка" as const) : ("панель" as const),
        classText: e.classText,
        facets,
        resolvedBackground: facets.background
          .map((c) => ({ cls: c, ...(resolveColorClass(c, "bg") ?? { css: "?", via: "не разрешилось", declaredIn: null }) }))
          .filter((r) => r.css !== "?"),
      }
    })
  // Sheet прячет фон панели в cva, а не в className самого JSX.
  const cva = spec.title === "Sheet" ? parseCva(spec.file) : null
  if (cva) {
    const cvaClasses = cva.base.split(/\s+/).filter(Boolean)
    const facets = facetsOf(cvaClasses)
    parts.push({
      tag: "sheetVariants (cva)",
      line: 0,
      role: "панель" as const,
      classText: cva.base,
      facets,
      resolvedBackground: facets.background
        .map((c) => ({ cls: c, ...(resolveColorClass(c, "bg") ?? { css: "?", via: "не разрешилось", declaredIn: null }) }))
        .filter((r) => r.css !== "?"),
    })
  }
  return { ...spec, parts, cva }
})

const OVERLAY_USAGE_TAGS = [
  "DialogContent",
  "SheetContent",
  "PopoverContent",
  "DropdownMenuContent",
  "TooltipContent",
  "SelectContent",
  "ActionMenu",
  "CommandDialog",
]

const overlayUsage = OVERLAY_USAGE_TAGS.map((tag) => {
  const uses = elements.filter((e) => e.zone !== "kit" && e.zone !== "landing-component" && e.tag === tag)
  const overridden = uses.filter((e) =>
    e.classes.some((c) => /^(bg-|rounded|border|shadow|max-w-|w-|p-)/.test(base(c)))
  )
  return {
    tag,
    count: uses.length,
    overridden: overridden.length,
    overrides: comboEntries((c) => /^(bg-|rounded|border|shadow|max-w-|w-|p-)/.test(base(c)), {
      filter: (e) => e.tag === tag,
    }),
    samples: uses.slice(0, SAMPLE_CAP).map(toSample),
  }
}).filter((o) => o.count > 0)

const sectionOverlays = {
  guard: partial(
    "Оверлеи собраны из кита — это канон. Но общего фона у них нет: Dialog и Sheet берут `bg-background`, DropdownMenu/Popover/Tooltip — `bg-popover`, Select — собственное стекло. Одинаковости фонов не проверяет ни один сторож.",
    "eslint-raw"
  ),
  note:
    "«Чёрный фон в выпадающих» берётся отсюда: `--background` и `--popover` объявлены в app/dashboard/dashboard.css, и это два разных значения. Ниже — что именно стоит на каждом примитиве и куда ведёт цепочка.",
  components: overlays,
  usage: overlayUsage,
  backgroundSummary: (() => {
    const m = new Map<string, { css: string; declaredIn: string | null; users: string[] }>()
    for (const o of overlays) {
      for (const p of o.parts) {
        for (const r of p.resolvedBackground) {
          const cur = m.get(r.cls) ?? { css: r.css, declaredIn: r.declaredIn, users: [] }
          cur.users.push(`${o.title} · ${p.role}`)
          m.set(r.cls, cur)
        }
      }
    }
    return [...m.entries()].map(([cls, v]) => ({ cls, ...v })).sort((a, b) => b.users.length - a.users.length)
  })(),
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 8. Шапки страниц
// ---------------------------------------------------------------------------

export type HeaderAction = {
  component: string
  variant: string | null
  size: string | null
  text: string
  conditional: boolean
  /** Кнопка лежала внутри div/span-обёртки — в слот попала не она сама. */
  wrapped: boolean
}

export type HeaderRow = {
  routes: string[]
  file: string
  line: number
  title: string
  titleStyle: string
  hasSubtitle: boolean
  subtitleKind: string | null
  back: "backHref" | "breadcrumbs" | null
  backLabel: string | null
  breadcrumbCount: number | null
  actions: HeaderAction[]
  actionsCount: number
  titleBadge: boolean
  meta: boolean
  rowClassName: string | null
  actionsClassName: string | null
}

function describeActions(a: ts.JsxAttribute | undefined): HeaderAction[] {
  if (!a?.initializer) return []
  const init = a.initializer
  const expr = ts.isJsxExpression(init) ? init.expression : init
  if (!expr) return []
  const describe = (el: ts.JsxOpeningLikeElement, conditional: boolean, wrapped: boolean): HeaderAction[] => {
    const tag = el.tagName.getText()
    const at = attrsOf(el)
    // Обёртка без собственного поведения прячет настоящие действия слота:
    // в шапке аналитики в actions лежит <div>, а кнопки — внутри него.
    const isWrapper = (tag === "div" || tag === "span") && !at.has("onClick") && !at.has("role")
    if (isWrapper && ts.isJsxElement(el.parent)) {
      const inner = el.parent.children.flatMap((c) => topLevelJsx(c))
      if (inner.length > 0) return inner.flatMap((x) => describe(x.el, conditional || x.conditional, true))
    }
    return [
      {
        component: tag,
        variant: attrText(at.get("variant")),
        size: attrText(at.get("size")) ?? attrText(at.get("kind")),
        text: jsxText(el),
        conditional,
        wrapped,
      },
    ]
  }
  return topLevelJsx(expr).flatMap(({ el, conditional }) => describe(el, conditional, false))
}

const headerRows: HeaderRow[] = []
for (const file of scannedFiles) {
  if (zoneOf(file) === "kit" || zoneOf(file) === "landing-component") continue
  const nodes = jsxByFile.get(file) ?? []
  const sf = sourceOf(file)
  for (const el of nodes) {
    if (el.tagName.getText() !== "PageHeader") continue
    const at = attrsOf(el)
    const bcAttr = at.get("breadcrumbs")
    let breadcrumbCount: number | null = null
    if (bcAttr?.initializer && ts.isJsxExpression(bcAttr.initializer) && bcAttr.initializer.expression) {
      const e = bcAttr.initializer.expression
      if (ts.isArrayLiteralExpression(e)) breadcrumbCount = e.elements.length
    }
    const subtitleAttr = at.get("subtitle")
    const rowRoutes = file.startsWith(PAGES_ROOT + "/") ? [routeOf(file)] : mountedIn.get(file) ?? []
    headerRows.push({
      routes: rowRoutes,
      file,
      line: sf.getLineAndCharacterOfPosition(el.getStart()).line + 1,
      title: attrText(at.get("title")) ?? "—",
      titleStyle: attrText(at.get("titleStyle")) ?? "section (по умолчанию)",
      hasSubtitle: Boolean(subtitleAttr),
      subtitleKind: subtitleAttr ? (attrText(subtitleAttr) === "{выражение}" ? "вычисляется" : "строка") : null,
      back: at.has("breadcrumbs") ? "breadcrumbs" : at.has("backHref") ? "backHref" : null,
      backLabel: attrText(at.get("backLabel")),
      breadcrumbCount,
      actions: describeActions(at.get("actions")),
      actionsCount: describeActions(at.get("actions")).length,
      titleBadge: at.has("titleBadge"),
      meta: at.has("meta"),
      rowClassName: attrText(at.get("rowClassName")),
      actionsClassName: attrText(at.get("actionsClassName")),
    })
  }
}
headerRows.sort((a, b) => (a.routes[0] ?? "").localeCompare(b.routes[0] ?? "") || a.file.localeCompare(b.file))

const routesWithHeader = new Set(headerRows.flatMap((r) => r.routes))
const routesWithoutHeader = routes
  .filter((r) => !routesWithHeader.has(r))
  .map((route) => {
    const file = routeFiles.find((f) => routeOf(f) === route) as string
    const text = readFileSync(file, "utf8")
    const reason = /\bredirect\(/.test(text)
      ? "редирект, своей вёрстки нет"
      : route === "/dashboard/login"
        ? "экран логина — автономное исключение канона (components/login-shell.tsx)"
        : /<h1/.test(text)
          ? "свой <h1> мимо PageHeader"
          : "шапки нет вовсе"
    return { route, file, reason }
  })

const sectionHeaders = {
  guard: partial(
    "Сама шапка канонизирована жёстко: один компонент, один кегль H1 (пропа `size` нет), отступ внутри компонента; стерегут `pnpm check:page-shell` и попиксельный e2e. Не канонизировано содержимое слота `actions` — сколько там кнопок, в каком порядке и какого варианта, не проверяет никто.",
    "page-shell",
    "page-header-canon"
  ),
  component: {
    file: "components/ui/page-header.tsx",
    props: ["title", "subtitle", "backHref", "backLabel", "breadcrumbs", "actions", "titleBadge", "titleStyle", "meta", "rowClassName", "actionsClassName"],
    note: "Пропа `size` нет намеренно: кегль H1 один на оба кабинета.",
  },
  rows: headerRows,
  routesTotal: routes.length,
  routesWithoutHeader,
  stats: {
    byActionsCount: countBy(headerRows, (r) => String(r.actionsCount)),
    byBack: countBy(headerRows, (r) => r.back ?? "нет возврата"),
    byBackLabel: countBy(
      headerRows.filter((r) => r.back === "backHref"),
      (r) => r.backLabel ?? "К списку (дефолт компонента)"
    ),
    bySubtitle: countBy(headerRows, (r) => (r.hasSubtitle ? "есть" : "нет")),
    byTitleStyle: countBy(headerRows, (r) => r.titleStyle),
    byFirstAction: countBy(
      headerRows.filter((r) => r.actions.length > 0),
      (r) => `${r.actions[0].component}${r.actions[0].variant ? ` variant=${r.actions[0].variant}` : ""}`
    ),
    withRowClassName: headerRows.filter((r) => r.rowClassName).length,
    withActionsClassName: headerRows.filter((r) => r.actionsClassName).length,
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 9. Состояния
// ---------------------------------------------------------------------------

const emptyStateUsages = elements
  .filter((e) => e.zone !== "kit" && e.zone !== "landing-component" && e.tag === "EmptyState")
  .map((e) => ({ ...toSample(e), props: e.attrNames.filter((n) => n !== "className") }))

const EMPTY_PHRASES = /Ничего не найдено|Нет данных|Нет записей|Нет результатов|не найден[аоы]?|Пока нет|Список пуст|Пусто/i

/** Компоненты кита, внутри которых фраза пустоты — это норма, а не самопал. */
const EMPTY_KIT_TAGS = /^(EmptyState|Banner|Alert|Toast)$/

/**
 * Пустые состояния ищем структурно, а не грепом: фраза считается состоянием,
 * только если она реально рендерится — текстом JSX или строкой в фигурных
 * скобках среди детей. `setError("Артист не найден")` в это не попадает: там
 * фраза уходит в стейт, а рисует её уже что-то другое.
 */
const emptyPhraseRenders = (() => {
  const rows: { file: string; line: number; zone: Zone; tag: string; text: string; viaKit: boolean; classText: string }[] = []
  for (const file of cabinetFiles) {
    if (!file.endsWith(".tsx")) continue
    const sf = sourceOf(file)
    const record = (node: ts.Node, text: string) => {
      let host: ts.Node | undefined = node.parent
      while (host && !ts.isJsxElement(host)) host = host.parent
      if (!host || !ts.isJsxElement(host)) return
      const opening = host.openingElement
      const tag = opening.tagName.getText()
      // Кит может лежать и выше по дереву: <Banner><span>…</span></Banner>.
      let viaKit = EMPTY_KIT_TAGS.test(tag)
      let up: ts.Node | undefined = host.parent
      while (!viaKit && up) {
        if (ts.isJsxElement(up) && EMPTY_KIT_TAGS.test(up.openingElement.tagName.getText())) viaKit = true
        up = up.parent
      }
      const classes: string[] = []
      const cn = attrsOf(opening).get("className")
      if (cn?.initializer) collectClassTokens(cn.initializer, classes)
      rows.push({
        file,
        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        zone: zoneOf(file),
        tag,
        text: text.replace(/\s+/g, " ").trim().slice(0, 80),
        viaKit,
        classText: classes.join(" "),
      })
    }
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n) && EMPTY_PHRASES.test(n.text)) record(n, n.text)
      else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && EMPTY_PHRASES.test(n.text)) {
        // Строка считается отрисованной, только если она внутри {…} среди
        // детей элемента, а не в атрибуте и не в вызове функции.
        let p: ts.Node | undefined = n.parent
        let inChildExpression = false
        while (p) {
          if (ts.isJsxAttribute(p) || ts.isCallExpression(p)) break
          if (ts.isJsxExpression(p) && p.parent && ts.isJsxElement(p.parent)) {
            inChildExpression = true
            break
          }
          p = p.parent
        }
        if (inChildExpression) record(n, n.text)
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
})()

const handRolledEmpty = emptyPhraseRenders.filter((r) => !r.viaKit)
const kitEmptyPhrases = emptyPhraseRenders.filter((r) => r.viaKit)

/** Обёртка загрузочного состояния: классы родителя спиннера. */
const loadingWrappers = (() => {
  const rows: { file: string; line: number; classText: string; inner: string; screenLevel: boolean }[] = []
  for (const file of cabinetFiles) {
    if (!file.endsWith(".tsx")) continue
    const sf = sourceOf(file)
    for (const el of jsxByFile.get(file) ?? []) {
      const tag = el.tagName.getText()
      const classes: string[] = []
      const at = attrsOf(el)
      const cn = at.get("className")
      if (cn?.initializer) collectClassTokens(cn.initializer, classes)
      const isSpinner = tag === "Spinner" || classes.some((c) => base(c) === "animate-spin")
      if (!isSpinner) continue
      // У самозакрывающегося тега родитель — сразу окружающий JsxElement,
      // у парного `.parent` это его собственный JsxElement, и подниматься надо
      // на уровень выше. Без этого различия обёрткой считался «дед».
      let parent: ts.Node | undefined = ts.isJsxSelfClosingElement(el) ? el.parent : el.parent?.parent
      while (parent && !ts.isJsxElement(parent)) parent = parent.parent
      if (!parent || !ts.isJsxElement(parent)) continue
      const pClasses: string[] = []
      const pcn = attrsOf(parent.openingElement).get("className")
      if (pcn?.initializer) collectClassTokens(pcn.initializer, pClasses)
      const p = pClasses.map(base)
      rows.push({
        file,
        line: sf.getLineAndCharacterOfPosition(parent.openingElement.getStart()).line + 1,
        classText: pClasses.join(" "),
        inner: tag,
        // «Загрузка вместо экрана» (B-03) — центрирующая обёртка с высотой или
        // вертикальным паддингом. Остальное — спиннер внутри кнопки/карточки.
        screenLevel:
          p.includes("justify-center") &&
          p.some((c) => /^(h-|min-h-|py-|pt-)/.test(c) || c === "items-center"),
      })
    }
  }
  return rows
})()

function groupLoading(rows: typeof loadingWrappers) {
  const m = new Map<string, { file: string; line: number; inner: string }[]>()
  for (const r of rows) {
    const key = r.classText || "(без классов)"
    const list = m.get(key) ?? []
    list.push({ file: r.file, line: r.line, inner: r.inner })
    m.set(key, list)
  }
  return [...m.entries()]
    .map(([classText, list]) => ({ classText, count: list.length, samples: list.slice(0, 10), more: Math.max(0, list.length - 10) }))
    .sort((a, b) => b.count - a.count)
}

const loadingLayouts = groupLoading(loadingWrappers.filter((r) => r.screenLevel))
const loadingInline = groupLoading(loadingWrappers.filter((r) => !r.screenLevel))

const skeletonUsages = elements.filter(
  (e) => e.zone !== "kit" && e.zone !== "landing-component" && /^Skeleton/.test(e.tag)
)

const bannerUsages = elements.filter((e) => e.zone !== "kit" && e.zone !== "landing-component" && (e.tag === "Banner" || e.tag === "Alert"))

const errorMentions = rawMatches(
  cabinetFiles.filter((f) => f.endsWith(".tsx")),
  /Ошибка|Не удалось|Что-то пошло не так|Произошла ошибка/g,
  { skipComments: true }
)
  .map((m) => ({ ...m, zone: zoneOf(m.file) }))

const sectionStates = {
  guard: partial(
    "Компоненты есть — EmptyState, Spinner, скелетон-пресеты, Banner — и они применены. Не канонизировано обрамление: раскладка загрузочного экрана пишется по месту (B-03), а ветки «не найдено» на нескольких экранах сверстаны до кита и без шапки (B-04). Сторожа ни у того, ни у другого нет.",
    "eslint-raw"
  ),
  empty: {
    kit: { count: emptyStateUsages.length, items: emptyStateUsages },
    handRolled: {
      note:
        "Фразы пустоты, которые рендерятся мимо EmptyState/Banner: свой <div> или <p> вместо компонента. Строки, уходящие в стейт (setError(…)), сюда не попадают — их рисует что-то другое.",
      count: handRolledEmpty.length,
      items: handRolledEmpty,
    },
    viaOtherKit: {
      note: "Те же фразы, но внутри Banner/Alert — не самопал, однако и не EmptyState: сообщение об ошибке и пустой список выглядят одинаково.",
      count: kitEmptyPhrases.length,
      items: kitEmptyPhrases,
    },
  },
  loading: {
    layouts: {
      note: "Классы контейнера, в который завёрнут спиннер, когда он заменяет собой экран. B-03 бэклога: одна и та же «загрузка посреди страницы» сверстана по-разному, и высота, на которой она появляется, прыгает от экрана к экрану.",
      variants: loadingLayouts.length,
      items: loadingLayouts,
    },
    inline: {
      note: "Тот же спиннер внутри кнопки, карточки или строки — это другое состояние, и его обрамление задаётся содержащим элементом.",
      variants: loadingInline.length,
      items: loadingInline,
    },
    spinner: countBy(loadingWrappers, (r) => r.inner),
    skeleton: {
      count: skeletonUsages.length,
      byComponent: countBy(skeletonUsages, (e) => e.tag),
      samples: skeletonUsages.slice(0, SAMPLE_CAP).map(toSample),
    },
    loadingRoutes: {
      note: "Файлы loading.tsx — единственный способ показать скелетон до гидрации.",
      files: pageFiles.filter((f) => f.endsWith("/loading.tsx")),
      of: routes.length,
    },
  },
  errors: {
    banners: {
      count: bannerUsages.length,
      byVariant: countBy(bannerUsages, (e) => `${e.tag}${e.attrs.variant ? ` variant=${e.attrs.variant}` : ""}`),
      samples: bannerUsages.slice(0, SAMPLE_CAP).map(toSample),
    },
    mentions: { count: errorMentions.length, items: errorMentions.slice(0, 60), more: Math.max(0, errorMentions.length - 60) },
  },
}

// ---------------------------------------------------------------------------
// СЕКЦИЯ 10. Отклонения
// ---------------------------------------------------------------------------

export type Deviation = {
  id: string
  title: string
  what: string
  guard: GuardRef
  count: number
  items: { file: string; line: number; zone: Zone; value: string; context: string }[]
  more: number
}

function deviation(
  id: string,
  title: string,
  what: string,
  guard: GuardRef,
  items: { file: string; line: number; zone: Zone; value: string; context: string }[]
): Deviation {
  const sorted = items.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  return { id, title, what, guard, count: sorted.length, items: sorted.slice(0, 80), more: Math.max(0, sorted.length - 80) }
}

const contextOf = (file: string, line: number) => {
  const lines = readFileSync(file, "utf8").split("\n")
  return (lines[line - 1] ?? "").trim().slice(0, 160)
}

const classDeviations = (match: (c: string) => boolean, zones: Zone[] = ["page", "cabinet-component", "kit"]) =>
  elements
    .filter((e) => zones.includes(e.zone))
    .flatMap((e) =>
      [...new Set(e.classes.filter(match))].map((value) => ({
        file: e.file,
        line: e.line,
        zone: e.zone,
        value,
        context: `<${e.tag}> ${e.classText}`.slice(0, 160),
      }))
    )

const COLOR_STYLE_PROPS = /^(color|background|backgroundColor|backgroundImage|borderColor|border|fill|stroke|boxShadow|outlineColor)$/

const deviations: Deviation[] = [
  deviation(
    "arbitrary-color",
    "Arbitrary-цвета в className",
    "`bg-[#0f1117]`, `text-[rgba(…)]` и подобное — цвет мимо токена.",
    partial("Запрещено ESLint, но только в app/dashboard/**. Кит и components/** вне охраны.", "eslint-color"),
    classDeviations((c) => /^(bg|text|border|ring|fill|stroke|shadow|from|via|to|outline|divide)-\[(#|rgb|hsl)/.test(base(c)))
  ),
  deviation(
    "arbitrary-value",
    "Прочие arbitrary-значения",
    "Размеры, отступы и тени, заданные квадратными скобками вместо шкалы.",
    none("Не запрещено и не проверяется ничем."),
    classDeviations((c) => /\[/.test(base(c)) && !/^(bg|text|border|ring|fill|stroke|shadow|from|via|to|outline|divide)-\[(#|rgb|hsl)/.test(base(c)))
  ),
  deviation(
    "inline-color",
    "Инлайн-стиль цвета",
    "`style={{ color … }}`, `style={{ background … }}` — цвет состояния задаётся стилем, а не вариантом компонента (C-08).",
    partial("Запрещено ESLint в app/dashboard/**; в components/** — нет.", "eslint-color"),
    elements
      .filter((e) => e.zone !== "landing-component")
      .flatMap((e) =>
        e.styles
          .filter((s) => COLOR_STYLE_PROPS.test(s.prop))
          .map((s) => ({ file: e.file, line: e.line, zone: e.zone, value: `${s.prop}: ${s.value}`, context: `<${e.tag}>` }))
      )
  ),
  deviation(
    "inline-style-any",
    "Любые инлайн-стили",
    "Ширина, высота, позиция и прочее в `style` — то, что не увидит ни один сторож классов.",
    none("Не запрещено и не проверяется."),
    elements
      .filter((e) => e.zone !== "landing-component" && e.styles.length > 0)
      .map((e) => ({
        file: e.file,
        line: e.line,
        zone: e.zone,
        value: e.styles.map((s) => s.prop).join(", "),
        context: `<${e.tag}> style={{ ${e.styles.map((s) => `${s.prop}: ${s.value}`).join("; ")} }}`.slice(0, 160),
      }))
  ),
  deviation(
    "raw-elements",
    "Raw-элементы вместо кита",
    "`<button>`, `<input>`, `<select>`, `<table>` руками при живом ките.",
    partial("Запрещено ESLint в app/dashboard/**. Кит имеет право; components/** — нет, но там запрета не стоит.", "eslint-raw"),
    elements
      .filter((e) => e.zone === "page" || e.zone === "cabinet-component")
      .filter((e) => ["button", "input", "select", "table"].includes(e.tag))
      .map((e) => ({ file: e.file, line: e.line, zone: e.zone, value: `<${e.tag}>`, context: e.classText.slice(0, 160) }))
  ),
  deviation(
    "important",
    "Классы с `!important`",
    "Признак того, что что-то в каскаде переопределяется силой.",
    none("Не проверяется."),
    classDeviations((c) => c.includes("!"))
  ),
  deviation(
    "hardcoded-hex",
    "Хекс-литералы в коде экранов и кита",
    "Цвет, вписанный строкой в .tsx мимо app/tokens.css — в том числе внутри строк тени и градиента.",
    partial("ESLint ловит только форму `bg-[#…]` в className и только в app/dashboard/**.", "eslint-color"),
    rawMatches(
      scannedFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")),
      HEX_RE,
      { skipComments: true }
    )
      .filter((m) => zoneOf(m.file) !== "landing-component")
      .filter((m) => !m.context.includes("var(--"))
      .map((m) => ({ file: m.file, line: m.line, zone: zoneOf(m.file), value: m.value, context: m.context }))
  ),
  deviation(
    "lucide",
    "Иконки не из material-symbols",
    `Смешение иконочных систем в одних и тех же рядах (C-15). Кит считается отдельно: shadcn приносит свои chevron'ы штатно — таких файлов в components/ui ${
      rawMatches(kitFiles.filter((f) => f.endsWith(".tsx")), /from "lucide-react"/g).length
    }.`,
    none("Не проверяется."),
    rawMatches(
      scannedFiles.filter((f) => f.endsWith(".tsx")),
      /from "lucide-react"/g
    )
      .filter((m) => zoneOf(m.file) === "page" || zoneOf(m.file) === "cabinet-component")
      .map((m) => ({ file: m.file, line: m.line, zone: zoneOf(m.file), value: "lucide-react", context: m.context }))
  ),
  deviation(
    "img-tag",
    "`<img>` вместо next/image",
    "Известный долг: линтер даёт предупреждение, но не ошибку.",
    partial("`pnpm lint` предупреждает (@next/next/no-img-element), сборку не роняет.", "eslint-raw"),
    elements
      .filter((e) => (e.zone === "page" || e.zone === "cabinet-component") && e.tag === "img")
      .map((e) => ({ file: e.file, line: e.line, zone: e.zone, value: "<img>", context: e.classText.slice(0, 160) }))
  ),
  deviation(
    "page-frame",
    "Страница задаёт свою рамку",
    "`max-w-*`, `mx-auto`, `p-*`, `px-*`, `pb-*` на корне страницы — работа DashboardShell (C-01).",
    canon("Канон, охраняется `pnpm check:page-shell` — падает при первом же нарушении.", "page-shell"),
    pageRootRows
      .filter((r) => r.forbidden.length > 0)
      .map((r) => ({ file: r.file, line: r.line, zone: zoneOf(r.file), value: r.forbidden.join(", "), context: r.classText.slice(0, 160) }))
  ),
]

const sectionDeviations = {
  guard: partial(
    "Половина отклонений уже под ESLint, но охрана кончается на границе app/dashboard/**: те же правила не действуют ни в components/**, ни в ките.",
    "eslint-raw",
    "eslint-color"
  ),
  items: deviations,
  summary: deviations.map((d) => ({ id: d.id, title: d.title, count: d.count, status: d.guard.status })),
}

// ---------------------------------------------------------------------------
// Сборка и запись
// ---------------------------------------------------------------------------

/**
 * Срез помечается коммитом ПРОСКАНИРОВАННОГО кода, а не HEAD. Иначе каждая
 * пересборка карты меняла бы свой же штамп на коммит, которого ещё нет, и
 * `pnpm design:map` никогда не давал бы чистое дерево дважды подряд.
 */
const gitSha = (() => {
  try {
    return execFileSync(
      "git",
      [
        "log",
        "-1",
        "--format=%h",
        // --first-parent: содержимое кабинета приезжает и слияниями веток,
        // а без флага упрощение истории по путям их пропускает и штамп
        // указывает на давний коммит внутри влитой ветки.
        "--first-parent",
        "--",
        PAGES_ROOT,
        COMPONENTS_ROOT,
        ROOT_LAYOUT,
        "app/tokens.css",
        "app/dashboard/dashboard.css",
        "app/globals.css",
        "tailwind.config.js",
      ],
      { encoding: "utf8" }
    ).trim() || null
  } catch {
    return null
  }
})()

const zoneCounts = countBy(scannedFiles, (f) => zoneOf(f))

const map = {
  meta: {
    generatedBy: "scripts/design-map.ts",
    command: "pnpm design:map",
    gitSha,
    note:
      "Инвентаризация фактического состояния кода. Ничего не унифицировано и не починено: карта показывает, что есть, а не что задумано.",
    scope: {
      roots: [PAGES_ROOT + "/**", COMPONENTS_ROOT + "/** (кроме ui)", KIT_ROOT + "/** — отдельной секцией как эталон"],
      files: scannedFiles.length,
      byZone: zoneCounts.map((z) => ({ ...z, title: ZONE_TITLE[z.name as Zone] })),
      routes: routes.length,
      jsxElements: elements.length,
    },
    zoneTitles: ZONE_TITLE,
  },
  guards: GUARDS,
  sections: {
    tokens: sectionTokens,
    surfaces: sectionSurfaces,
    radii: sectionRadii,
    borders: sectionBorders,
    containers: sectionContainers,
    buttons: sectionButtons,
    overlays: sectionOverlays,
    headers: sectionHeaders,
    states: sectionStates,
    deviations: sectionDeviations,
  },
}

writeFileSync(OUT, JSON.stringify(map, null, 2) + "\n", "utf8")

const kb = Math.round(Buffer.byteLength(JSON.stringify(map)) / 1024)
console.log(`✔ Карта собрана: ${OUT} (${kb} КБ)`)
console.log(`  файлов просканировано: ${scannedFiles.length}, JSX-элементов: ${elements.length}, роутов: ${routes.length}`)
console.log(`  скруглений: ${sectionRadii.entries.length}, фонов: ${sectionSurfaces.families.reduce((n, f) => n + f.entries.length, 0)}, шапок: ${headerRows.length}`)
console.log(`  отклонений: ${deviations.reduce((n, d) => n + d.count, 0)} в ${deviations.length} группах`)
