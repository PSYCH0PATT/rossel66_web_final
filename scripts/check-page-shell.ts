/**
 * Канон рамки страницы (C-01): ширину, поля и подвал задаёт DashboardShell,
 * страница — только вертикальный ритм.
 *
 * Волны 1–4 пересадили экраны на PageHeader, но половина страниц продолжала
 * объявлять СВОЙ контейнер поверх шелловского `mx-auto max-w-7xl p-6 md:p-10`.
 * У `/dashboard/admin/playlists` это давало двойные поля и заголовок,
 * сдвинутый на 40px относительно всех остальных экранов; у остальных —
 * мёртвые классы, которые поддерживали иллюзию, что ширину решает страница.
 *
 * Проверяем корневой JSX каждой страницы кабинета: у него не должно быть
 * ширины (`max-w-*`), центровки (`mx-auto`) и рамочных паддингов
 * (`p-*`, `px-*`, `pb-*` с любым брейкпоинтом). Вертикальные `py-*`/`pt-*`
 * на центрирующих загрузочных состояниях под запрет не попадают: это ритм, а
 * не рамка.
 *
 * Экран, которому узкий контейнер нужен по смыслу, оформляется отдельным
 * компонентом-обёрткой (`components/login-shell.tsx`), а не исключением здесь.
 *
 * Usage: npx tsx scripts/check-page-shell.ts   (входит в `pnpm verify`)
 */
import ts from "typescript"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/** Страницы кабинета: сам роут, его клиент и скелетон. */
const PAGE_ROOT = "app/dashboard"
const isPageFile = (name: string) =>
  name === "page.tsx" || name === "loading.tsx" || name.endsWith("-client.tsx")

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : isPageFile(e.name) ? [join(dir, e.name)] : []
  )
}

/**
 * Тело страницы, вынесенное в components/: `artist-reports.tsx` монтируется
 * прямо под шелл сразу двумя роутами и ведёт себя как корень страницы.
 */
const EXTRA_FILES = ["components/artist-reports.tsx"]

const FORBIDDEN: { re: RegExp; what: string }[] = [
  { re: /^(?:[a-z0-9]+:)*mx-auto$/, what: "mx-auto" },
  { re: /^(?:[a-z0-9]+:)*!?max-w-\S+$/, what: "max-w-*" },
  { re: /^(?:[a-z0-9]+:)*!?p-\S+$/, what: "p-*" },
  { re: /^(?:[a-z0-9]+:)*!?px-\S+$/, what: "px-*" },
  { re: /^(?:[a-z0-9]+:)*!?pb-\S+$/, what: "pb-*" },
]

type Finding = { file: string; line: number; classes: string[]; text: string }

/** Все строковые куски className: литерал, `{"…"}` и шаблон с подстановками. */
function classNamesOf(node: ts.JsxOpeningLikeElement): string[] | null {
  const attrs = node.attributes.properties
  for (const a of attrs) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== "className") continue
    const init = a.initializer
    if (!init) return null
    const parts: string[] = []
    const collect = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) parts.push(n.text)
      else if (ts.isTemplateExpression(n)) {
        parts.push(n.head.text)
        n.templateSpans.forEach((s) => parts.push(s.literal.text))
      } else ts.forEachChild(n, collect)
    }
    collect(init)
    return parts.join(" ").split(/\s+/).filter(Boolean)
  }
  return null
}

/** Компонент страницы — то, что уходит в `export default`. */
function defaultExportedFunction(src: ts.SourceFile): ts.Node | null {
  let found: ts.Node | null = null
  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st) && st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      found = st
    } else if (ts.isExportAssignment(st) && !st.isExportEquals) {
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
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n)
  )
}

/**
 * Корни страницы — JSX из `return` самого компонента (включая ранние выходы:
 * «загрузка», «не найдено» — это тоже корневые контейнеры). Возвраты из
 * вложенных функций (колбэки `.map`, хелперы) не считаются.
 */
function pageRoots(component: ts.Node): ts.JsxOpeningLikeElement[] {
  const roots: ts.JsxOpeningLikeElement[] = []
  const pushRoot = (e: ts.Node) => {
    if (ts.isJsxElement(e)) roots.push(e.openingElement)
    else if (ts.isJsxSelfClosingElement(e)) roots.push(e)
    else if (ts.isJsxFragment(e)) {
      // Фрагмент — не рамка: рамкой работают его прямые div/section/main.
      // Компоненты (Dialog и прочие оверлеи) пропускаем: их ширина — их дело.
      for (const c of e.children) {
        if (ts.isJsxElement(c) && /^[a-z]/.test(c.openingElement.tagName.getText())) {
          roots.push(c.openingElement)
        }
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
  // Стрелка без блока: `() => (<div/>)`
  const body = (component as ts.FunctionLikeDeclaration).body
  if (body && !ts.isBlock(body)) {
    let e: ts.Node = body
    while (ts.isParenthesizedExpression(e)) e = e.expression
    pushRoot(e)
  } else {
    ts.forEachChild(component, visit)
  }
  return roots
}

const files = [...new Set([...walk(PAGE_ROOT), ...EXTRA_FILES])].sort()
const findings: Finding[] = []

for (const file of files) {
  const text = readFileSync(file, "utf8")
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const component = defaultExportedFunction(src)
  if (!component) continue
  for (const root of pageRoots(component)) {
    const classes = classNamesOf(root)
    if (!classes) continue
    const bad = classes.filter((c) => FORBIDDEN.some((f) => f.re.test(c)))
    if (bad.length === 0) continue
    findings.push({
      file,
      line: src.getLineAndCharacterOfPosition(root.getStart()).line + 1,
      classes: bad,
      text: root.getText().replace(/\s+/g, " ").slice(0, 100),
    })
  }
}

if (findings.length === 0) {
  console.log(`✔ Рамка страниц: ${files.length} файлов, своих контейнеров нет`)
  process.exit(0)
}

console.error("✘ Страница задаёт свою рамку — это работа DashboardShell (C-01):\n")
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`)
  console.error(`    запрещено: ${f.classes.join(", ")}`)
  console.error(`    ${f.text}\n`)
}
console.error(
  "На корне страницы оставьте только вертикальный ритм (space-y-*).\n" +
    "Нужна другая ширина — это проп у DashboardShell.\n" +
    "Нужен центрированный экран вне кабинета — отдельный компонент-обёртка,\n" +
    "как components/login-shell.tsx. Отключать проверку комментарием нельзя."
)
process.exit(1)
