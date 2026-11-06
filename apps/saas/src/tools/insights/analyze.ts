import { layoutOf, type ClickEvent, type InsightEvent, type Layout, type ViewEvent } from './store'

export interface Filters {
  days: number | 'all'
  page: string
  layout: Layout | 'all'
}

const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function applyFilters(events: InsightEvent[], f: Filters, now = Date.now()) {
  return events.filter((e) =>
    (f.days === 'all' || now - new Date(e.t).getTime() <= f.days * 86_400_000) &&
    (f.page === 'all' || e.page === f.page) &&
    (f.layout === 'all' || layoutOf(e.vw) === f.layout))
}

/** Plain-language position of a tap: which third of the screen, across and down the page. */
export function zoneOf(x: number, y: number, docH: number) {
  const v = y / Math.max(1, docH)
  const row = v < 0.33 ? 'top' : v < 0.66 ? 'middle' : 'bottom'
  const col = x < 33 ? 'left' : x < 66 ? 'center' : 'right'
  return row === 'middle' && col === 'center' ? 'center' : `${row}-${col}`
}

export interface ElementRow {
  key: string
  page: string
  sel: string
  label: string
  kind: string
  section: string
  taps: number
  nothing: number
  rage: number
  dead: number
  medianMs: number
  medianScroll: number
  spots: { x: number; y: number }[]
  /** median element size, px */
  w: number
  h: number
  states: string[]
  /** where on the page it usually sits, e.g. "top-left" */
  zone: string
}

export function analyze(events: InsightEvent[]) {
  const views = events.filter((e): e is ViewEvent => e.type === 'view')
  const clicks = events.filter((e): e is ClickEvent => e.type === 'click')

  const screens = new Map<string, number>()
  views.forEach((v) => screens.set(v.page, (screens.get(v.page) ?? 0) + 1))
  // Pages that only have taps (e.g. the first screen of a session) still count as screens.
  clicks.forEach((c) => { if (!screens.has(c.page)) screens.set(c.page, 0) })

  const groups = new Map<string, ClickEvent[]>()
  clicks.forEach((c) => {
    const k = `${c.page}\u0000${c.sel}`
    const g = groups.get(k)
    if (g) g.push(c)
    else groups.set(k, [c])
  })
  const elements: ElementRow[] = [...groups.entries()].map(([key, g]) => {
    const last = g[g.length - 1]
    const states = new Set<string>()
    g.forEach((c) => c.state && states.add(Object.entries(c.state).map(([k, v]) => `${k}=${v}`).join(', ')))
    return {
      key,
      page: last.page,
      sel: last.sel,
      label: last.label,
      kind: last.kind,
      section: last.section,
      taps: g.length,
      // Focusing a field changes nothing by design, so it never counts as an idle tap.
      nothing: g.filter((c) => c.fx === 'nothing' && c.kind !== 'field').length,
      rage: g.filter((c) => c.rage).length,
      dead: g.filter((c) => c.dead).length,
      medianMs: median(g.map((c) => c.ms)),
      medianScroll: median(g.map((c) => c.sy)),
      spots: g.map((c) => ({ x: c.ex, y: c.ey })),
      w: median(g.map((c) => c.ew)),
      h: median(g.map((c) => c.eh)),
      states: [...states],
      zone: zoneOf(median(g.map((c) => c.x)), median(g.map((c) => c.y)), median(g.map((c) => c.docH))),
    }
  }).sort((a, b) => b.taps - a.taps)

  const problems = elements
    .map((e) => ({ ...e, score: e.nothing + e.rage + e.dead }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)

  // Areas: the named part of the screen a tap landed in (sidebar, a card, a dialog…).
  const areaMap = new Map<string, { area: string; taps: number; elements: Set<string>; zones: Map<string, number>; problems: number }>()
  clicks.forEach((c) => {
    const k = c.section
    const a = areaMap.get(k) ?? { area: k, taps: 0, elements: new Set<string>(), zones: new Map<string, number>(), problems: 0 }
    a.taps++
    a.elements.add(c.label)
    const z = zoneOf(c.x, c.y, c.docH)
    a.zones.set(z, (a.zones.get(z) ?? 0) + 1)
    if ((c.fx === 'nothing' && c.kind !== 'field') || c.rage || c.dead) a.problems++
    areaMap.set(k, a)
  })
  const areas = [...areaMap.values()].map((a) => ({
    area: a.area,
    taps: a.taps,
    elements: a.elements.size,
    problems: a.problems,
    zone: [...a.zones.entries()].sort((x, y) => y[1] - x[1])[0][0],
  })).sort((x, y) => y.taps - x.taps)

  const pathMap = new Map<string, number>()
  views.forEach((v) => { if (v.from) pathMap.set(`${v.from} → ${v.page}`, (pathMap.get(`${v.from} → ${v.page}`) ?? 0) + 1) })
  const paths = [...pathMap.entries()].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n)

  return {
    sessions: new Set(events.map((e) => e.sid)).size,
    views: views.length,
    taps: clicks.length,
    problemTaps: clicks.filter((c) => (c.fx === 'nothing' && c.kind !== 'field') || c.rage || c.dead).length,
    screens: [...screens.entries()].map(([page, n]) => ({ page, views: n, taps: clicks.filter((c) => c.page === page).length })).sort((a, b) => b.views - a.views || b.taps - a.taps),
    elements,
    areas,
    problems,
    paths,
  }
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
