/**
 * The server's pre-aggregated heatmap of a page (heatmap_summary in the script, study_heatmap in the
 * panel): read into what the screens show. Pure, shared by the script's Heatmap tool and the panel.
 */
import { compareShares, ctrPerView, MIN_EXPOSURES, reachCurve, reachFrom, wilson, type Bin, type Comparison, type Interval } from '../heatstats'

export interface Summary {
  bin: number
  groups: { dev: string; ver: string; people: number; clicks: number }[]
  bins: (Bin & { dev: string; ver: string })[]
  elements: { dev: string; ver: string; sel: string; label: string | null; clicks: number; people: number; first: number; rage: number; dead: number; seen: number }[]
  depth: { dev: string; ver: string; row: number; frac: number; people: number }[]
}
export const emptySummary = (): Summary => ({ bin: 80, groups: [], bins: [], elements: [], depth: [] })
export function cleanSummary(v: unknown): Summary {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Summary>
  const arr = <T,>(x: unknown) => (Array.isArray(x) ? (x as T[]) : [])
  return { bin: Number(o.bin) || 80, groups: arr(o.groups), bins: arr(o.bins), elements: arr(o.elements), depth: arr(o.depth) }
}

/** Versions present, busiest first ('' = recorded before versions were labelled). */
export function versionsOf(s: Summary, dev: string): { ver: string; people: number }[] {
  const m = new Map<string, number>()
  for (const g of s.groups) if (dev === 'all' || g.dev === dev) m.set(g.ver, (m.get(g.ver) ?? 0) + g.people)
  return [...m].map(([ver, people]) => ({ ver, people })).sort((a, b) => b.people - a.people)
}
export const verName = (v: string) => (v ? `Version ${v}` : 'No version label')

const inView = (dev: string, ver: string) => (x: { dev: string; ver: string }) => (dev === 'all' || x.dev === dev) && x.ver === ver

export interface ElementRow { sel: string; label: string; clicks: number; people: number; first: number; rage: number; dead: number; seen: number; ofPeople: Interval; perView: Interval & { ok: boolean } }
export interface View { people: number; clicks: number; elements: ElementRow[]; reach: (row: number) => number; reachedAt: (row: number) => number; curve: { at: number; share: number }[]; depthPeople: number; bins: Bin[] }

/** One device and one version of the summary. */
export function viewOf(s: Summary, dev: string, ver: string): View {
  const f = inView(dev, ver)
  const groups = s.groups.filter(f)
  const people = groups.reduce((a, g) => a + g.people, 0)
  const clicks = groups.reduce((a, g) => a + g.clicks, 0)
  const els = new Map<string, Omit<ElementRow, 'ofPeople' | 'perView'>>()
  for (const e of s.elements.filter(f)) {
    const r = els.get(e.sel) ?? { sel: e.sel, label: e.label ?? shortSel(e.sel), clicks: 0, people: 0, first: 0, rage: 0, dead: 0, seen: 0 }
    r.clicks += e.clicks; r.people += e.people; r.first += e.first; r.rage += e.rage; r.dead += e.dead; r.seen += e.seen
    if (e.label) r.label = e.label
    els.set(e.sel, r)
  }
  const elements = [...els.values()].map((r) => ({ ...r, ofPeople: wilson(r.people, people), perView: ctrPerView(r.people, r.seen) }))
    .sort((a, b) => b.people - a.people || b.seen - a.seen)
  const depth = s.depth.filter(f)
  const hist = depth.map((d) => ({ row: d.row, people: d.people }))
  const reach = reachFrom(hist)
  const depthPeople = hist.reduce((a, h) => a + h.people, 0)
  const curve = reachCurve(depth.flatMap((d) => Array.from({ length: Math.min(d.people, 10_000) }, () => d.frac)))
  const binMap = new Map<string, Bin>()
  for (const b of s.bins.filter(f)) {
    const k = `${b.bx},${b.by}`
    const x = binMap.get(k)
    if (x) { x.n += b.n; x.people += b.people } else binMap.set(k, { bx: b.bx, by: b.by, n: b.n, people: b.people })
  }
  return { people, clicks, elements, reach, reachedAt: (row) => Math.round(reach(row) * depthPeople), curve, depthPeople, bins: [...binMap.values()] }
}

/** How each element's click rate per view differs between two versions, in plain words. */
export function compareViews(a: View, b: View, names: [string, string]): { sel: string; label: string; c: Comparison }[] {
  const bySel = new Map(b.elements.map((e) => [e.sel, e]))
  return a.elements.filter((e) => bySel.has(e.sel)).slice(0, 8).map((e) => {
    const o = bySel.get(e.sel)!
    return { sel: e.sel, label: e.label, c: compareShares(e.people, Math.max(e.seen, e.people), o.people, Math.max(o.seen, o.people), names) }
  })
}

export const shortSel = (s: string) => (s.length > 40 ? `…${s.slice(-39)}` : s)
export { MIN_EXPOSURES }
