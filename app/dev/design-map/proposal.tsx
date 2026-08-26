/**
 * Секция «Предложение» карты — /dev/design-map#proposal.
 *
 * Рядом с фактическим состоянием (секции 01–10 ниже) показывает предлагаемый
 * канон из [docs/design-system-spec.md](../../../docs/design-system-spec.md)
 * живыми образцами: слева «сейчас» — настоящая вёрстка теми же классами, что
 * стоят в коде, справа «станет» — теми, что предлагает спецификация. Чтобы
 * владелец сравнивал глазами, а не по описанию.
 *
 * Числа «сколько сейчас» берутся из того же `design-map.json`, что и остальная
 * карта: пересобрал `pnpm design:map` — цифры в предложении обновились сами.
 * Руками здесь вписаны только значения канона — они и есть предмет решения.
 *
 * Ничего в приложении эта секция не меняет: это витрина, а не реализация.
 */
import * as React from "react"

import raw from "./design-map.json"
import { Mono } from "./parts"

const map = raw as unknown as Record<string, any>
const S = map.sections

// ---------------------------------------------------------------------------
// Числа «сейчас» — считаются из карты, а не вписаны
// ---------------------------------------------------------------------------

/** Сколько разных тёмных значений задают фон: токены + переменные темы + литералы. */
const DARK_VALUES =
  S.surfaces.darkInventory.tokens.length +
  S.surfaces.darkInventory.themeVars.length +
  S.surfaces.darkInventory.literals.length

const BORDER_COLORS = Object.values(S.borders.colors as Record<string, unknown[]>).reduce(
  (n, list) => n + list.length,
  0
)

const SHADOWS = S.borders.shadows.length + S.borders.shadowsKit.length

/** Обрамления EmptyState: сколько разных classText стоит на вызовах. */
const EMPTY_FRAMES = new Set(
  (S.states.empty.kit.items as { classText: string }[]).map((i) => i.classText)
).size

/** Кнопки, ставшие primary по умолчанию cva, а не по решению. */
const ACCIDENTAL_PRIMARY =
  (S.buttons.usage.byVariant as { name: string; count: number }[]).find((v) =>
    v.name.startsWith("default")
  )?.count ?? 0

const LUCIDE_FILES =
  (S.deviations.items as { id: string; count: number }[]).find((d) => d.id === "lucide")?.count ?? 0

// ---------------------------------------------------------------------------
// Каркас
// ---------------------------------------------------------------------------

/** Одна половина сравнения. `tone` красит только рамку и подпись, не образец. */
function Pane({
  tone,
  label,
  note,
  children,
}: {
  tone: "now" | "next"
  label: string
  note?: string
  children: React.ReactNode
}) {
  const box =
    tone === "now"
      ? "border-status-warning/30 bg-status-warning/[0.03]"
      : "border-status-success/30 bg-status-success/[0.03]"
  const text = tone === "now" ? "text-amber-200" : "text-emerald-300"
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-3 ${box}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${text}`}>{label}</span>
        {note && <span className="font-mono text-[10px] text-gray-500">{note}</span>}
      </div>
      {/*
        `transform-gpu`: часть образцов позиционирована абсолютно (подложка
        оверлея, накладка загрузки). Трансформация делает эту рамку системой
        координат, и образец остаётся внутри своей половины.
      */}
      <div className="min-w-0 transform-gpu">{children}</div>
    </div>
  )
}

/** Одно измерение: заголовок, вывод, сравнение, цена. */
function Dim({
  id,
  n,
  title,
  spec,
  now,
  next,
  nowLabel,
  nextLabel,
  why,
  price,
  stack = false,
}: {
  id: string
  n: string
  title: string
  spec: string
  now: React.ReactNode
  next: React.ReactNode
  nowLabel: string
  nextLabel: string
  why: React.ReactNode
  price: string
  /**
   * Половины друг под другом, а не рядом. Нужно там, где образец сам зависит
   * от ширины: брейкпоинты Tailwind считаются от вьюпорта, а не от контейнера,
   * поэтому сетка в узкой половине показала бы четыре колонки в 290px и врала
   * бы про то, что предлагается.
   */
  stack?: boolean
}) {
  return (
    <div id={`proposal-${id}`} className="scroll-mt-4 space-y-3 border-t border-white/[0.07] pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] tracking-widest text-gray-600">{n}</span>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-200">{title}</h3>
        <span className="font-mono text-[10px] text-gray-600">{spec}</span>
      </div>
      <div className={`grid gap-3 ${stack ? "" : "md:grid-cols-2"}`}>
        <Pane tone="now" label="сейчас" note={nowLabel}>
          {now}
        </Pane>
        <Pane tone="next" label="станет" note={nextLabel}>
          {next}
        </Pane>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-gray-400">{why}</p>
      <p className="max-w-3xl font-mono text-[10px] leading-relaxed text-gray-600">цена: {price}</p>
    </div>
  )
}

/** Ряд образцов с подписями под каждым. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>
}

function Item({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      {children}
      <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500">{caption}</span>
    </div>
  )
}

/** Условная «кнопка»: только форма и заливка, без ui/button — это образец. */
function FakeBtn({ cls, children = "Действие" }: { cls: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex h-10 items-center px-4 text-xs font-medium ${cls}`}>{children}</span>
  )
}

// ---------------------------------------------------------------------------
// Секция
// ---------------------------------------------------------------------------

export function SectionProposal() {
  return (
    // Не <section>: globals.css лендинга вешает на голый section флекс с
    // центровкой — витрина от этого складывается. Тот же приём, что в parts.tsx.
    <div id="proposal" className="scroll-mt-4 space-y-6 rounded-2xl border border-status-success/25 bg-status-success/[0.02] p-4 md:p-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs tracking-widest text-emerald-500">ПР</span>
          <h2 className="text-xl font-bold uppercase tracking-tight text-white md:text-2xl">Предложение</h2>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-400">
          Слева — как это выглядит <span className="text-amber-200">сейчас</span>, теми же классами, что стоят в коде.
          Справа — как будет <span className="text-emerald-300">по канону</span>. Оба столбца живые: это вёрстка, а не
          картинки. Числа «сколько сейчас» берутся из того же среза, что и вся карта.
        </p>
        <p className="max-w-3xl text-xs leading-relaxed text-gray-500">
          Обоснование каждого решения, полная цена и сторож — в{" "}
          <Mono>docs/design-system-spec.md</Mono>. Здесь только «до / после».
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400">
          <span className="font-semibold uppercase tracking-widest text-gray-300">Правило вывода.</span> Канон нигде не
          придуман заново: в каждом измерении берётся значение, которое уже преобладает, и отбрасывается хвост.
          Визуальный язык — тёмная тема, зелёный акцент, плотные таблицы, текущая типографика — сохраняется целиком.
        </div>
      </div>

      <div className="space-y-6">
        {/* 1 ------------------------------------------------------------- */}
        <Dim
          id="radii"
          n="01"
          title="Скругления"
          spec="§1 спецификации"
          nowLabel={`${S.radii.entries.length} написаний · у кнопки 4 радиуса`}
          nextLabel="3 ступени + круг"
          now={
            <Row>
              <Item caption="rounded-lg ×56">
                <FakeBtn cls="rounded-lg border border-white/15 text-gray-300" />
              </Item>
              <Item caption="rounded-xl ×3">
                <FakeBtn cls="rounded-xl border border-white/15 text-gray-300" />
              </Item>
              <Item caption="rounded-full ×3">
                <FakeBtn cls="rounded-full border border-white/15 text-gray-300" />
              </Item>
              <Item caption="rounded-none ×1">
                <FakeBtn cls="rounded-none border border-white/15 text-gray-300" />
              </Item>
            </Row>
          }
          next={
            <Row>
              <Item caption="контрол · lg">
                <FakeBtn cls="rounded-lg border border-white/10 text-gray-300" />
              </Item>
              <Item caption="блок · xl">
                <div className="flex h-10 w-24 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[10px] text-gray-500">
                  баннер
                </div>
              </Item>
              <Item caption="карточка · 2xl">
                <div className="flex h-10 w-24 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-[10px] text-gray-500">
                  карточка
                </div>
              </Item>
              <Item caption="круг · full">
                <div className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.03]" />
              </Item>
            </Row>
          }
          why={
            <>
              Радиус — функция <span className="text-gray-200">размера</span>, а не смысла: чем крупнее элемент, тем
              больше нужен радиус. Каждая ступень уже доминирует в своём классе — 56 кнопок из 63 уже{" "}
              <Mono>rounded-lg</Mono>, 61 карточка из 65 уже <Mono>rounded-2xl</Mono>. Канон только запрещает хвост.
            </>
          }
          price="~82 правки в ~35 файлах, из них 56 — удаление класса, ставшего мёртвым после правки ui/button"
        />

        {/* 2 ------------------------------------------------------------- */}
        <Dim
          id="surfaces"
          n="02"
          title="Фоны и поверхности"
          spec="§2 спецификации"
          nowLabel={`${DARK_VALUES} тёмных значений`}
          nextLabel="4 слоя"
          now={
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {[
                  ...(S.surfaces.darkInventory.tokens as { name: string; swatch: string }[]),
                  ...(S.surfaces.darkInventory.themeVars as { name: string; swatch: string }[]),
                ].map((v) => (
                  <div
                    key={v.name}
                    title={v.name}
                    className="h-9 w-9 rounded-md border border-white/10"
                    style={{ background: v.swatch }}
                  />
                ))}
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                именованных — шестнадцать (ещё девять живут литералами в коде). Пятнадцать из них лежат в диапазоне
                4–12% светлоты: шаг между соседними меньше процента, слои не различаются. Шестнадцатое —{" "}
                <span className="text-gray-300">--secondary</span>, бирюзовое: объявлено среди переменных темы,
                поверхностью не является, и единственный его читатель — ui/progress, у которого в кабинете ноль вызовов
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <div className="rounded-lg border border-white/10 p-3" style={{ background: "rgb(10 10 10)" }}>
                <div className="card-glass rounded-2xl border border-white/5 p-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-gray-400">
                    контрол на карточке
                  </div>
                  <div
                    className="mt-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] text-gray-300"
                    style={{ background: "rgb(15 15 15)" }}
                  >
                    оверлей над всем
                  </div>
                </div>
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                L0 документ 10·10·10 → L1 card-glass → L2 bg-white/5 → L3 оверлей 15·15·15
              </p>
            </div>
          }
          why={
            <>
              Токен — не канон: пять токенов поверхностей означают пять разных фонов, просто у каждого есть имя. Тёмная
              тема различает слои <span className="text-gray-200">светлотой</span>, и шаг между ними должен быть виден
              без бордера. Четыре слоя дают шаг 2–4% вместо нынешнего одного.
            </>
          }
          price="~70 правок в ~28 файлах; card-glass (68 вхождений) не трогаем — он уже канон"
        />

        {/* 3 ------------------------------------------------------------- */}
        <Dim
          id="borders"
          n="03"
          title="Границы"
          spec="§3 спецификации"
          nowLabel={`${BORDER_COLORS} написаний цвета`}
          nextLabel="3 роли"
          now={
            <div className="space-y-2">
              <div className="card-glass rounded-2xl border border-white/5 p-3">
                <div className="rounded-lg border border-slate-600/30 bg-white/5 px-3 py-2 text-[10px] text-slate-400">
                  поле · border-slate-600/30
                </div>
                <div className="mt-2 flex gap-2">
                  <FakeBtn cls="h-8 rounded-lg border border-white/15 text-[10px] text-gray-300">/15</FakeBtn>
                  <FakeBtn cls="h-8 rounded-lg border border-white/20 text-[10px] text-gray-300">/20</FakeBtn>
                  <FakeBtn cls="h-8 rounded-lg border border-white/[0.03] text-[10px] text-gray-300">/0.03</FakeBtn>
                </div>
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                в одной карточке четыре разных края; сине-серое семейство — наследство AdminInput
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <div className="card-glass rounded-2xl border border-white/5 p-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-gray-400">
                  контрол · border-white/10
                </div>
                <div className="mt-2 flex gap-2">
                  <FakeBtn cls="h-8 rounded-lg border border-white/10 text-[10px] text-gray-300">действие</FakeBtn>
                  <FakeBtn cls="h-8 rounded-lg border border-status-success/50 text-[10px] text-emerald-300">
                    статус
                  </FakeBtn>
                </div>
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                карточка /5 · контрол и оверлей /10 · статус status-*/30
              </p>
            </div>
          }
          why={
            <>
              Граница в тёмной теме — не обводка, а <span className="text-gray-200">световой кант</span>: белый с малой
              прозрачностью имитирует свет на ребре. Отсюда правило «чем ближе элемент к пальцу, тем ярче кант»:
              карточка пассивна, контрол активен. Расщепление в коде уже почти чистое — 66 из 92 вхождений{" "}
              <Mono>/5</Mono> стоят на карточках.
            </>
          }
          price="~105 правок в ~45 файлах; 19 из них — шесть файлов отчётов, те же, где живёт lucide"
        />

        {/* 4 ------------------------------------------------------------- */}
        <Dim
          id="shadows"
          n="04"
          title="Тени и elevation"
          spec="§4 спецификации"
          nowLabel={`${SHADOWS} написаний · токена нет`}
          nextLabel="3 токена"
          now={
            <div className="space-y-2">
              <Row>
                <Item caption="card-glass + своя тень ×10">
                  <div className="card-glass h-16 w-28 rounded-2xl border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]" />
                </Item>
                <Item caption="shadow-md (невидима)">
                  <div className="h-16 w-28 rounded-xl border border-white/10 bg-surface-raised shadow-md" />
                </Item>
                <Item caption="shadow-2xl ×6">
                  <div className="h-16 w-28 rounded-xl border border-white/10 bg-surface-raised shadow-2xl" />
                </Item>
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                класс поверх card-glass перебивает её собственную тень: карточки аналитики не такие, как все остальные
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <Row>
                <Item caption="shadow-card">
                  <div className="h-16 w-28 rounded-2xl border border-white/5 bg-surface-raised shadow-[0_4px_20px_rgba(0,0,0,0.2)]" />
                </Item>
                <Item caption="shadow-overlay">
                  <div className="h-16 w-28 rounded-xl border border-white/10 bg-surface-raised shadow-[0_24px_56px_-12px_rgba(0,0,0,0.75)]" />
                </Item>
                <Item caption="shadow-edge">
                  <div className="h-16 w-28 rounded-lg border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" />
                </Item>
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                карточка · оверлей · контрол — те же три слоя, что у фонов
              </p>
            </div>
          }
          why={
            <>
              Все три значения уже есть в коде — просто записаны строкой и потому не переиспользуются. Дефолты Tailwind
              (<Mono>shadow-md</Mono>, <Mono>shadow-lg</Mono>) рассчитаны на светлую тему: чёрное пятно на почти чёрном
              фоне невидимо, класс есть — эффекта нет.
            </>
          }
          price="~28 правок в ~11 файлах; 10 из них — просто удаление класса поверх card-glass"
        />

        {/* 5 ------------------------------------------------------------- */}
        <Dim
          id="rhythm"
          n="05"
          title="Вертикальный ритм"
          spec="§5 спецификации"
          nowLabel={`${S.containers.verticalRhythm.combos.length} значений space-y`}
          nextLabel="3 ступени"
          now={
            <div className="space-y-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                {[
                  ["space-y-1", "h-1"],
                  ["space-y-2", "h-2"],
                  ["space-y-3", "h-3"],
                  ["space-y-4", "h-4"],
                  ["space-y-5", "h-5"],
                  ["space-y-6", "h-6"],
                  ["space-y-8", "h-8"],
                ].map(([name, h]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className={`w-6 rounded-sm bg-amber-300/25 ${h}`} />
                    <span className="font-mono text-[9px] text-gray-500">{name}</span>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                шаг 4px — читатель разницы не видит, а разработчик выбирает каждый раз
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                {[
                  ["space-y-8 · между секциями", "h-8"],
                  ["space-y-4 · между блоками", "h-4"],
                  ["space-y-2 · между строками", "h-2"],
                ].map(([name, h]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className={`w-6 rounded-sm bg-emerald-400/30 ${h}`} />
                    <span className="font-mono text-[9px] text-gray-500">{name}</span>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                32 / 16 / 8 — каждый шаг вдвое, соседние уровни различимы без линейки
              </p>
            </div>
          }
          why={
            <>
              Плюс правило «ритм задаёт родитель через <Mono>space-y</Mono>, ребёнок не задаёт свой{" "}
              <Mono>mb</Mono>». Это не вкус: <Mono>.space-y-8 &gt; * + *</Mono> специфичнее <Mono>.mb-12</Mono> и
              обнуляет ей отступ — из-за чего ~25 классов в кабинете уже мёртвые и врут при чтении кода (B-01).
            </>
          }
          price="~150 правок в ~50 файлах, из них ~25 визуально нулевых (мёртвые классы)"
        />

        {/* 6 ------------------------------------------------------------- */}
        <Dim
          id="card-density"
          n="06"
          title="Плотность карточек"
          spec="§6 спецификации"
          nowLabel={`${S.containers.cardPadding.combos.length} комбинаций паддинга`}
          nextLabel="2 плотности + «без рамки»"
          now={
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["p-6 md:p-8", "p-6", "×22"],
                ["p-5", "p-5", "×8"],
                ["p-4", "p-4", "×2"],
              ].map(([label, cls, n]) => (
                <div key={label} className={`card-glass rounded-2xl border border-white/5 ${cls}`}>
                  <div className="h-8 rounded bg-white/[0.06]" />
                  <div className="mt-1 font-mono text-[9px] text-gray-500">
                    {label} {n}
                  </div>
                </div>
              ))}
            </div>
          }
          next={
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="card-glass rounded-2xl border border-white/5 p-6">
                <div className="h-8 rounded bg-emerald-400/15" />
                <div className="mt-1 font-mono text-[9px] text-gray-500">regular · карточка-раздел</div>
              </div>
              <div className="card-glass rounded-2xl border border-white/5 p-4">
                <div className="h-8 rounded bg-emerald-400/15" />
                <div className="mt-1 font-mono text-[9px] text-gray-500">compact · карточка в сетке</div>
              </div>
            </div>
          }
          why={
            <>
              Плотность задаёт не вкус, а <span className="text-gray-200">число карточек в ряду</span>: одна на всю
              ширину может позволить себе 32px воздуха, четыре по 260px — нет, там 32px съедают четверть.{" "}
              <Mono>p-5</Mono> (8 вхождений) стоит ровно между двумя канонами и не даёт ни того, ни другого.
            </>
          }
          price="~45 вхождений в ~28 файлах, из них 22 уже правильные — с них просто снимается класс"
        />

        {/* 7 ------------------------------------------------------------- */}
        <Dim
          id="table-density"
          n="07"
          title="Плотность таблиц"
          spec="§7 спецификации"
          nowLabel="3 плотности · кит переопределён 26 раз"
          nextLabel="2 — по роли читателя"
          now={
            <div className="space-y-2 overflow-x-auto">
              {[
                ["px-6 py-4", "×13"],
                ["px-6 py-3", "×8"],
              ].map(([cls, n]) => (
                <div key={cls} className="min-w-[240px] overflow-hidden rounded-lg border border-white/10">
                  {["E2E Main Track One", "E2E Solo Track"].map((t) => (
                    <div
                      key={t}
                      className={`flex items-center justify-between border-b border-white/5 text-[10px] text-gray-300 last:border-b-0 ${cls}`}
                    >
                      <span>{t}</span>
                      <span className="font-mono text-gray-500">{n}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          }
          next={
            <div className="space-y-2 overflow-x-auto">
              {[
                ["px-4 py-3", "compact · админ"],
                ["px-6 py-4", "comfortable · артист"],
              ].map(([cls, role]) => (
                <div key={cls} className="min-w-[240px] overflow-hidden rounded-lg border border-white/10">
                  {["E2E Main Track One", "E2E Solo Track"].map((t) => (
                    <div
                      key={t}
                      className={`flex items-center justify-between border-b border-white/5 text-[10px] text-gray-300 last:border-b-0 ${cls}`}
                    >
                      <span>{t}</span>
                      <span className="font-mono text-emerald-300/70">{role}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          }
          why={
            <>
              Единственное измерение, где разделение выводится из{" "}
              <span className="text-gray-200">роли читателя</span>, а не из геометрии. Админ сканирует десятки строк —
              каждые лишние 8px это минус строка на экране. Артист читает четыре строки за год, и там строка должна
              выглядеть объектом, а не записью в логе.
            </>
          }
          price="~47 удалений и 11 добавлений в 11 файлах; горизонтальный паддинг админских таблиц падает с 24 до 16px — в строку влезает больше текста"
        />

        {/* 8 ------------------------------------------------------------- */}
        <Dim
          id="grids"
          n="08"
          title="Сетки карточек"
          spec="§8 спецификации"
          stack
          nowLabel={`${S.containers.grids.combos.length} наборов колонок`}
          nextLabel="3 пресета · 2 брейкпоинта"
          now={
            <div className="space-y-2">
              {[
                ["grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", "×9"],
                ["grid-cols-1 md:grid-cols-3 lg:grid-cols-5", "×1"],
                ["grid-cols-1 md:grid-cols-2 lg:grid-cols-6", "×1"],
              ].map(([cls, n]) => (
                <div key={cls}>
                  <div className={`grid gap-1 ${cls}`}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-6 rounded bg-amber-300/15" />
                    ))}
                  </div>
                  <div className="mt-1 break-all font-mono text-[9px] text-gray-500">
                    {cls} {n}
                  </div>
                </div>
              ))}
            </div>
          }
          next={
            <div className="space-y-2">
              {[
                ["grid-cols-2 xl:grid-cols-4", "GRID_METRICS · ряд метрик"],
                ["grid-cols-1 sm:grid-cols-2 xl:grid-cols-4", "GRID_OBJECTS · артисты, релизы"],
                ["grid-cols-1 xl:grid-cols-2", "GRID_PAIR · график + список"],
              ].map(([cls, name]) => (
                <div key={cls}>
                  <div className={`grid gap-1 ${cls}`}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-6 rounded bg-emerald-400/20" />
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-gray-500">{name}</div>
                </div>
              ))}
            </div>
          }
          why={
            <>
              Разнобой возник не из-за числа колонок, а из-за того, что переход задан на{" "}
              <span className="text-gray-200">четырёх разных ширинах</span>. <Mono>sm</Mono> — «телефон кончился»,{" "}
              <Mono>xl</Mono> — «начался десктоп»; между ними планшет, и он обязан вести себя одинаково во всех
              разделах. Растяните окно — образцы слева перестраиваются вразнобой, справа согласованно.
            </>
          }
          price="~30 сеток в ~20 файлах; самый большой визуальный дифф на 1440 — каждый экран с сеткой перекладывается"
        />

        {/* 9 ------------------------------------------------------------- */}
        <Dim
          id="loading"
          n="09"
          title="Загрузочные состояния"
          spec="§9 спецификации"
          nowLabel={`${S.states.loading.layouts.variants} раскладок · loading.tsx у 1 роута из 38`}
          nextLabel="скелетон формы страницы"
          now={
            <div className="space-y-2">
              <div className="flex h-32 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                h-64 · py-8 · py-10 · py-12 · py-16 · py-20 · min-h-[40vh] · h-[280px] — высота выбирается на глаз
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="h-6 w-40 rounded bg-white/[0.06]" />
                <div className="mt-2 h-3 w-56 rounded bg-white/[0.04]" />
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-6 rounded bg-white/[0.05]" />
                  ))}
                </div>
              </div>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                шапка известна заранее · строки на месте будущих · спиннер остаётся только внутри кнопки
              </p>
            </div>
          }
          why={
            <>
              Спиннер сообщает «что-то происходит», скелетон — «вот что появится». Форма экрана известна заранее: шапка
              канонична, у таблицы есть колонки, карточек четыре. Десять раскладок возникли ровно потому, что вопрос
              «спиннер посреди <span className="text-gray-200">чего</span>?» не имеет ответа.
            </>
          }
          price="~22 замены в 25 файлах + ~10 новых loading.tsx + 1 компонент; в статике визуально ноль — стенд снимает загруженные экраны"
        />

        {/* 10 ------------------------------------------------------------ */}
        <Dim
          id="empty"
          n="10"
          title="Пустые состояния и ошибки"
          spec="§10 спецификации"
          nowLabel={`${EMPTY_FRAMES} обрамлений · ${S.states.empty.handRolled.count} фраз мимо кита`}
          nextLabel="3 состояния по действию"
          now={
            <div className="space-y-2">
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-[10px] text-gray-500">
                пунктир + py-8
              </div>
              <div className="card-glass rounded-2xl border border-dashed border-white/15 px-4 py-4 text-center text-[10px] text-gray-500">
                card-glass + пунктир /15
              </div>
              <p className="py-4 text-center font-mono text-[10px] text-gray-500">
                «Нет данных по трекам» — просто &lt;p&gt;, мимо компонента
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <span className="material-symbols-outlined text-3xl text-gray-600" aria-hidden>
                  library_music
                </span>
                <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400">Релизов нет</p>
                <FakeBtn cls="mt-1 h-8 rounded-lg border border-white/10 text-[10px] text-gray-300">
                  Добавить релиз
                </FakeBtn>
              </div>
              <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[10px] text-red-200">
                Ошибка — баннер над содержимым, содержимое остаётся
              </div>
            </div>
          }
          why={
            <>
              Три состояния, потому что три разных следующих действия: «пусто по факту» → создать, «пусто по фильтру» →
              сбросить, «ошибка» → повторить. Сейчас пустой список и ошибка на двух экранах нарисованы одинаково,
              через <Mono>Banner</Mono>. Отдельно и не косметически: пять экранов «не найдено» остаются{" "}
              <span className="text-gray-200">без шапки и навигации</span> — они получают <Mono>PageHeader</Mono>.
            </>
          }
          price="~40 правок в ~20 файлах; из них 5 — не косметика, а возврат шапки на экраны «не найдено»"
        />

        {/* 11 ------------------------------------------------------------ */}
        <Dim
          id="overlays"
          n="11"
          title="Оверлеи"
          spec="§11 спецификации · самое заметное изменение"
          nowLabel={`${S.overlays.backgroundSummary.length} фонов на 8 примитивах`}
          nextLabel="1 фон · 2 радиуса"
          now={
            <div className="rounded-lg p-3" style={{ background: "rgb(10 10 10)" }}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-black/90 px-3 py-2 text-[10px] text-gray-300">
                  ActionMenu · bg-black/90
                  <div className="font-mono text-[9px] text-amber-300/80">темнее фона страницы</div>
                </div>
                <div className="rounded-md border bg-popover px-3 py-2 text-[10px] text-popover-foreground">
                  Dropdown · bg-popover
                  <div className="font-mono text-[9px] text-gray-500">hsl(220 10% 12%) — синеватый</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-[10px] text-gray-300">
                  Dialog · bg-background
                  <div className="font-mono text-[9px] text-gray-500">hsl(0 0% 4%)</div>
                </div>
                <div className="rounded-xl border border-white/[0.14] bg-surface-glass/50 px-3 py-2 text-[10px] text-gray-300 backdrop-blur-xl">
                  Select · стекло /50
                  <div className="font-mono text-[9px] text-gray-500">rgb(12 12 12 / 0.5)</div>
                </div>
              </div>
            </div>
          }
          next={
            <div className="rounded-lg p-3" style={{ background: "rgb(10 10 10)" }}>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Меню «Сервис»", "rounded-xl"],
                  ["Dropdown", "rounded-xl"],
                  ["Dialog", "rounded-2xl"],
                  ["Select", "rounded-xl"],
                ].map(([name, r]) => (
                  <div
                    key={name}
                    className={`border border-white/10 px-3 py-2 text-[10px] text-gray-200 shadow-[0_24px_56px_-12px_rgba(0,0,0,0.75)] ${r}`}
                    style={{ background: "rgb(15 15 15)" }}
                  >
                    {name}
                    <div className="font-mono text-[9px] text-emerald-300/70">surface-dialog · один на все</div>
                  </div>
                ))}
              </div>
            </div>
          }
          why={
            <>
              Оверлей — единственный элемент, который виден{" "}
              <span className="text-gray-200">поверх любого экрана</span>, поэтому его непохожесть на себя заметнее
              всего. Физика тёмной темы: оверлей ближе к зрителю, значит светлее фона. У меню «Сервис» сейчас ровно
              наоборот — <Mono>bg-black/90</Mono> темнее фона <Mono>10 10 10</Mono>, и меню читается как дыра. Это
              точный адрес жалобы на «чёрный фон в выпадающих».
            </>
          }
          price="6 файлов кита + 22 переопределения, которые после правки кита просто удаляются"
        />

        {/* 12 ------------------------------------------------------------ */}
        <Dim
          id="buttons"
          n="12"
          title="Кнопки"
          spec="§12 спецификации"
          nowLabel={`${ACCIDENTAL_PRIMARY} кнопки primary по умолчанию cva`}
          nextLabel="вариант обязателен"
          now={
            <div className="space-y-2">
              <Row>
                <Item caption="cta — primary">
                  <FakeBtn cls="rounded-lg bg-brand font-bold text-black shadow-[0_0_20px_rgb(var(--brand)/0.25)]">
                    Сохранить
                  </FakeBtn>
                </Item>
                <Item caption="default — тоже заливка">
                  <FakeBtn cls="rounded-lg bg-primary text-primary-foreground">Привязать</FakeBtn>
                </Item>
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                две зелёные заливки на одном экране; вторая стала primary не по решению, а потому что проп не написали
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <Row>
                <Item caption="cta — единственный primary">
                  <FakeBtn cls="rounded-lg bg-brand font-bold text-black shadow-[0_0_20px_rgb(var(--brand)/0.25)]">
                    Сохранить
                  </FakeBtn>
                </Item>
                <Item caption="outline">
                  <FakeBtn cls="rounded-lg border border-white/10 text-gray-300">Привязать</FakeBtn>
                </Item>
                <Item caption="ghost">
                  <FakeBtn cls="rounded-lg text-gray-400">Ещё</FakeBtn>
                </Item>
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                десять вариантов в cva остаются — канонизируется их применение, а не состав
              </p>
            </div>
          }
          why={
            <>
              Расщепление уже правильное: 43 <Mono>outline</Mono> / 21 <Mono>ghost</Mono> / 21 <Mono>cta</Mono> —
              здоровая пирамида, где primary редок. Ломает её только умолчание <Mono>cva</Mono>: заливки{" "}
              <Mono>default</Mono> и <Mono>destructive</Mono> изымаются из обихода, вариант становится обязательным.
            </>
          }
          price="~30 правок в ~12 файлах; на девяти экранах нужно решение «primary это или нет»"
        />

        {/* 13 ------------------------------------------------------------ */}
        <Dim
          id="type"
          n="13"
          title="Типографика вне заголовка"
          spec="§13 спецификации"
          nowLabel={`${S.tokens.typography.sizes.length} написаний размера`}
          nextLabel="4 размера + 1 пресет"
          now={
            <div className="space-y-1">
              {["text-lg", "text-base", "text-sm", "text-[14px]", "text-xs", "text-[11px]", "text-[10px]", "text-[9px]"].map(
                (cls) => (
                  <div key={cls} className="flex items-baseline gap-2">
                    <span className={cls}>Отчёт за Q1 2026</span>
                    <span className="font-mono text-[9px] text-gray-600">{cls}</span>
                  </div>
                )
              )}
            </div>
          }
          next={
            <div className="space-y-1.5">
              {[
                ["text-2xl font-bold", "text-2xl · значение метрики"],
                ["text-lg font-bold", "text-lg · заголовок секции"],
                ["text-sm", "text-sm · основной текст"],
                ["text-xs text-gray-400", "text-xs · вторичный"],
                ["font-mono text-xs uppercase tracking-widest text-gray-500", ".text-label · технический"],
              ].map(([cls, name]) => (
                <div key={name} className="flex flex-wrap items-baseline gap-2">
                  <span className={cls}>Отчёт за Q1 2026</span>
                  <span className="font-mono text-[9px] text-gray-600">{name}</span>
                </div>
              ))}
            </div>
          }
          why={
            <>
              Шаг между соседними ступенями сейчас меньше двух пикселей — разница не читается, зато выбор делается
              каждый раз. Четыре размера покрывают четыре роли, которые в кабинете есть: читаю / уточняю / разделяю /
              считываю число. Отдельно: <Mono>font-mono</Mono> в проекте{" "}
              <span className="text-gray-200">не моноширинный</span> — пять из шести семейств указывают на один и тот
              же Nunito Sans; технический вид делает разрядка, и её надо собрать в один класс.
            </>
          }
          price="~265 правок в ~60 файлах — самое дорогое измерение; идёт последней волной, отдельно от всего"
        />

        {/* 14 ------------------------------------------------------------ */}
        <Dim
          id="icons"
          n="14"
          title="Иконки"
          spec="§14 спецификации"
          nowLabel={`две системы · lucide в ${LUCIDE_FILES} файлах кабинета`}
          nextLabel="одна система · 3 размера"
          now={
            <div className="space-y-2">
              <Row>
                {["text-[16px]", "text-[18px]", "text-[20px]", "text-2xl", "text-5xl"].map((cls) => (
                  <Item key={cls} caption={cls}>
                    <span className={`material-symbols-outlined text-gray-400 ${cls}`} aria-hidden>
                      description
                    </span>
                  </Item>
                ))}
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                плюс lucide в шести файлах отчётов: другой рисунок глифа в том же ряду — самый заметный вид разнобоя
              </p>
            </div>
          }
          next={
            <div className="space-y-2">
              <Row>
                <Item caption="16px · в строке">
                  <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>
                    description
                  </span>
                </Item>
                <Item caption="20px · в кнопке">
                  <span className="material-symbols-outlined text-xl text-gray-400" aria-hidden>
                    description
                  </span>
                </Item>
                <Item caption="48px · пустое состояние">
                  <span className="material-symbols-outlined text-5xl text-gray-600" aria-hidden>
                    description
                  </span>
                </Item>
              </Row>
              <p className="font-mono text-[9px] leading-snug text-gray-500">
                lucide остаётся законным только внутри components/ui — это поставка shadcn
              </p>
            </div>
          }
          why={
            <>
              Иконка всегда стоит рядом с текстом и должна быть с ним соразмерна — отсюда три размера, а не
              «мелкая / средняя / крупная». Закрепляется одной строкой:{" "}
              <Mono>no-restricted-imports</Mono> на <Mono>lucide-react</Mono> везде, кроме кита.
            </>
          }
          price="6 файлов, одним заходом с границами (§3) — это те же самые файлы"
        />

        {/* 15 ------------------------------------------------------------ */}
        <Dim
          id="wording"
          n="15"
          title="Формулировки подписей"
          spec="§15 спецификации"
          nowLabel={`${S.headers.stats.byBackLabel.length} формулировки возврата`}
          nextLabel="1 формула на роль"
          now={
            <div className="space-y-1.5 font-mono text-[10px] text-gray-400">
              {[
                "← Назад",
                "← К списку",
                "← Назад к списку артистов",
                "← Назад к профилю артиста",
                "← Вернуться к релизу  (ведёт на список)",
                "Минимум: 3 000 ₽ · от 500 ₽",
                "«Нет данных по трекам» ×4",
                "800.00 ₽  (toFixed вместо formatMoney)",
              ].map((s) => (
                <div key={s} className="rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1">
                  {s}
                </div>
              ))}
            </div>
          }
          next={
            <div className="space-y-1.5 font-mono text-[10px] text-emerald-200/80">
              {[
                "← К списку релизов",
                "← К профилю артиста",
                "плейсхолдер:  Название или UPC",
                "порог:        от 3 000 ₽",
                "пустота:      Релизов нет",
                "деньги:       800 ₽",
                "значение:     Никогда  (не НИКОГДА)",
              ].map((s) => (
                <div key={s} className="rounded border border-status-success/20 bg-status-success/[0.04] px-2 py-1">
                  {s}
                </div>
              ))}
            </div>
          }
          why={
            <>
              «К разделу», а не «Назад»: «назад» — про историю браузера, а крошка ведёт на конкретный уровень, и
              уровень надо назвать. Побочный эффект — опечатка «Вернуться к релизу», которая на самом деле ведёт на
              список, становится видна <span className="text-gray-200">при написании</span>. Подпись повторяется на
              десяти экранах, и её разнобой читается сильнее, чем разнобой в пикселях.
            </>
          }
          price="~45 правок в ~25 файлах; риск не геометрический, а тестовый — e2e ищут элементы по тексту"
        />
      </div>

      {/* Сторож ------------------------------------------------------------ */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-200">
          Чем это будет держаться
        </h3>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-400">
          Канон без сторожа умирает. Тринадцать из пятнадцати измерений выше стережёт один новый скрипт —{" "}
          <Mono>scripts/check-design-canon.ts</Mono>, и он почти бесплатный: он ничего не сканирует заново, а читает
          готовый <Mono>design-map.json</Mono> — тот самый, что питает эту страницу, — и падает, когда число вариантов
          в измерении превышает порог. Генератор на 2292 строки уже написан; нужен только предикат.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-400">
          Это важнее любого линт-правила. ESLint видит написанный класс; порог видит{" "}
          <span className="text-gray-200">число вариантов</span> — то есть ровно ту величину, которая и есть предмет
          спецификации. Правило «нельзя <Mono>rounded-md</Mono>» не мешает завести одиннадцатый радиус; правило «у типа
          элемента один радиус» — мешает.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-500">
          Пороги ставятся по фактическому состоянию на момент волны и опускаются вместе с ней — тогда скрипт зелёный с
          первого дня и падает только на регрессе, а не на долге. Встраивается в <Mono>pnpm verify</Mono> рядом с{" "}
          <Mono>check:page-shell</Mono>.
        </p>
      </div>
    </div>
  )
}
