/**
 * Типы карты фактического дизайна. Форму задаёт генератор
 * `scripts/design-map.ts`; здесь — ровно то, что читает страница.
 * Поля, которые странице не нужны, намеренно не описаны.
 */

export type Zone = "page" | "cabinet-component" | "landing-component" | "kit"

export type Counted = { name: string; count: number }

export type Sample = {
  file: string
  line: number
  zone: Zone
  tag: string
  kind: string
  classText: string
}

export type ClassEntry = {
  name: string
  count: number
  byZone: Partial<Record<Zone, number>>
  kinds: Counted[]
  tags: Counted[]
  samples: Sample[]
  more: number
}

export type GuardRef = {
  status: "canon" | "partial" | "none"
  guards: string[]
  note: string
}

export type Guard = {
  id: string
  title: string
  command: string
  source: string
  rule: string
  scope: string
  scopeDetail?: string[]
  filesCovered: number
  filesOutside: number
}

export type CssVar = {
  name: string
  value: string
  file: string
  line: number
  comment: string | null
  swatch: string | null
  utilities: string[]
  usage: number
  usageDetail?: { viaUtilities: number; viaVar: number }
}

export type CssRule = { selector: string; body: string; file: string; line: number }

export type CvaGroup = {
  name: string
  classes: string
  line: number
  hoverPreview: string[]
  disabledPreview: string[]
}

export type Cva = {
  file: string
  base: string
  variants: CvaGroup[]
  sizes: CvaGroup[]
  defaults: Record<string, string>
} | null

export type HeaderAction = {
  component: string
  variant: string | null
  size: string | null
  text: string
  conditional: boolean
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

export type Occurrence = { file: string; line: number; zone: Zone; value: string; context: string }

export type Deviation = {
  id: string
  title: string
  what: string
  guard: GuardRef
  count: number
  items: Occurrence[]
  more: number
}

export type ColorValue = {
  value: string
  swatch: string | null
  luminance: number | null
  count: number
  zones: Counted[]
  occurrences: (Occurrence & { context: string })[]
  more: number
}

export type OverlayPart = {
  tag: string
  line: number
  role: "панель" | "подложка"
  classText: string
  facets: {
    background: string[]
    backdrop: string[]
    radius: string[]
    border: string[]
    shadow: string[]
    size: string[]
    padding: string[]
    layer: string[]
  }
  resolvedBackground: { cls: string; css: string; via: string; declaredIn: string | null }[]
}

export type LoadingGroup = {
  classText: string
  count: number
  samples: { file: string; line: number; inner: string }[]
  more: number
}

export type EmptyPhrase = {
  file: string
  line: number
  zone: Zone
  tag: string
  text: string
  viaKit: boolean
  classText: string
}
