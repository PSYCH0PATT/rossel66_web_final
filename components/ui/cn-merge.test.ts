/**
 * B-11: `cn()` может молча съесть класс — сторож для всего кита.
 *
 * `cn()` это `twMerge`, а `twMerge` разруливает конфликты по группам утилит.
 * Версия 2.1 (та, что стоит в проекте) не знает утилит переноса из Tailwind 3.4
 * и относит `text-balance`, `text-pretty`, `text-wrap`, `text-nowrap` к группе
 * **text-color**. Съедает их не размер, как считалось раньше, а ЦВЕТ:
 *
 *   twMerge("text-balance", "text-4xl")   → "text-balance text-4xl"   (не конфликт)
 *   twMerge("text-balance", "text-white") → "text-white"              (класс исчез)
 *
 * Причём исчезает даже внутри ОДНОГО аргумента: строка заголовка шапки
 * «text-balance … text-white …» теряла `text-balance` целиком, и фикс F-83
 * (перенос «РЕДАКТИРОВАНИ / Е» на 390) не работал, хотя класс лежал в исходнике.
 *
 * Тест держит два замка:
 *   1. зафиксированные кейсы «вход → выход twMerge» — упадут, когда обновится
 *      tailwind-merge и семантика групп поменяется (это повод перепроверить кит,
 *      а не молча проехать регресс);
 *   2. живой обход `components/ui/**`: любая НОВАЯ пропажа класса в `cn()`/`cva()`
 *      роняет тест. Законные перекрытия варианта над базой — в явном списке ниже.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

import { cn } from "../../lib/utils"

const KIT_DIR = "components/ui"

/** Утилиты, которые twMerge 2.1 не знает и путает с цветом текста. */
const SILENT_FAMILY = ["text-balance", "text-pretty", "text-wrap", "text-nowrap"]

// ---------------------------------------------------------------------------
// 1. Зафиксированные кейсы
// ---------------------------------------------------------------------------

const FROZEN: Array<{ what: string; input: string[]; expected: string }> = [
  // Семейство, которое исчезает молча: виновник — цвет, а не размер.
  { what: "цвет съедает text-balance", input: ["text-balance", "text-white"], expected: "text-white" },
  { what: "цвет съедает text-pretty", input: ["text-pretty", "text-gray-400"], expected: "text-gray-400" },
  { what: "цвет съедает text-nowrap", input: ["text-nowrap", "text-gray-500"], expected: "text-gray-500" },
  { what: "цвет съедает text-wrap", input: ["text-wrap", "text-white"], expected: "text-white" },
  // …и делает это даже внутри одного аргумента, а не только между аргументами.
  {
    what: "одна строка: text-balance перед text-white",
    input: ["text-balance font-bold text-white"],
    expected: "font-bold text-white",
  },
  // Контрпример: РАЗМЕР ничего не съедает. Формулировка «text-balance и text-4xl
  // в одной группе» была неверной — не возвращать её в доки.
  {
    what: "размер не конфликтует с text-balance",
    input: ["text-balance", "text-4xl"],
    expected: "text-balance text-4xl",
  },
  // text-clip/text-ellipsis twMerge знает (группа text-overflow) — они безопасны.
  { what: "text-clip рядом с цветом цел", input: ["text-clip", "text-gray-500"], expected: "text-clip text-gray-500" },
  { what: "text-ellipsis рядом с цветом цел", input: ["text-ellipsis", "text-white"], expected: "text-ellipsis text-white" },
  // Законные перекрытия из кита — тоже под замком: если однажды перестанут
  // работать, варианты компонентов поедут молча.
  { what: "вариант cta перебивает насыщенность базы", input: ["font-medium", "font-bold"], expected: "font-bold" },
  {
    what: "вариант destructive перебивает цвет иконки",
    input: ["[&>svg]:text-foreground", "[&>svg]:text-destructive"],
    expected: "[&>svg]:text-destructive",
  },
]

// ---------------------------------------------------------------------------
// 2. Разбор кита: реальные наборы классов
// ---------------------------------------------------------------------------

type ClassSet = { file: string; line: number; origin: string; args: string[] }

const literal = (n: ts.Node): string | null =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null

function objectEntries(n: ts.Node): Array<[string, ts.Expression]> {
  if (!ts.isObjectLiteralExpression(n)) return []
  const out: Array<[string, ts.Expression]> = []
  for (const p of n.properties) {
    if (!ts.isPropertyAssignment(p)) continue
    const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null
    if (key) out.push([key, p.initializer])
  }
  return out
}

/** Строка из литерала, конкатенации `+` и ссылки на модульную константу. */
function resolveString(n: ts.Node, consts: Map<string, string[]>): string[] {
  const lit = literal(n)
  if (lit !== null) return [lit]
  if (ts.isParenthesizedExpression(n)) return resolveString(n.expression, consts)
  if (ts.isAsExpression(n)) return resolveString(n.expression, consts)
  if (ts.isIdentifier(n)) return consts.get(n.text) ?? []
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveString(n.left, consts)
    const right = resolveString(n.right, consts)
    return left.flatMap((l) => right.map((r) => l + r))
  }
  return []
}

/**
 * Модульные константы с классами: и одиночная строка, и объект-справочник
 * (`ACCENTS`, `TITLE_CLASS`). Значения собираются вместе со склейкой `+`.
 */
function moduleConsts(src: ts.SourceFile): Map<string, string[]> {
  const consts = new Map<string, string[]>()
  for (const st of src.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue
      const init = ts.isAsExpression(d.initializer) ? d.initializer.expression : d.initializer
      if (ts.isObjectLiteralExpression(init)) {
        const values = objectEntries(init).flatMap(([, v]) => resolveString(v, consts))
        if (values.length) consts.set(d.name.text, values)
      } else {
        const values = resolveString(init, consts)
        if (values.length) consts.set(d.name.text, values)
      }
    }
  }
  return consts
}

function parse(file: string): ts.SourceFile {
  const path = join(KIT_DIR, file)
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/**
 * Наборы классов одного файла кита: аргументы `cn()` и раскрытая `cva()`
 * (база × все варианты + подходящие compoundVariants). Ветки тернарников и
 * `&&` дают ОТДЕЛЬНЫЕ наборы: иначе взаимоисключающие классы соседних веток
 * читались бы как пропажа.
 */
function classSetsOf(file: string): ClassSet[] {
  const src = parse(file)
  const lineOf = (n: ts.Node) => src.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const sets: ClassSet[] = []
  const constStrings = moduleConsts(src)

  /** Возможные значения аргумента: пустая строка — «ветки нет». */
  function alternatives(n: ts.Node): string[] {
    const lit = literal(n)
    if (lit !== null) return [lit]
    if (ts.isParenthesizedExpression(n)) return alternatives(n.expression)
    if (ts.isConditionalExpression(n)) return [...alternatives(n.whenTrue), ...alternatives(n.whenFalse)]
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return ["", ...alternatives(n.right)]
    }
    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression)) {
      return constStrings.get(n.expression.text) ?? [""]
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      return constStrings.get(n.expression.text) ?? [""]
    }
    if (ts.isIdentifier(n)) return constStrings.get(n.text) ?? [""]
    return [""]
  }

  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text === "cn") {
        let combos: string[][] = [[]]
        for (const a of n.arguments) {
          const alts = alternatives(a)
          combos = combos.flatMap((c) => alts.map((v) => [...c, v]))
          if (combos.length > 64) combos = combos.slice(0, 64)
        }
        for (const combo of combos) {
          const args = combo.filter(Boolean)
          if (args.length) sets.push({ file, line: lineOf(n), origin: "cn()", args })
        }
      }

      if (n.expression.text === "cva") {
        const base = n.arguments[0] ? literal(n.arguments[0]) : null
        const variants: Array<[string, Array<[string, string]>]> = []
        let compound: Array<{ when: Record<string, string>; cls: string }> = []
        for (const [key, value] of n.arguments[1] ? objectEntries(n.arguments[1]) : []) {
          if (key === "variants") {
            for (const [vKey, vObj] of objectEntries(value)) {
              const values = objectEntries(vObj)
                .map(([vName, v]) => [vName, literal(v) ?? ""] as [string, string])
                .filter(([, v]) => v !== "")
              if (values.length) variants.push([vKey, values])
            }
          }
          if (key === "compoundVariants" && ts.isArrayLiteralExpression(value)) {
            compound = value.elements.flatMap((el) => {
              const when: Record<string, string> = {}
              let cls = ""
              for (const [k, v] of objectEntries(el)) {
                const lit = literal(v)
                if (k === "class" || k === "className") cls = lit ?? ""
                else if (lit !== null) when[k] = lit
              }
              return cls ? [{ when, cls }] : []
            })
          }
        }

        let combos: Array<{ label: string[]; classes: string[]; pick: Record<string, string> }> = [
          { label: [], classes: base ? [base] : [], pick: {} },
        ]
        for (const [vKey, values] of variants) {
          combos = combos.flatMap((c) =>
            values.map(([vName, vClass]) => ({
              label: [...c.label, `${vKey}=${vName}`],
              classes: [...c.classes, vClass],
              pick: { ...c.pick, [vKey]: vName },
            }))
          )
        }
        for (const c of combos) {
          const extra = compound
            .filter((cv) => Object.entries(cv.when).every(([k, v]) => c.pick[k] === v))
            .map((cv) => cv.cls)
          sets.push({
            file,
            line: lineOf(n),
            origin: `cva(${c.label.join(", ") || "база"})`,
            args: [...c.classes, ...extra].filter(Boolean),
          })
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
  return sets
}

/** Класс, который вытеснил пропавший: более поздний из той же группы twMerge. */
function winnerOf(lost: string, tokens: string[], lostIndex: number): string {
  for (let i = tokens.length - 1; i > lostIndex; i--) {
    if (cn(lost, tokens[i]) === tokens[i]) return tokens[i]
  }
  return "?"
}

type Loss = { file: string; line: number; origin: string; lost: string; winner: string }

function lossesOf(set: ClassSet): Loss[] {
  const tokens = set.args.join(" ").split(/\s+/).filter(Boolean)
  const survived = new Set(cn(...set.args).split(/\s+/).filter(Boolean))
  return tokens.flatMap((t, i) =>
    survived.has(t) || tokens.indexOf(t) !== i
      ? []
      : [{ file: set.file, line: set.line, origin: set.origin, lost: t, winner: winnerOf(t, tokens, i) }]
  )
}

/**
 * Законные перекрытия: вариант компонента намеренно бьёт базу тем же свойством.
 * Новая строка сюда добавляется ТОЛЬКО после ручной проверки, что класс правда
 * лишний, — иначе тест ровно за этим и стоит.
 */
const ALLOWED_LOSSES = new Set([
  // button: вариант `cta` жирнее базового font-medium (C-02, главный CTA).
  "button.tsx|font-medium|font-bold",
  // alert: у destructive иконка красная, а не цвета текста темы.
  "alert.tsx|[&>svg]:text-foreground|[&>svg]:text-destructive",
])

// ---------------------------------------------------------------------------

describe("cn(): молчаливые пропажи классов (B-11)", () => {
  for (const c of FROZEN) {
    it(`twMerge: ${c.what}`, () => {
      assert.equal(
        cn(...c.input),
        c.expected,
        `Поведение tailwind-merge изменилось. Если утилита поумнела — перепроверьте кит ` +
          `(и строку заголовка в page-header.tsx) и обновите этот кейс осознанно.`
      )
    })
  }

  it("кит не теряет классов в cn()/cva(), кроме заявленных перекрытий", () => {
    const files = readdirSync(KIT_DIR).filter((f) => f.endsWith(".tsx")).sort()
    assert.ok(files.length > 0, `в ${KIT_DIR} не найдено ни одного компонента`)

    const unexpected: string[] = []
    for (const file of files) {
      for (const set of classSetsOf(file)) {
        for (const loss of lossesOf(set)) {
          const key = `${loss.file}|${loss.lost}|${loss.winner}`
          if (ALLOWED_LOSSES.has(key)) continue
          unexpected.push(
            `${loss.file}:${loss.line} [${loss.origin}] — «${loss.lost}» вытеснен «${loss.winner}»`
          )
        }
      }
    }

    assert.deepEqual(
      [...new Set(unexpected)].sort(),
      [],
      "cn() выбрасывает класс, до разметки он не доедет. Либо это осознанное перекрытие " +
        "(тогда строку в ALLOWED_LOSSES с объяснением), либо класс надо вынести из cn() " +
        "или переставить порядок аргументов — как сделано со строкой H1 в page-header.tsx."
    )
  })

  it("строка заголовка шапки не идёт через cn() — иначе text-balance исчезнет (F-83)", () => {
    const source = readFileSync(join(KIT_DIR, "page-header.tsx"), "utf8")

    // Классы H1 живут в готовых строках TITLE_CLASS и подставляются как есть.
    assert.match(
      source,
      /className=\{TITLE_CLASS\[titleStyle\]\}/,
      "классы H1 должны подставляться напрямую из TITLE_CLASS, без обёртки"
    )
    assert.doesNotMatch(
      source,
      /cn\([^)]*TITLE_CLASS/,
      "TITLE_CLASS не должен попадать в cn(): twMerge выбросит text-balance"
    )

    // Строки берём разбором TITLE_CLASS, а не грепом по файлу: в шапке файла
    // те же классы стоят в примере внутри комментария.
    const titles = moduleConsts(parse("page-header.tsx")).get("TITLE_CLASS") ?? []
    assert.ok(titles.length >= 2, "в page-header.tsx ожидались оба варианта TITLE_CLASS")
    for (const title of titles) {
      assert.ok(title.includes("text-balance"), "класс переноса должен остаться в исходнике")
      const family = SILENT_FAMILY.filter((u) => title.includes(u))
      const survived = cn(title).split(/\s+/)
      const eaten = family.filter((u) => !survived.includes(u))
      assert.deepEqual(
        eaten,
        family,
        "Кейс перестал быть опасным: раньше cn() съедал эти классы. Проверьте версию " +
          "tailwind-merge и, если конфликта больше нет, упростите комментарий в page-header.tsx."
      )
    }
  })
})
