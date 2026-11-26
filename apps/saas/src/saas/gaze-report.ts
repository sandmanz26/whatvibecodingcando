/**
 * The panel's eye-tracking report (Labs): per study, from its runs and their gaze and click events.
 * Pure (no DOM, no React) so the same numbers come out of the server's data and the demo's sample.
 *
 * It only consumes the eye-tracking pipeline (cleaning, smoothing, drift from the person's own
 * clicks, I-DT fixations) through its existing functions; it doesn't re-implement any of it.
 *
 * Elements are the ones recorded under each gaze sample (their label). After a drift correction the
 * recorded element no longer matches the corrected point, so the element is looked up from the other
 * samples recorded at that spot on the page (any participant's); a fixation with none nearby counts
 * as "elsewhere on the page".
 */
import { fixationsOf, idtFor, type Sample } from '../core/gaze-analysis'
import { cleanGaze, driftOf, pairsOf, smoothGaze, wilson, type Interval } from '../core/heatstats'
import { pageOf } from '../core/embed/pages'

export interface GazeRun { id: string; gaze_accuracy: number | null; vw?: number | null }
export interface GazeEvent { run_id: string; t: number; kind: string; page: string; label: string | null; sel?: string | null; x?: number | null; y?: number | null; vw?: number | null }

/** Calibration at or under this (px) counts as good. */
export const GOOD_ACC = 150
/** Fewer people than this: a row's numbers are greyed out as too uncertain. */
export const MIN_PEOPLE = 5
/** Each recorded gaze sample stands for about this long (the tracker records 5 a second). */
const SAMPLE_MS = 200
const ELSEWHERE = 'Elsewhere on the page'

export interface ElementStat {
  label: string
  /** people who looked at it at least once, of `people` on the page */
  viewers: number; people: number; share: Interval
  /** median time from arriving on the page to the first fixation on it, ms (viewers only) */
  ttff: number | null
  /** median total time on it per viewer, ms */
  dwell: number
  /** mean number of returns per viewer (a visit after looking elsewhere) */
  revisits: number
  /** people whose very first fixation on the page was on it */
  first: number
  /** of the people with eye tracking on this page, how many clicked it */
  clickers: number; clickShare: Interval
}
export interface PageReport {
  page: string
  people: number
  /** the runs (people) on this page: counted across pages and layouts without double counting */
  runs: string[]
  /** fixations of everyone on the page */
  fixations: number
  /** the element most people looked at (not "elsewhere"), or null */
  top: string | null
  /** layout width the fixations are drawn at, and the drawing's height */
  vw: number; height: number
  /** fixations of every person (page px at `vw`), for the preview; at most 800 */
  dots: { x: number; y: number; dur: number }[]
  elements: ElementStat[]
  /** the most common first three things people looked at, in order */
  paths: { steps: string[]; people: number }[]
  /** people on this page who clicked anything */
  clickPeople: number
  corrected: number
}
export interface GazeReport {
  participants: number
  good: number; goodShare: Interval
  medianAcc: number | null
  corrected: number
  pages: PageReport[]
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

interface Fix { x: number; y: number; start: number; dur: number; label: string }

export function gazeReport(runs: GazeRun[], events: GazeEvent[]): GazeReport {
  const runById = new Map(runs.map((r) => [r.id, r]))
  const gazeRuns = new Set(events.filter((e) => e.kind === 'gaze').map((e) => e.run_id))
  const withEyes = runs.filter((r) => gazeRuns.has(r.id) || num(r.gaze_accuracy))
  const accs = withEyes.map((r) => r.gaze_accuracy).filter(num)
  const good = accs.filter((a) => a <= GOOD_ACC).length

  // Group by page, then by run.
  const byPage = new Map<string, Map<string, GazeEvent[]>>()
  for (const e of events) {
    if (e.kind !== 'gaze' && e.kind !== 'click' && e.kind !== 'page') continue
    // The same key rule as the script (ids → :id), so rows saved before a rule change still merge;
    // a layout suffix (" · layout 2") is kept as it is.
    const [path, ...rest] = e.page.split(' · ')
    const key = [pageOf(path), ...rest].join(' · ')
    const m = byPage.get(key) ?? new Map<string, GazeEvent[]>()
    const l = m.get(e.run_id) ?? []
    l.push(e); m.set(e.run_id, l); byPage.set(key, m)
  }
  const correctedRuns = new Set<string>()
  const pages: PageReport[] = []
  for (const [page, perRun] of byPage) {
    // Every raw sample recorded with an element on this page: where each element is on the layout.
    const where = [...perRun.values()].flat().filter((e) => e.kind === 'gaze' && e.label && num(e.x) && num(e.y)) as (GazeEvent & { x: number; y: number; label: string })[]
    const lookup = (x: number, y: number) => {
      let best: string | null = null, d = 40
      for (const s of where) { const dd = Math.hypot(s.x - x, s.y - y); if (dd < d) { d = dd; best = s.label } }
      return best ?? ELSEWHERE
    }
    const people: { id: string; fix: Fix[]; clicked: Set<string> }[] = []
    const vws: number[] = []
    let corrected = 0
    for (const [runId, ev] of perRun) {
      const gz = ev.filter((e) => e.kind === 'gaze').sort((a, b) => a.t - b.t)
      if (!gz.length) continue
      const run = runById.get(runId)
      const clicks = ev.filter((e) => e.kind === 'click')
      const arrived = Math.min(...ev.filter((e) => e.kind === 'page').map((e) => e.t), gz[0].t)
      const clicked = new Set(clicks.map((c) => c.label).filter((l): l is string => !!l))
      const located = gz.filter((e) => num(e.x) && num(e.y)) as (GazeEvent & { x: number; y: number })[]
      let fix: Fix[]
      if (located.length < 2) {
        // Older rows without coordinates: each sample is ~200 ms on its element.
        fix = gz.map((e) => ({ x: 0, y: 0, start: e.t, dur: SAMPLE_MS, label: e.label ?? ELSEWHERE }))
      } else {
        const vw = located[0].vw ?? run?.vw ?? 1280
        vws.push(vw)
        const kept = smoothGaze(cleanGaze(located.map((e) => ({ ...e, t: e.t })), vw, 50_000))
        const anchors = clicks.filter((c) => num(c.x) && num(c.y)).map((c) => ({ t: c.t, x: c.x as number, y: c.y as number }))
        const d = driftOf(pairsOf(kept, anchors))
        if (d.applied) { corrected++; correctedRuns.add(runId) }
        const pts = kept.map((p) => (d.applied ? { ...p, x: p.x + d.dx, y: p.y + d.dy } : p))
        const err = d.applied ? d.residual : (run?.gaze_accuracy ?? 120)
        // The sampling is ~5 a second, so a fixation needs a few samples: the same windows as the on-site map.
        const samples: Sample[] = pts.map((p) => ({ t: p.t, x: p.x, y: p.y }))
        const fx = fixationsOf(samples, { dispersion: idtFor(err).dispersion, minDur: 300, maxGap: 450 })
        const near = (x: number, y: number) => {
          if (d.applied) return lookup(x, y)
          let best = pts[0], bd = Infinity
          for (const p of pts) { const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = p } }
          return bd < 40 && best.label ? best.label : lookup(x, y)
        }
        fix = fx.length
          ? fx.map((f) => ({ x: f.x, y: f.y, start: f.start, dur: f.dur, label: near(f.x, f.y) }))
          : pts.map((p) => ({ x: p.x, y: p.y, start: p.t, dur: SAMPLE_MS, label: near(p.x, p.y) }))
      }
      people.push({ id: runId, fix: fix.map((f) => ({ ...f, start: f.start - arrived })), clicked })
    }
    if (!people.length) continue
    const n = people.length
    const labels = new Map<string, { viewers: number; firsts: number[]; dwell: number[]; returns: number; first: number; clickers: number }>()
    for (const p of people) {
      const seen = new Map<string, { first: number; dwell: number; visits: number }>()
      let prev = ''
      for (const f of p.fix) {
        const s = seen.get(f.label) ?? { first: f.start, dwell: 0, visits: 0 }
        s.dwell += f.dur
        if (prev !== f.label) s.visits++
        seen.set(f.label, s); prev = f.label
      }
      for (const [label, s] of seen) {
        const v = labels.get(label) ?? { viewers: 0, firsts: [], dwell: [], returns: 0, first: 0, clickers: 0 }
        v.viewers++; v.firsts.push(Math.max(0, s.first)); v.dwell.push(s.dwell); v.returns += Math.max(0, s.visits - 1)
        if (p.fix[0]?.label === label) v.first++
        if (p.clicked.has(label)) v.clickers++
        labels.set(label, v)
      }
    }
    const elements: ElementStat[] = [...labels].map(([label, v]) => ({
      label, viewers: v.viewers, people: n, share: wilson(v.viewers, n),
      ttff: median(v.firsts), dwell: median(v.dwell) ?? 0, revisits: v.viewers ? v.returns / v.viewers : 0,
      first: v.first, clickers: v.clickers, clickShare: wilson(v.clickers, n),
    })).sort((a, b) => Number(a.label === ELSEWHERE) - Number(b.label === ELSEWHERE) || b.viewers - a.viewers || b.dwell - a.dwell)
    const pathCount = new Map<string, number>()
    for (const p of people) {
      const steps: string[] = []
      for (const f of p.fix) { if (f.label !== ELSEWHERE && steps[steps.length - 1] !== f.label && !steps.includes(f.label)) steps.push(f.label); if (steps.length === 3) break }
      if (steps.length) pathCount.set(steps.join('\u0000'), (pathCount.get(steps.join('\u0000')) ?? 0) + 1)
    }
    const vw = Math.round(median(vws) ?? 1280)
    const dots = people.flatMap((p) => p.fix.filter((f) => f.x || f.y).map((f) => ({ x: f.x, y: f.y, dur: f.dur }))).slice(0, 800)
    const height = Math.round(Math.min(vw * 3, Math.max(vw * 0.6, ...dots.map((d) => d.y + 80))))
    pages.push({
      page, people: n, runs: people.map((p) => p.id), fixations: people.reduce((a, p) => a + p.fix.length, 0),
      top: elements.find((e) => e.label !== ELSEWHERE)?.label ?? null, vw, height, dots, elements,
      paths: [...pathCount].map(([k, c]) => ({ steps: k.split('\u0000'), people: c })).sort((a, b) => b.people - a.people).slice(0, 4),
      clickPeople: people.filter((p) => p.clicked.size > 0).length, corrected,
    })
  }
  pages.sort((a, b) => b.people - a.people)
  return { participants: withEyes.length, good, goodShare: wilson(good, accs.length), medianAcc: median(accs), corrected: correctedRuns.size, pages }
}

/** One row of the page table: a page with all its layouts (people counted once across them). */
export interface PageRow { page: string; people: number; fixations: number; top: string | null; layouts: PageReport[] }
export function pageRows(pages: PageReport[]): PageRow[] {
  const m = new Map<string, PageReport[]>()
  for (const p of pages) { const k = p.page.split(' · ')[0]; m.set(k, [...(m.get(k) ?? []), p]) }
  return [...m].map(([page, ls]) => {
    const sorted = [...ls].sort((a, b) => b.people - a.people)
    return { page, people: new Set(ls.flatMap((l) => l.runs)).size, fixations: ls.reduce((a, l) => a + l.fixations, 0), top: sorted[0].top, layouts: sorted }
  }).sort((a, b) => b.people - a.people || b.fixations - a.fixations)
}

/**
 * Labelled sample data for the browser-only demo: 14 made-up people on two pages of a shop, so the
 * report can be seen before any real study. Deterministic; nobody real.
 */
export function sampleGaze(): { runs: GazeRun[]; events: GazeEvent[] } {
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())
  const layouts: Record<string, { label: string; x: number; y: number; w: number; h: number; pull: number; click: number }[]> = {
    '/': [
      { label: 'h1 Find the right AI tool', x: 140, y: 120, w: 700, h: 70, pull: 1, click: 0 },
      { label: 'img Hero image', x: 860, y: 90, w: 360, h: 300, pull: 0.8, click: 0 },
      { label: 'input Search', x: 140, y: 230, w: 560, h: 48, pull: 0.7, click: 0.6 },
      { label: 'a Browse categories', x: 140, y: 320, w: 220, h: 40, pull: 0.45, click: 0.3 },
      { label: 'div Featured tools', x: 140, y: 460, w: 1000, h: 260, pull: 0.5, click: 0.15 },
      { label: 'footer Footer', x: 0, y: 1100, w: 1280, h: 200, pull: 0.1, click: 0 },
    ],
    '/product/:id': [
      { label: 'h1 Product name', x: 120, y: 110, w: 600, h: 60, pull: 1, click: 0 },
      { label: 'span Price', x: 120, y: 190, w: 160, h: 40, pull: 0.85, click: 0 },
      { label: 'button Add to cart', x: 120, y: 260, w: 220, h: 50, pull: 0.6, click: 0.55 },
      { label: 'img Product image', x: 760, y: 100, w: 420, h: 420, pull: 0.75, click: 0.1 },
      { label: 'section Reviews', x: 120, y: 640, w: 900, h: 300, pull: 0.35, click: 0 },
    ],
  }
  const runs: GazeRun[] = []
  const events: GazeEvent[] = []
  for (let i = 0; i < 14; i++) {
    const id = `sample-${i}`
    const acc = Math.round(70 + rnd() * 160)
    runs.push({ id, gaze_accuracy: acc, vw: 1280 })
    let t = 0
    for (const [page, els] of Object.entries(layouts)) {
      if (page !== '/' && rnd() < 0.3) continue
      events.push({ run_id: id, t, kind: 'page', page, label: null })
      // A constant offset (the webcam's drift) that the clicks can correct.
      const ox = gauss() * acc * 0.5, oy = gauss() * acc * 0.5
      const order = els.filter((e) => rnd() < e.pull).sort((a, b) => (a.y - b.y) + (rnd() - 0.5) * 400)
      for (const el of order) {
        const cx = el.x + el.w / 2, cy = el.y + el.h / 2
        const looks = 2 + Math.floor(rnd() * 5)
        for (let k = 0; k < looks; k++) {
          t += SAMPLE_MS
          events.push({ run_id: id, t, kind: 'gaze', page, label: el.label, x: cx + ox + gauss() * 18, y: cy + oy + gauss() * 14, vw: 1280 })
        }
        if (rnd() < el.click) { t += 120; events.push({ run_id: id, t, kind: 'click', page, label: el.label, x: cx + gauss() * 8, y: cy + gauss() * 6, vw: 1280 }) }
        t += 150
      }
      // Some come back to the first thing they saw.
      if (order[0] && rnd() < 0.4) for (let k = 0; k < 3; k++) { t += SAMPLE_MS; events.push({ run_id: id, t, kind: 'gaze', page, label: order[0].label, x: order[0].x + order[0].w / 2 + ox, y: order[0].y + order[0].h / 2 + oy, vw: 1280 }) }
      t += 1000
    }
  }
  return { runs, events }
}
