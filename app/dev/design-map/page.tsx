/**
 * Карта фактического дизайна кабинетов — /dev/design-map.
 *
 * Показывает не то, что задумано китом, а то, что РЕАЛЬНО стоит в коде: все
 * значения, все вариации, частоты, файлы и строки. Рядом с каждым — живой
 * образец (настоящая вёрстка, не картинка) и пометка «канон, охраняется таким-то
 * сторожем» либо «вариаций N, канона нет».
 *
 * Источник — `design-map.json`, который собирает `scripts/design-map.ts`
 * (`pnpm design:map`). Руками здесь ничего не вписано: если экран поменяется,
 * достаточно пересобрать карту.
 *
 * Серверный компонент: JSON никуда не уезжает в браузер, интерактива нет —
 * навигация это якоря, длинные списки — нативные <details>.
 */
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import raw from "./design-map.json"
import {
  Block,
  Cell,
  CountBadge,
  DataGrid,
  FileList,
  Grid,
  GuardBadge,
  GuardTag,
  Metric,
  Mono,
  Row,
  Section,
  ValueCard,
  ZONE_SHORT,
  ZoneLine,
  samplesToFiles,
} from "./parts"
import type {
  ClassEntry,
  EmptyPhrase,
  ColorValue,
  Counted,
  Cva,
  CssRule,
  CssVar,
  Deviation,
  Guard,
  GuardRef,
  HeaderRow,
  LoadingGroup,
  Occurrence,
  OverlayPart,
  Sample,
  Zone,
} from "./types"

/**
 * JSON приходит из генератора и описан в `types.ts` по кускам: полную форму
 * дерева здесь дублировать незачем — она бы устаревала вместе со скриптом.
 * Поэтому корень читается свободно, а каждое место приведения указывает свой
 * тип из `types.ts` — там, где это что-то даёт.
 */
const map = raw as unknown as Record<string, any>
const guards = map.guards as Guard[]
const S = map.sections

export const metadata = { title: "Карта фактического дизайна" }

const SECTIONS = [
  { id: "tokens", title: "Токены" },
  { id: "surfaces", title: "Поверхности и фоны" },
  { id: "radii", title: "Скругления" },
  { id: "borders", title: "Границы и тени" },
  { id: "containers", title: "Контейнеры" },
  { id: "buttons", title: "Кнопки" },
  { id: "overlays", title: "Оверлеи" },
  { id: "headers", title: "Шапки страниц" },
  { id: "states", title: "Состояния" },
  { id: "deviations", title: "Отклонения" },
] as const

// ---------------------------------------------------------------------------
// Образцы: живая вёрстка теми же классами, что стоят в коде
// ---------------------------------------------------------------------------

/**
 * Классы из JSON — строки времени выполнения, но Tailwind их уже собрал:
 * каждая пришла из файла, который входит в `content` (app/**, components/**).
 * Поэтому образец действительно окрашивается, а не остаётся пустым.
 */
function SurfaceSwatch({ cls }: { cls: string }) {
  return <div className={`h-14 w-full rounded-lg border border-white/10 ${cls}`} />
}

function RadiusSwatch({ cls }: { cls: string }) {
  return <div className={`h-16 w-16 border border-white/25 bg-white/[0.08] ${cls}`} />
}

function BorderSwatch({ cls }: { cls: string }) {
  return <div className={`h-14 w-full rounded-lg bg-white/[0.02] ${cls}`} />
}

function ShadowSwatch({ cls }: { cls: string }) {
  return <div className={`h-14 w-full rounded-lg border border-white/10 bg-surface-raised ${cls}`} />
}

function TextSwatch({ cls }: { cls: string }) {
  return <span className={cls}>Пример текста · 1 234 ₽</span>
}

// ---------------------------------------------------------------------------
// 1. Токены
// ---------------------------------------------------------------------------

function TokenCard({ v }: { v: CssVar }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div
        className="h-12 w-full rounded-lg border border-white/10"
        style={v.swatch ? { background: v.swatch } : undefined}
      />
      <div className="flex items-start justify-between gap-2">
        <Mono>{v.name}</Mono>
        <CountBadge n={v.usage} />
      </div>
      <div className="font-mono text-[10px] text-gray-500">{v.value}</div>
      {v.utilities.length > 0 && (
        <div className="text-[10px] leading-snug text-gray-500">
          утилиты: <span className="text-gray-400">{v.utilities.join(", ")}</span>
        </div>
      )}
      {v.usageDetail && (
        <div className="text-[10px] text-gray-600">
          через классы {v.usageDetail.viaUtilities} · через var() {v.usageDetail.viaVar}
        </div>
      )}
      {v.comment && <p className="text-[10px] leading-snug text-gray-500">{v.comment}</p>}
      <div className="font-mono text-[10px] text-gray-600">
        {v.file}:{v.line}
      </div>
    </div>
  )
}

function SectionTokens() {
  const t = S.tokens
  return (
    <Section
      n={1}
      id="tokens"
      title="Токены"
      guard={t.guard as GuardRef}
      guards={guards}
      lead="Всё, что объявлено как значение: цвета кабинета, переменные темы shadcn, шкала радиусов, шрифты. Число рядом с образцом — сколько раз это значение реально вызывается в коде кабинета (классами и через var()), а не сколько раз объявлено."
    >
      {(t.cssVariables.groups as { id: string; title: string; note: string; vars: CssVar[] }[]).map((g) => (
        <Block key={g.id} title={g.title} note={g.note || undefined} right={<CountBadge n={g.vars.length} of="токенов" />}>
          <Grid min={230}>
            {g.vars.map((v) => (
              <TokenCard key={v.name} v={v} />
            ))}
          </Grid>
        </Block>
      ))}

      <Block
        title="Переменные темы shadcn"
        note={`${t.themeVariables.note} Объявлены в ${t.themeVariables.file}.`}
        right={<CountBadge n={(t.themeVariables.vars as CssVar[]).length} of="переменных" />}
      >
        <Grid min={230}>
          {(t.themeVariables.vars as CssVar[]).map((v) => (
            <TokenCard key={v.name} v={v} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Шкала скруглений"
        note={`${t.radius.note} Объявлена в ${t.radius.file}:${t.radius.line}.`}
      >
        <Grid min={170}>
          {(t.radius.values as { name: string; value: string; usage: number }[]).map((r) => (
            <div key={r.name} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="relative flex min-h-[64px] transform-gpu items-center justify-center overflow-hidden rounded-lg bg-black/30">
                <RadiusSwatch cls={r.name} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <Mono>{r.name}</Mono>
                <CountBadge n={r.usage} />
              </div>
              <div className="font-mono text-[10px] text-gray-500">{r.value}</div>
            </div>
          ))}
        </Grid>
      </Block>

      <Block title="Шрифты" note="Объявлены в tailwind.config.js. Дисплейный — только для H1 и стат-карточек.">
        <Grid min={260}>
          {(t.typography.fonts as { name: string; stack: string }[]).map((f) => (
            <div key={f.name} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className={`mb-2 truncate text-lg text-white ${f.name}`}>Отчёты и выплаты</div>
              <Mono>{f.name}</Mono>
              <div className="mt-1 break-all font-mono text-[10px] text-gray-500">{f.stack}</div>
            </div>
          ))}
        </Grid>
      </Block>

      <Block
        title="Кегли текста"
        note="Не токены, а фактически встречающиеся размеры. Правила «какой уровень — какой кегль» в проекте нет, поэтому это тоже инвентарь."
        right={<CountBadge n={(t.typography.sizes as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={230}>
          {(t.typography.sizes as ClassEntry[]).slice(0, 24).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<TextSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Насыщенность и трекинг"
        right={
          <CountBadge
            n={(t.typography.weights as ClassEntry[]).length + (t.typography.tracking as ClassEntry[]).length}
            of="вариантов"
          />
        }
      >
        <Grid min={230}>
          {[...(t.typography.weights as ClassEntry[]), ...(t.typography.tracking as ClassEntry[])].map((e) => (
            <ValueCard key={e.name} entry={e} preview={<TextSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Цвета текста"
        note="Сколько разных цветов текста реально используется — включая палитру Tailwind мимо токенов."
        right={<CountBadge n={(t.typography.textColors as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={230}>
          {(t.typography.textColors as ClassEntry[]).slice(0, 30).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<TextSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      {(
        [
          ["Паддинги", t.spacing.padding],
          ["Gap в сетках и флексах", t.spacing.gap],
          ["Вертикальный ритм space-y / space-x", t.spacing.space],
          ["Внешние отступы", t.spacing.margin],
        ] as [string, ClassEntry[]][]
      ).map(([title, entries]) => (
        <Block key={title} title={title} right={<CountBadge n={entries.length} of="вариантов" />}>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <span
                key={e.name}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
              >
                {e.name} <span className="text-gray-500">{e.count}</span>
              </span>
            ))}
          </div>
        </Block>
      ))}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 2. Поверхности и фоны
// ---------------------------------------------------------------------------

function SectionSurfaces() {
  const s = S.surfaces
  const dark = s.darkInventory
  const darkAll = [...dark.tokens, ...dark.themeVars, ...dark.literals] as {
    kind: string
    name: string
    value: string
    swatch: string | null
    where: string
    usage: number
    comment: string | null
  }[]
  return (
    <Section
      n={2}
      id="surfaces"
      title="Поверхности и фоны"
      guard={s.guard as GuardRef}
      guards={guards}
      lead="Чем закрашены блоки: карточки, панели, таблицы, баннеры, оверлеи. Отдельно — значения, вписанные мимо токенов, с файлами и строками."
    >
      <Block
        title="C-05 · сколько всего разных тёмных фонов"
        note={dark.note}
        right={<CountBadge n={darkAll.length} of="значений" />}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Metric label="токенов поверхностей" value={dark.tokens.length} />
          <Metric label="переменных темы" value={dark.themeVars.length} />
          <Metric label="литералов в коде" value={dark.literals.length} />
        </div>
        <Grid min={210}>
          {darkAll.map((d) => (
            <div key={`${d.kind}-${d.name}`} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div
                className="h-12 w-full rounded-lg border border-white/10"
                style={d.swatch ? { background: d.swatch } : undefined}
              />
              <div className="flex items-start justify-between gap-2">
                <Mono>{d.name}</Mono>
                <CountBadge n={d.usage} />
              </div>
              <div className="font-mono text-[10px] text-gray-500">{d.value}</div>
              <GuardTag status={d.kind === "литерал" ? "none" : "partial"}>{d.kind}</GuardTag>
              <div className="break-all font-mono text-[10px] text-gray-600">{d.where}</div>
            </div>
          ))}
        </Grid>
      </Block>

      {(s.families as { id: string; title: string; entries: ClassEntry[] }[])
        .filter((f) => f.entries.length > 0)
        .map((f) => (
          <Block key={f.id} title={f.title} right={<CountBadge n={f.entries.length} of="вариантов" />}>
            <Grid min={210}>
              {f.entries.map((e) => (
                <ValueCard key={e.name} entry={e} preview={<SurfaceSwatch cls={e.name} />} />
              ))}
            </Grid>
          </Block>
        ))}

      <Block
        title="Поверхности из CSS, а не из классов"
        note="`card-glass`, `stat-card-glass`, `glass-panel` — фон, рамка и тень заданы правилом в dashboard.css. Такой блок не виден ни линтеру классов, ни поиску по `bg-`."
        right={<CountBadge n={(s.cssSurfaces as { name: string }[]).length} of="классов" />}
      >
        <Grid min={280}>
          {(s.cssSurfaces as { name: string; count: number; rules: CssRule[]; samples: Sample[]; more: number }[]).map((c) => (
            <div key={c.name} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="relative flex min-h-[64px] transform-gpu items-center justify-center overflow-hidden rounded-lg bg-black/30 p-2">
                <div className={`h-14 w-full rounded-xl ${c.name}`} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <Mono>.{c.name}</Mono>
                <CountBadge n={c.count} />
              </div>
              {c.rules.map((r, i) => (
                <div key={i} className="rounded-lg bg-black/30 p-2">
                  <div className="font-mono text-[10px] text-gray-400">{r.selector}</div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-gray-500">
                    {r.body}
                  </pre>
                  <div className="mt-1 font-mono text-[10px] text-gray-600">
                    {r.file}:{r.line}
                  </div>
                </div>
              ))}
              <FileList items={samplesToFiles(c.samples)} more={c.more} />
            </div>
          ))}
        </Grid>
      </Block>

      <Block
        title="Градиенты и размытие"
        right={
          <CountBadge
            n={(s.gradients as ClassEntry[]).length + (s.backdrop as ClassEntry[]).length}
            of="вариантов"
          />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {[...(s.gradients as ClassEntry[]), ...(s.backdrop as ClassEntry[])].map((e) => (
            <span
              key={e.name}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
            >
              {e.name} <span className="text-gray-500">{e.count}</span>
            </span>
          ))}
        </div>
      </Block>

      <Block
        title="Захардкоженные цвета мимо токенов"
        note={s.hardcoded.note}
        right={<CountBadge n={s.hardcoded.total} of="вхождений" />}
      >
        <div className="space-y-2">
          {(s.hardcoded.values as ColorValue[]).map((v) => (
            <div key={v.value} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="h-8 w-8 shrink-0 rounded-md border border-white/15"
                  style={v.swatch ? { background: v.swatch } : undefined}
                />
                <Mono>{v.value}</Mono>
                <CountBadge n={v.count} />
                <span className="text-[10px] text-gray-500">
                  {v.zones.map((z) => `${ZONE_SHORT[z.name as Zone]} ${z.count}`).join(" · ")}
                </span>
              </div>
              <div className="mt-2">
                <FileList
                  items={v.occurrences.map((o) => ({ file: o.file, line: o.line, extra: o.context }))}
                  more={v.more}
                />
              </div>
            </div>
          ))}
        </div>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 3. Скругления
// ---------------------------------------------------------------------------

function SectionRadii() {
  const r = S.radii
  const byKind = r.byKind as { kind: string; total: number; radii: Counted[] }[]
  const chaotic = byKind.filter((k) => k.radii.length > 1)
  return (
    <Section
      n={3}
      id="radii"
      title="Скругления"
      guard={r.guard as GuardRef}
      guards={guards}
      lead="Все встречающиеся rounded-*, с частотой и с тем, на чём именно они стоят. Нижняя таблица отвечает на вопрос, есть ли логика «размер элемента → радиус»."
    >
      <Block title="Что встречается в кабинете" right={<CountBadge n={(r.entries as ClassEntry[]).length} of="вариантов" />}>
        <Grid min={190}>
          {(r.entries as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<RadiusSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Логика «тип элемента → радиус»"
        note={`Если бы правило существовало, у каждого типа был бы один радиус. Типов с несколькими радиусами: ${chaotic.length} из ${byKind.length}.`}
      >
        <DataGrid head={["тип элемента", "всего", "радиусы, которые на нём стоят", "вердикт"]}>
          {byKind.map((k) => (
            <Row key={k.kind}>
              <Cell className="whitespace-nowrap text-white">{k.kind}</Cell>
              <Cell className="font-mono">{k.total}</Cell>
              <Cell>
                <div className="flex flex-wrap gap-1">
                  {k.radii.map((x) => (
                    <span key={x.name} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">
                      {x.name} <span className="text-gray-500">{x.count}</span>
                    </span>
                  ))}
                </div>
              </Cell>
              <Cell>
                {k.radii.length === 1 ? (
                  <GuardTag status="partial">один радиус</GuardTag>
                ) : (
                  <GuardTag status="none">{k.radii.length} радиуса</GuardTag>
                )}
              </Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block
        title="Кит для сравнения"
        note="Что кит назначает сам — это ближайшее к канону, что в проекте есть."
        right={<CountBadge n={(r.kit as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={190}>
          {(r.kit as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<RadiusSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 4. Границы и тени
// ---------------------------------------------------------------------------

function SectionBorders() {
  const b = S.borders
  const colorGroups: [string, ClassEntry[]][] = [
    ["через токены", b.colors.token],
    ["через тему shadcn", b.colors.theme],
    ["из палитры Tailwind", b.colors.palette],
    ["arbitrary мимо токенов", b.colors.arbitrary],
  ]
  return (
    <Section
      n={4}
      id="borders"
      title="Границы и тени"
      guard={b.guard as GuardRef}
      guards={guards}
      lead="Толщина, цвет и стиль рамок плюс все тени — с частотой и живыми образцами."
    >
      <Block title="Толщина и стороны" right={<CountBadge n={(b.widths as ClassEntry[]).length} of="вариантов" />}>
        <Grid min={190}>
          {(b.widths as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<BorderSwatch cls={`${e.name} border-white/25`} />} />
          ))}
        </Grid>
      </Block>

      {colorGroups
        .filter(([, entries]) => entries.length > 0)
        .map(([title, entries]) => (
          <Block key={title} title={`Цвет рамки — ${title}`} right={<CountBadge n={entries.length} of="вариантов" />}>
            <Grid min={190}>
              {entries.map((e) => (
                <ValueCard key={e.name} entry={e} preview={<BorderSwatch cls={`border ${e.name}`} />} />
              ))}
            </Grid>
          </Block>
        ))}

      <Block title="Тени в кабинете" right={<CountBadge n={(b.shadows as ClassEntry[]).length} of="вариантов" />}>
        <Grid min={210}>
          {(b.shadows as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<ShadowSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Тени в ките"
        note="Кит задаёт тени сам — и здесь их тоже несколько разных."
        right={<CountBadge n={(b.shadowsKit as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={210}>
          {(b.shadowsKit as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<ShadowSwatch cls={e.name} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Разделители и фокусные кольца"
        right={
          <CountBadge n={(b.divides as ClassEntry[]).length + (b.rings as ClassEntry[]).length} of="вариантов" />
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {[...(b.divides as ClassEntry[]), ...(b.rings as ClassEntry[]), ...(b.styles as ClassEntry[])].map((e) => (
            <span
              key={e.name}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
            >
              {e.name} <span className="text-gray-500">{e.count}</span>
            </span>
          ))}
        </div>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 5. Контейнеры
// ---------------------------------------------------------------------------

function SectionContainers() {
  const c = S.containers
  const roots = c.pageRoots.rows as { file: string; route: string | null; line: number; classText: string; tag: string; forbidden: string[] }[]
  return (
    <Section
      n={5}
      id="containers"
      title="Контейнеры"
      guard={c.guard as GuardRef}
      guards={guards}
      lead="Shell страницы, корни экранов, карточки, сетки: фактические сочетания ширины, паддингов и отступов между блоками — и сколько вариантов каждого типа реально существует."
    >
      <Block title="Shell — единственный контейнер с правом на ширину и поля" note={c.shell.note}>
        {c.shell.element && (
          <div className="rounded-xl border border-status-success/30 bg-status-success/[0.06] p-3">
            <Mono>{c.shell.element.classText}</Mono>
            <div className="mt-1 font-mono text-[10px] text-gray-500">
              {c.shell.element.file}:{c.shell.element.line}
            </div>
          </div>
        )}
      </Block>

      <Block
        title="Корни экранов"
        note={`${c.pageRoots.note} Нарушений канона сейчас: ${c.pageRoots.violations}. Ритм корня: ${(c.pageRoots.rhythm as Counted[]).map((r) => `${r.name} × ${r.count}`).join(", ")}.`}
        right={<CountBadge n={roots.length} of="корней" />}
      >
        <DataGrid head={["экран / файл", "тег", "классы корня", "рамка"]}>
          {roots.map((r, i) => (
            <Row key={`${r.file}:${r.line}:${i}`}>
              <Cell className="whitespace-nowrap">
                <div className="text-white">{r.route ?? "—"}</div>
                <div className="font-mono text-[10px] text-gray-500">
                  {r.file}:{r.line}
                </div>
              </Cell>
              <Cell className="font-mono text-[10px]">{r.tag}</Cell>
              <Cell>
                <Mono tone={r.classText ? "default" : "muted"}>{r.classText || "(без классов)"}</Mono>
              </Cell>
              <Cell>
                {r.forbidden.length > 0 ? (
                  <GuardTag status="none">{r.forbidden.join(", ")}</GuardTag>
                ) : (
                  <GuardTag status="canon">чисто</GuardTag>
                )}
              </Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block
        title="Плотность карточек"
        note={c.cardPadding.note}
        right={<CountBadge n={(c.cardPadding.combos as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={240}>
          {(c.cardPadding.combos as ClassEntry[]).map((e) => (
            <ValueCard
              key={e.name}
              entry={e}
              preview={
                <div className={`w-full rounded-xl border border-white/10 bg-white/[0.04] ${e.name}`}>
                  <div className="rounded-md border border-dashed border-emerald-400/40 bg-emerald-400/5 py-3 text-center text-[10px] text-emerald-200/70">
                    содержимое
                  </div>
                </div>
              }
            />
          ))}
        </Grid>
      </Block>

      <Block
        title="Скругление карточек"
        note={c.cardRadius.note}
        right={<CountBadge n={(c.cardRadius.combos as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={210}>
          {(c.cardRadius.combos as ClassEntry[]).map((e) => (
            <ValueCard key={e.name} entry={e} preview={<div className={`card-glass h-14 w-full ${e.name}`} />} />
          ))}
        </Grid>
      </Block>

      <Block
        title="Ритм между блоками"
        note={c.verticalRhythm.note}
        right={<CountBadge n={(c.verticalRhythm.combos as ClassEntry[]).length} of="вариантов" />}
      >
        <Grid min={210}>
          {(c.verticalRhythm.combos as ClassEntry[]).map((e) => (
            <ValueCard
              key={e.name}
              entry={e}
              preview={
                <div className={`w-full ${e.name}`}>
                  <div className="h-3 w-full rounded bg-white/15" />
                  <div className="h-3 w-full rounded bg-white/15" />
                </div>
              }
            />
          ))}
        </Grid>
      </Block>

      <Block
        title="Сетки карточек"
        note={c.grids.note}
        right={<CountBadge n={(c.grids.combos as ClassEntry[]).length} of="наборов" />}
      >
        <Grid min={280}>
          {(c.grids.combos as ClassEntry[]).map((e) => (
            <ValueCard
              key={e.name}
              entry={e}
              preview={
                <div className={`grid w-full gap-1 ${e.name}`}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-5 rounded bg-white/15" />
                  ))}
                </div>
              }
            />
          ))}
        </Grid>
      </Block>

      <Block
        title="Ограничители ширины внутри страниц"
        note={c.widths.note}
        right={<CountBadge n={(c.widths.entries as ClassEntry[]).length} of="вариантов" />}
      >
        <div className="flex flex-wrap gap-1.5">
          {(c.widths.entries as ClassEntry[]).map((e) => (
            <span
              key={e.name}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
            >
              {e.name} <span className="text-gray-500">{e.count}</span>
            </span>
          ))}
        </div>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 6. Кнопки
// ---------------------------------------------------------------------------

/**
 * Классы наведения, которые витрина показывает статично.
 *
 * Tailwind собирает только те строки, что видит в исходниках; в `ui/button.tsx`
 * они лежат с префиксом `hover:`, поэтому голого `bg-emerald-400` в сборке нет.
 * Этот литерал — единственное место, где такие классы записаны без префикса,
 * чтобы сборщик их сгенерировал. Ниже страница сверяет список с тем, что
 * действительно объявлено в ките, и ругается прямо в разметке, если кит ушёл
 * вперёд.
 */
const HOVER_PREVIEW_SAFELIST =
  "bg-accent text-accent-foreground bg-primary/90 bg-destructive/90 bg-secondary/80 " +
  "bg-emerald-400 underline border-status-danger/70 bg-status-danger/10 " +
  "border-status-success/70 bg-status-success/10 border-status-warning/60 bg-status-warning/10 " +
  "shadow-none saturate-50"

const SAFELISTED = new Set(HOVER_PREVIEW_SAFELIST.split(/\s+/).filter(Boolean))

function ButtonStates({ variant, hover, disabled }: { variant: string; hover: string[]; disabled: string[] }) {
  const v = variant as React.ComponentProps<typeof Button>["variant"]
  const missing = [...hover, ...disabled].filter((c) => !SAFELISTED.has(c))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <Button variant={v}>Действие</Button>
          <span className="text-[10px] text-gray-600">обычное</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button variant={v} className={hover.join(" ")}>
            Действие
          </Button>
          <span className="text-[10px] text-gray-600">наведение</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button variant={v} disabled className={disabled.join(" ")}>
            Действие
          </Button>
          <span className="text-[10px] text-gray-600">выключено</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button variant={v} disabled>
            <Spinner size="sm" className="mr-1" />
            Сохранение…
          </Button>
          <span className="text-[10px] text-gray-600">загрузка</span>
        </div>
      </div>
      {missing.length > 0 && (
        <p className="text-[10px] text-amber-300">
          В ките появились классы состояния, которых нет в списке предпросмотра страницы: {missing.join(", ")}
        </p>
      )}
    </div>
  )
}

function SectionButtons() {
  const b = S.buttons
  const kit = b.kit as NonNullable<Cva>
  const usageByVariant = new Map((b.usage.byVariant as Counted[]).map((v) => [v.name, v.count]))
  return (
    <Section
      n={6}
      id="buttons"
      title="Кнопки"
      guard={b.guard as GuardRef}
      guards={guards}
      lead={`Все варианты ui/button — живьём, во всех состояниях — плюс все места, где кнопка собрана мимо кита. Всего вызовов Button в кабинете: ${b.usage.total}.`}
    >
      <Block
        title="Варианты кита"
        note={`Объявлены одним cva в ${kit.file}. По умолчанию — variant=${kit.defaults.variant}, size=${kit.defaults.size}.`}
        right={<CountBadge n={kit.variants.length} of="вариантов" />}
      >
        <div className="space-y-3">
          {kit.variants.map((v) => {
            const used = usageByVariant.get(v.name) ?? 0
            return (
              <div key={v.name} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Mono>variant=&quot;{v.name}&quot;</Mono>
                  <CountBadge n={used} />
                  {used === 0 && <GuardTag status="none">не используется</GuardTag>}
                  <span className="font-mono text-[10px] text-gray-600">
                    {kit.file}:{v.line}
                  </span>
                </div>
                <ButtonStates variant={v.name} hover={v.hoverPreview} disabled={v.disabledPreview} />
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-gray-600 hover:text-gray-300">
                    <span className="group-open:hidden">▸ классы варианта</span>
                    <span className="hidden group-open:inline">▾ классы варианта</span>
                  </summary>
                  <p className="mt-1 break-all font-mono text-[10px] leading-snug text-gray-500">{v.classes}</p>
                </details>
                <div className="mt-2">
                  <FileList items={samplesToFiles((b.usage.samplesByVariant[v.name] ?? []) as Sample[])} />
                </div>
              </div>
            )
          })}
        </div>
      </Block>

      <Block title="Размеры кита" right={<CountBadge n={kit.sizes.length} of="размеров" />}>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {kit.sizes.map((sz) => (
            <div key={sz.name} className="flex flex-col items-center gap-1">
              <Button size={sz.name as React.ComponentProps<typeof Button>["size"]}>
                {sz.name === "icon" ? <span className="material-symbols-outlined text-base">tune</span> : "Действие"}
              </Button>
              <Mono>size={sz.name}</Mono>
              <span className="text-[10px] text-gray-600">
                {(b.usage.bySize as Counted[]).find((x) => x.name === sz.name)?.count ?? 0}×
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 max-w-3xl break-all font-mono text-[10px] leading-snug text-gray-600">
          база: {kit.base}
        </p>
      </Block>

      <Block
        title="Кнопки мимо кита"
        note={b.offKit.note}
        right={<CountBadge n={b.offKit.total} of="мест" />}
      >
        {b.offKit.total === 0 ? (
          <p className="text-xs text-gray-500">Ни одного.</p>
        ) : (
          <div className="space-y-2">
            {(b.offKit.items as (Sample & { why: string; guarded: boolean })[]).map((it, i) => (
              <div key={`${it.file}:${it.line}:${i}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Mono>&lt;{it.tag}&gt;</Mono>
                  <span className="text-[11px] text-gray-400">{it.why}</span>
                  <GuardTag status={it.guarded ? "partial" : "none"}>
                    {it.guarded ? "линтер видит" : "сторожа нет"}
                  </GuardTag>
                  <span className="font-mono text-[10px] text-gray-600">
                    {it.file}:{it.line}
                  </span>
                </div>
                <div className="rounded-lg bg-black/30 p-3">
                  <span className={it.classText}>Образец</span>
                </div>
                <p className="mt-2 break-all font-mono text-[10px] leading-snug text-gray-600">{it.classText}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-500">
          Для сравнения: raw-кнопок вне кабинета (лендинг, формы) — {b.offKit.outsideCabinet}. Скоуп overhaul их не
          покрывает.
        </p>
      </Block>

      <Block
        title="Другие cva-компоненты с вариантами"
        note="Тулбар, бейдж и баннер объявляют свои варианты тем же способом — но правило выбора варианта нигде не записано."
      >
        <Grid min={280}>
          {(["toolbar", "badge", "banner"] as const).map((key) => {
            const cva = b.other[key] as Cva
            if (!cva) return null
            return (
              <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <Mono>{cva.file}</Mono>
                <div className="mt-2 flex flex-wrap gap-1">
                  {cva.variants.map((v) => (
                    <span key={v.name} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">
                      {v.name}
                    </span>
                  ))}
                </div>
                {cva.sizes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cva.sizes.map((v) => (
                      <span key={v.name} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                        size={v.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </Grid>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 7. Оверлеи
// ---------------------------------------------------------------------------

function OverlayPreview({ part }: { part: OverlayPart }) {
  const f = part.facets
  const visual = [...f.background, ...f.backdrop, ...f.radius, ...f.border, ...f.shadow, ...f.padding].join(" ")
  return (
    <div className="rounded-lg bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%),linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-4">
      <div className={visual || "border border-dashed border-white/20 p-4"}>
        <div className="text-xs font-semibold text-white">Заголовок</div>
        <div className="mt-1 text-[11px] text-gray-400">Строка содержимого</div>
      </div>
    </div>
  )
}

function SectionOverlays() {
  const o = S.overlays
  const summary = o.backgroundSummary as { cls: string; css: string; declaredIn: string | null; users: string[] }[]
  return (
    <Section
      n={7}
      id="overlays"
      title="Оверлеи"
      guard={o.guard as GuardRef}
      guards={guards}
      lead={o.note}
    >
      <Block
        title="Откуда берётся фон выпадающих"
        note="Слева — класс, который стоит на примитиве; справа — во что он разворачивается и где объявлено это значение. Разных фонов панелей столько, сколько строк в таблице."
        right={<CountBadge n={summary.length} of="фонов" />}
      >
        <DataGrid head={["класс", "образец", "реальное значение", "объявлено в", "кто использует"]}>
          {summary.map((s) => (
            <Row key={s.cls}>
              <Cell className="whitespace-nowrap">
                <Mono>{s.cls}</Mono>
              </Cell>
              <Cell>
                <div className="h-6 w-16 rounded border border-white/15" style={{ background: s.css }} />
              </Cell>
              <Cell className="whitespace-nowrap font-mono text-[10px]">{s.css}</Cell>
              <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-500">
                {s.declaredIn ?? "палитра Tailwind, не токен"}
              </Cell>
              <Cell className="text-[11px]">{[...new Set(s.users)].join(", ")}</Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block title="Примитивы кита целиком" right={<CountBadge n={(o.components as unknown[]).length} of="компонентов" />}>
        <div className="space-y-3">
          {(o.components as { title: string; file: string; parts: OverlayPart[] }[]).map((comp) => (
            <div key={comp.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h4 className="text-sm font-semibold text-white">{comp.title}</h4>
                <span className="font-mono text-[10px] text-gray-600">{comp.file}</span>
              </div>
              <Grid min={260}>
                {comp.parts.map((p, i) => (
                  <div key={`${p.tag}-${i}`} className="space-y-2">
                    <OverlayPreview part={p} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">{p.role}</span>
                      <Mono tone="muted">{p.tag}</Mono>
                    </div>
                    <dl className="space-y-0.5 text-[10px] text-gray-500">
                      {(
                        [
                          ["фон", p.facets.background],
                          ["размытие", p.facets.backdrop],
                          ["радиус", p.facets.radius],
                          ["рамка", p.facets.border],
                          ["тень", p.facets.shadow],
                          ["размер", p.facets.size],
                          ["паддинг", p.facets.padding],
                          ["слой", p.facets.layer],
                        ] as [string, string[]][]
                      )
                        .filter(([, v]) => v.length > 0)
                        .map(([label, v]) => (
                          <div key={label} className="flex gap-2">
                            <dt className="w-16 shrink-0 uppercase tracking-wider text-gray-600">{label}</dt>
                            <dd className="min-w-0 break-all font-mono text-gray-400">{v.join(" ")}</dd>
                          </div>
                        ))}
                    </dl>
                    {p.resolvedBackground.map((r) => (
                      <div key={r.cls} className="rounded-lg bg-black/30 p-2 text-[10px] leading-snug text-gray-500">
                        <span className="text-gray-300">{r.css}</span> — {r.via}
                        {r.declaredIn && <span className="block font-mono text-gray-600">{r.declaredIn}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </Grid>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="Как оверлеи вызываются на экранах"
        note="Столбец «переопределено» — сколько вызовов дописывают компоненту свой фон, радиус, рамку, тень или ширину поверх китовых."
      >
        <DataGrid head={["компонент", "вызовов", "переопределено", "какими классами"]}>
          {(o.usage as { tag: string; count: number; overridden: number; overrides: ClassEntry[] }[]).map((u) => (
            <Row key={u.tag}>
              <Cell className="whitespace-nowrap text-white">{u.tag}</Cell>
              <Cell className="font-mono">{u.count}</Cell>
              <Cell>
                {u.overridden > 0 ? (
                  <GuardTag status="none">{u.overridden}</GuardTag>
                ) : (
                  <GuardTag status="canon">0</GuardTag>
                )}
              </Cell>
              <Cell>
                <div className="space-y-1">
                  {u.overrides.map((ov) => (
                    <div key={ov.name}>
                      <Mono>{ov.name}</Mono> <span className="text-[10px] text-gray-500">× {ov.count}</span>
                      <FileList items={samplesToFiles(ov.samples)} more={ov.more} />
                    </div>
                  ))}
                </div>
              </Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 8. Шапки страниц
// ---------------------------------------------------------------------------

type HeaderTableRow =
  | { kind: "header"; route: string; row: HeaderRow }
  | { kind: "none"; route: string; file: string; reason: string }

function ActionsCell({ actions }: { actions: HeaderRow["actions"] }) {
  if (actions.length === 0) return <span className="text-gray-600">—</span>
  return (
    <ol className="space-y-1">
      {actions.map((a, i) => (
        <li key={i} className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[10px] text-gray-600">{i + 1}.</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-100">{a.component}</span>
          {a.variant && <span className="font-mono text-[10px] text-emerald-300">variant={a.variant}</span>}
          {a.size && <span className="font-mono text-[10px] text-gray-500">size={a.size}</span>}
          {a.text && <span className="text-[10px] text-gray-400">«{a.text}»</span>}
          {a.wrapped && <span className="text-[10px] text-amber-300/70">в обёртке</span>}
          {a.conditional && <span className="text-[10px] text-gray-600">под условием</span>}
        </li>
      ))}
    </ol>
  )
}

function SectionHeaders() {
  const h = S.headers
  const rows = h.rows as HeaderRow[]
  const missing = h.routesWithoutHeader as { route: string; file: string; reason: string }[]
  const table: HeaderTableRow[] = [
    ...rows.flatMap((row) =>
      (row.routes.length > 0 ? row.routes : ["—"]).map((route) => ({ kind: "header" as const, route, row }))
    ),
    ...missing.map((m) => ({ kind: "none" as const, route: m.route, file: m.file, reason: m.reason })),
  ].sort((a, b) => a.route.localeCompare(b.route))

  return (
    <Section
      n={8}
      id="headers"
      title="Шапки страниц"
      guard={h.guard as GuardRef}
      guards={guards}
      lead={`Все ${h.routesTotal} роутов обоих кабинетов: что стоит в слоте actions, в каком порядке, сколько кнопок, есть ли крошка и подзаголовок. Сама шапка канонизирована; её содержимое — нет, и таблица показывает это построчно.`}
    >
      <div className="flex flex-wrap gap-2">
        <Metric label="роутов всего" value={h.routesTotal} />
        <Metric label="c PageHeader" value={rows.length} hint="один компонент может обслуживать два роута" />
        <Metric label="без шапки" value={missing.length} />
        <Metric
          label="вариантов первой кнопки"
          value={(h.stats.byFirstAction as Counted[]).length}
          hint="столько разных вещей стоит на первом месте в actions"
        />
        <Metric label="подписей возврата" value={(h.stats.byBackLabel as Counted[]).length} hint="B-05 бэклога" />
      </div>

      <Block title="Распределение" note="Числа, ради которых таблица и строилась.">
        <Grid min={260}>
          {(
            [
              ["Сколько действий в слоте", h.stats.byActionsCount],
              ["Что стоит первым", h.stats.byFirstAction],
              ["Возврат на уровень выше", h.stats.byBack],
              ["Подпись возврата", h.stats.byBackLabel],
              ["Подзаголовок", h.stats.bySubtitle],
              ["Начертание заголовка", h.stats.byTitleStyle],
            ] as [string, Counted[]][]
          ).map(([title, items]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-gray-400">{title}</div>
              <ul className="space-y-1">
                {items.map((i) => (
                  <li key={i.name} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="min-w-0 break-words text-gray-300">{i.name}</span>
                    <span className="shrink-0 font-mono text-gray-500">{i.count}</span>
                  </li>
                ))}
              </ul>
              {items.length > 1 && (
                <div className="mt-2">
                  <GuardTag status="none">вариаций {items.length}, канона нет</GuardTag>
                </div>
              )}
            </div>
          ))}
        </Grid>
      </Block>

      <Block
        title="Экран за экраном"
        note="Строка на каждый роут. Один и тот же компонент, обслуживающий два роута, показан дважды — это то, что видит пользователь."
      >
        <DataGrid head={["роут", "заголовок", "крошка", "подзаголовок", "actions", "прочее", "файл"]}>
          {table.map((t, i) =>
            t.kind === "none" ? (
              <Row key={`${t.route}-${i}`}>
                <Cell className="whitespace-nowrap font-mono text-[11px] text-gray-500">{t.route}</Cell>
                <Cell className="text-gray-600" >—</Cell>
                <Cell className="text-gray-600">—</Cell>
                <Cell className="text-gray-600">—</Cell>
                <Cell>
                  <GuardTag status="none">без PageHeader</GuardTag>
                  <div className="mt-1 text-[10px] text-gray-500">{t.reason}</div>
                </Cell>
                <Cell />
                <Cell className="font-mono text-[10px] text-gray-600">{t.file}</Cell>
              </Row>
            ) : (
              <Row key={`${t.route}-${i}`}>
                <Cell className="whitespace-nowrap font-mono text-[11px] text-white">{t.route}</Cell>
                <Cell className="max-w-[180px] break-words text-[11px]">{t.row.title}</Cell>
                <Cell className="text-[11px]">
                  {t.row.back === null ? (
                    <span className="text-gray-600">нет</span>
                  ) : t.row.back === "breadcrumbs" ? (
                    <span className="text-gray-300">breadcrumbs · {t.row.breadcrumbCount ?? "?"}</span>
                  ) : (
                    <span className="text-gray-300">«{t.row.backLabel ?? "К списку"}»</span>
                  )}
                </Cell>
                <Cell className="text-[11px]">
                  {t.row.hasSubtitle ? <span className="text-gray-300">{t.row.subtitleKind}</span> : <span className="text-gray-600">нет</span>}
                </Cell>
                <Cell>
                  <ActionsCell actions={t.row.actions} />
                </Cell>
                <Cell className="text-[10px] text-gray-500">
                  {t.row.titleStyle !== "section (по умолчанию)" && <div>titleStyle={t.row.titleStyle}</div>}
                  {t.row.titleBadge && <div>titleBadge</div>}
                  {t.row.meta && <div>meta</div>}
                  {t.row.rowClassName && <div className="break-all">rowClassName</div>}
                  {t.row.actionsClassName && <div className="break-all">actionsClassName</div>}
                </Cell>
                <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-600">
                  {t.row.file}:{t.row.line}
                </Cell>
              </Row>
            )
          )}
        </DataGrid>
      </Block>

      <Block title="Что канонизировано в самой шапке" note={h.component.note}>
        <div className="rounded-xl border border-status-success/30 bg-status-success/[0.06] p-3">
          <Mono>{h.component.file}</Mono>
          <div className="mt-2 flex flex-wrap gap-1">
            {(h.component.props as string[]).map((p) => (
              <span key={p} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">
                {p}
              </span>
            ))}
          </div>
        </div>
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 9. Состояния
// ---------------------------------------------------------------------------

function SectionStates() {
  const st = S.states
  const layouts = st.loading.layouts.items as LoadingGroup[]
  const inline = st.loading.inline.items as LoadingGroup[]
  return (
    <Section
      n={9}
      id="states"
      title="Состояния"
      guard={st.guard as GuardRef}
      guards={guards}
      lead="Пустые состояния, загрузка и ошибки — сколько поколений каждого реально живёт в кабинете."
    >
      <div className="flex flex-wrap gap-2">
        <Metric label="EmptyState из кита" value={st.empty.kit.count} />
        <Metric label="пустых состояний руками" value={st.empty.handRolled.count} hint="B-04 бэклога" />
        <Metric label="раскладок загрузки экрана" value={st.loading.layouts.variants} hint="B-03 бэклога" />
        <Metric
          label="loading.tsx"
          value={`${(st.loading.loadingRoutes.files as string[]).length} из ${st.loading.loadingRoutes.of}`}
          hint="скелетон до гидрации есть только у них"
        />
        <Metric label="скелетонов в разметке" value={st.loading.skeleton.count} />
        <Metric label="баннеров" value={st.errors.banners.count} />
      </div>

      <Block
        title="Загрузка вместо экрана"
        note={st.loading.layouts.note}
        right={<CountBadge n={layouts.length} of="раскладок" />}
      >
        <Grid min={260}>
          {layouts.map((l) => (
            <div key={l.classText} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="relative min-h-[96px] transform-gpu overflow-hidden rounded-lg bg-black/30">
                <div className={l.classText === "(без классов)" ? "" : l.classText}>
                  <Spinner size="md" />
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <Mono>{l.classText}</Mono>
                <CountBadge n={l.count} />
              </div>
              <FileList
                items={l.samples.map((s) => ({ file: s.file, line: s.line, extra: s.inner }))}
                more={l.more}
              />
            </div>
          ))}
        </Grid>
      </Block>

      <Block
        title="Спиннер внутри элемента"
        note={st.loading.inline.note}
        right={<CountBadge n={inline.length} of="обрамлений" />}
      >
        <div className="space-y-1">
          {inline.map((l) => (
            <div key={l.classText} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
              <div className="flex items-start justify-between gap-2">
                <Mono tone="muted">{l.classText}</Mono>
                <CountBadge n={l.count} />
              </div>
              <FileList items={l.samples.map((s) => ({ file: s.file, line: s.line, extra: s.inner }))} more={l.more} />
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="Скелетоны"
        note="Пресеты из кита. Их применение не обязательно и ничем не проверяется — соседний экран на загрузке может показать спиннер или ноль."
      >
        <div className="flex flex-wrap gap-1.5">
          {(st.loading.skeleton.byComponent as Counted[]).map((c) => (
            <span
              key={c.name}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
            >
              {c.name} <span className="text-gray-500">{c.count}</span>
            </span>
          ))}
        </div>
        <div className="mt-2">
          <FileList items={samplesToFiles(st.loading.skeleton.samples as Sample[])} />
        </div>
      </Block>

      <Block
        title="Пустые состояния из кита"
        note="Один компонент, но набор пропов у вызовов разный — иконка и действие есть не везде."
        right={<CountBadge n={st.empty.kit.count} of="мест" />}
      >
        <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-[10px] uppercase tracking-widest text-gray-600">образец кита</div>
          <div className="mt-2 rounded-lg border border-white/5 p-2">
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-600">inbox</span>
              <div className="text-sm text-gray-300">Пока ничего нет</div>
              <div className="max-w-xs text-xs text-gray-500">Описание из пропа description</div>
              <Button variant="outline" size="sm">
                Одно действие
              </Button>
            </div>
          </div>
        </div>
        <DataGrid head={["файл", "пропы"]}>
          {(st.empty.kit.items as (Sample & { props: string[] })[]).map((e, i) => (
            <Row key={`${e.file}:${e.line}:${i}`}>
              <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-400">
                {e.file}:{e.line}
              </Cell>
              <Cell>
                <div className="flex flex-wrap gap-1">
                  {e.props.map((p) => (
                    <span key={p} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">
                      {p}
                    </span>
                  ))}
                </div>
              </Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block
        title="Пустые состояния и «не найдено» мимо кита"
        note={st.empty.handRolled.note}
        right={<CountBadge n={st.empty.handRolled.count} of="мест" />}
      >
        <DataGrid head={["файл", "чем нарисовано", "текст", "классы"]}>
          {(st.empty.handRolled.items as EmptyPhrase[]).map((e, i) => (
            <Row key={`${e.file}:${e.line}:${i}`}>
              <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-400">
                {e.file}:{e.line}
              </Cell>
              <Cell className="whitespace-nowrap">
                <Mono>&lt;{e.tag}&gt;</Mono>
              </Cell>
              <Cell className="text-[11px]">«{e.text}»</Cell>
              <Cell className="break-all font-mono text-[10px] text-gray-500">{e.classText || "—"}</Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block
        title="Та же фраза, но через Banner"
        note={st.empty.viaOtherKit.note}
        right={<CountBadge n={st.empty.viaOtherKit.count} of="мест" />}
      >
        <DataGrid head={["файл", "чем нарисовано", "текст"]}>
          {(st.empty.viaOtherKit.items as EmptyPhrase[]).map((e, i) => (
            <Row key={`${e.file}:${e.line}:${i}`}>
              <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-400">
                {e.file}:{e.line}
              </Cell>
              <Cell className="whitespace-nowrap">
                <Mono>&lt;{e.tag}&gt;</Mono>
              </Cell>
              <Cell className="text-[11px]">«{e.text}»</Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      <Block
        title="Ошибки"
        note="Баннеры кита по вариантам плюс все места, где текст ошибки выводится как есть."
        right={<CountBadge n={st.errors.mentions.count} of="упоминаний" />}
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(st.errors.banners.byVariant as Counted[]).map((c) => (
            <span
              key={c.name}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-gray-300"
            >
              {c.name} <span className="text-gray-500">{c.count}</span>
            </span>
          ))}
        </div>
        <FileList
          items={(st.errors.mentions.items as Occurrence[]).map((e) => ({
            file: e.file,
            line: e.line,
            extra: e.context,
          }))}
          more={st.errors.mentions.more}
          label="места вывода ошибок"
        />
      </Block>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// 10. Отклонения
// ---------------------------------------------------------------------------

function SectionDeviations() {
  const d = S.deviations
  const items = d.items as Deviation[]
  const total = items.reduce((n, x) => n + x.count, 0)
  return (
    <Section
      n={10}
      id="deviations"
      title="Отклонения"
      guard={d.guard as GuardRef}
      guards={guards}
      lead={`Всё, что мимо токенов и мимо кита: ${total} вхождений в ${items.length} группах. Рядом с каждой группой — видит ли её хоть один сторож.`}
    >
      <Block title="Сводка">
        <DataGrid head={["группа", "вхождений", "статус охраны"]}>
          {items.map((x) => (
            <Row key={x.id}>
              <Cell>
                <a href={`#dev-${x.id}`} className="text-white underline-offset-4 hover:underline">
                  {x.title}
                </a>
              </Cell>
              <Cell className="font-mono">{x.count}</Cell>
              <Cell>
                <GuardTag status={x.guard.status} />
              </Cell>
            </Row>
          ))}
        </DataGrid>
      </Block>

      {items.map((x) => (
        <div key={x.id} id={`dev-${x.id}`} className="scroll-mt-4">
          <Block title={x.title} note={x.what} right={<CountBadge n={x.count} of="вхождений" />}>
            <div className="mb-2">
              <GuardBadge guard={x.guard} guards={guards} />
            </div>
            {x.count === 0 ? (
              <p className="text-xs text-emerald-300">Ни одного вхождения.</p>
            ) : (
              <DataGrid head={["файл", "зона", "значение", "контекст"]}>
                {x.items.map((it, i) => (
                  <Row key={`${it.file}:${it.line}:${i}`}>
                    <Cell className="whitespace-nowrap font-mono text-[10px] text-gray-400">
                      {it.file}:{it.line}
                    </Cell>
                    <Cell className="whitespace-nowrap text-[10px] text-gray-500">{ZONE_SHORT[it.zone]}</Cell>
                    <Cell className="whitespace-nowrap">
                      <Mono>{it.value}</Mono>
                    </Cell>
                    <Cell className="break-all font-mono text-[10px] text-gray-500">{it.context}</Cell>
                  </Row>
                ))}
                {x.more > 0 && (
                  <Row>
                    <Cell className="text-[10px] text-gray-600">…и ещё {x.more}</Cell>
                    <Cell />
                    <Cell />
                    <Cell />
                  </Row>
                )}
              </DataGrid>
            )}
          </Block>
        </div>
      ))}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Страница
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <nav className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0 lg:self-start">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-gray-600">Секции</div>
      <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {SECTIONS.map((s, i) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className="flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="font-mono text-[10px] text-gray-600">{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </a>
          </li>
        ))}
        <li className="shrink-0">
          <a
            href="#guards"
            className="flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span className="font-mono text-[10px] text-gray-600">••</span>
            Сторожа
          </a>
        </li>
      </ol>
    </nav>
  )
}

function GuardsBlock() {
  return (
    // Тот же запрет на <section>, что и в parts.tsx.
    <div id="guards" className="scroll-mt-4 space-y-4 border-t border-white/10 pt-10">
      <div>
        <h2 className="text-xl font-bold uppercase tracking-tight text-white md:text-2xl">Сторожа</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
          Всё, что в проекте реально проверяется автоматически. Пометки «канон, охраняется» в секциях выше ссылаются
          сюда. Важное: запреты ESLint действуют только на <Mono>app/dashboard/**</Mono> — компоненты кабинета в{" "}
          <Mono>components/**</Mono> под них не попадают.
        </p>
      </div>
      <DataGrid head={["сторож", "команда", "что стережёт", "скоуп", "файлов внутри", "файлов снаружи"]}>
        {guards.map((g) => (
          <Row key={g.id}>
            <Cell className="whitespace-nowrap text-white">{g.title}</Cell>
            <Cell className="whitespace-nowrap">
              <Mono>{g.command}</Mono>
              <div className="font-mono text-[10px] text-gray-600">{g.source}</div>
            </Cell>
            <Cell className="min-w-[220px] text-[11px]">{g.rule}</Cell>
            <Cell className="min-w-[200px] font-mono text-[10px] text-gray-500">
              {g.scope}
              {g.scopeDetail && (
                <details className="group mt-1">
                  <summary className="cursor-pointer list-none uppercase tracking-widest text-gray-600 hover:text-gray-300">
                    <span className="group-open:hidden">▸ какие</span>
                    <span className="hidden group-open:inline">▾ какие</span>
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {g.scopeDetail.map((p) => (
                      <li key={p} className="break-all text-gray-500">
                        {p}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Cell>
            <Cell className="font-mono text-emerald-300">{g.filesCovered}</Cell>
            <Cell className="font-mono text-amber-300">{g.filesOutside}</Cell>
          </Row>
        ))}
      </DataGrid>
    </div>
  )
}

export default function DesignMapPage() {
  const scope = map.meta.scope
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 border-b border-white/10 pb-6">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-white md:text-4xl">
          Карта фактического дизайна
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400">
          Не то, что задумано китом, — то, что реально стоит в коде кабинетов, со всеми вариациями и отклонениями.
          Карта собирается скриптом из исходников, поэтому не устаревает: <Mono>{map.meta.command}</Mono>.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-500">{map.meta.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Metric label="файлов просканировано" value={scope.files} />
          <Metric label="JSX-элементов" value={scope.jsxElements} />
          <Metric label="роутов кабинетов" value={scope.routes} />
          {(scope.byZone as { name: string; count: number; title: string }[]).map((z) => (
            <Metric key={z.name} label={z.title} value={z.count} />
          ))}
        </div>
        <div className="mt-3 font-mono text-[10px] text-gray-600">
          источник: {map.meta.generatedBy}
          {map.meta.gitSha ? ` · срез на коммите ${map.meta.gitSha}` : ""}
        </div>
      </header>

      <div className="lg:flex lg:gap-10">
        <Nav />
        <div className="min-w-0 flex-1 space-y-10">
          <SectionTokens />
          <SectionSurfaces />
          <SectionRadii />
          <SectionBorders />
          <SectionContainers />
          <SectionButtons />
          <SectionOverlays />
          <SectionHeaders />
          <SectionStates />
          <SectionDeviations />
          <GuardsBlock />
        </div>
      </div>
    </div>
  )
}
