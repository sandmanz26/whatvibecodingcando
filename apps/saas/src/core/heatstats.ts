/**
 * Heatmap accuracy v4: making the numbers right in meaning, not just in maths. Pure (no DOM), tested
 * in Node (tests/heatmap.test.ts).
 *
 * - Exposure: an element nobody scrolled to can't be clicked. Click rates are divided by the people
 *   who actually saw the element (≥ 50% visible for ≥ 500 ms), and the density can be adjusted by how
 *   many people reached each depth of the page.
 * - Confidence: shares carry Wilson 95% intervals; two versions are compared with a two-proportion
 *   z-test, said in plain words.
 * - Placement: a click whose element can't be found again on this layout is left off the map and
 *   counted, never drawn at stale coordinates.
 * - Gaze: samples are cleaned, smoothed (One-Euro) and corrected for drift with the participant's own
 *   clicks (gaze just before a click should be on the click), then drawn with that run's own error.
 */
import { OneEuro } from './gaze-analysis'

/* ---------- confidence ---------- */

export interface Interval { p: number; lo: number; hi: number; /** half-width, for "38% ± 9" */ half: number }
/** Wilson score interval for k successes out of n (95% by default). n = 0 → everything 0. */
export function wilson(k: number, n: number, z = 1.96): Interval {
  if (!(n > 0)) return { p: 0, lo: 0, hi: 0, half: 0 }
  const p = Math.min(1, Math.max(0, k / n))
  const z2 = z * z
  const den = 1 + z2 / n
  const mid = (p + z2 / (2 * n)) / den
  const w = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den
  const lo = Math.max(0, mid - w), hi = Math.min(1, mid + w)
  return { p, lo, hi, half: (hi - lo) / 2 }
}
/** "38% ± 9" (points), or "–" with no data. */
export function fmtShare(k: number, n: number): string {
  if (!(n > 0)) return '–'
  const c = wilson(k, n)
  return `${Math.round(c.p * 100)}% ± ${Math.max(1, Math.round(c.half * 100))}`
}
/** Fewer exposures than this: the rate is greyed out as too uncertain. */
export const MIN_EXPOSURES = 5

/** Standard normal CDF (Abramowitz–Stegun 26.2.17, error < 7.5e-8). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const q = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - q : q
}

export interface Comparison { a: number; b: number; diff: number; z: number; p: number; real: boolean; words: string }
/**
 * Two-proportion z-test (pooled), two-sided. `real` when p < 0.05 and both groups have at least
 * MIN_EXPOSURES people. The words say it plainly, without overclaiming.
 */
export function compareShares(ka: number, na: number, kb: number, nb: number, names: [string, string] = ['A', 'B']): Comparison {
  const a = na > 0 ? ka / na : 0, b = nb > 0 ? kb / nb : 0
  const diff = b - a
  const pool = na + nb > 0 ? (ka + kb) / (na + nb) : 0
  const se = Math.sqrt(pool * (1 - pool) * (na > 0 && nb > 0 ? 1 / na + 1 / nb : Infinity))
  const z = se > 0 && Number.isFinite(se) ? diff / se : 0
  const p = se > 0 && Number.isFinite(se) ? 2 * (1 - normCdf(Math.abs(z))) : 1
  const enough = na >= MIN_EXPOSURES && nb >= MIN_EXPOSURES
  const real = enough && p < 0.05
  const pts = Math.round(Math.abs(diff) * 100)
  const words = !enough ? `Too few people to compare (${na} and ${nb}).`
    : real ? `${names[1]} is ${pts} points ${diff > 0 ? 'higher' : 'lower'} than ${names[0]}: likely a real difference (p ${p < 0.001 ? '< 0.001' : `= ${p.toFixed(3)}`}).`
    : `No clear difference between ${names[0]} and ${names[1]} yet (${pts} points, p = ${p.toFixed(2)}): it could be chance.`
  return { a, b, diff, z, p, real, words }
}

/* ---------- exposure ---------- */

/** Bins across the page: positions are kept in units of 1/80 of the layout width (16 px at 1280). */
export const BINS_ACROSS = 80
/** The row (in bin units) of a page y at layout width vw. */
export const rowOf = (y: number, vw: number) => Math.max(0, Math.floor(y / (Math.max(1, vw) / BINS_ACROSS)))

/**
 * Scroll reach from each person's deepest row: reach(row) = share of people whose deepest row ≥ row.
 * `hist` maps a deepest row to how many people stopped there.
 */
export function reachFrom(hist: { row: number; people: number }[]): (row: number) => number {
  const rows = [...hist].filter((h) => h.people > 0).sort((a, b) => a.row - b.row)
  const total = rows.reduce((s, h) => s + h.people, 0)
  if (!total) return () => 1
  return (row: number) => {
    let at = 0
    for (const h of rows) if (h.row >= row) at += h.people
    return at / total
  }
}
/** The reach curve at `steps` evenly spaced fractions of the page: [{ at: 0..1, share }]. */
export function reachCurve(depths: number[], steps = 10): { at: number; share: number }[] {
  const ds = depths.filter((d) => Number.isFinite(d)).map((d) => Math.min(1, Math.max(0, d)))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const at = i / steps
    return { at, share: ds.length ? ds.filter((d) => d >= at - 1e-9).length / ds.length : 0 }
  })
}
/**
 * Exposure weight for a click at a place reached by `reach` of people: 1 / reach, so a spot only half
 * the people scrolled to counts double. Capped (default 5×) and only when the reach is known well
 * enough (≥ MIN_EXPOSURES people reached it), so a few deep scrollers can't light up the bottom.
 */
export function exposureWeight(reach: number, reachedPeople: number, cap = 5): number {
  if (reachedPeople < MIN_EXPOSURES || !(reach > 0)) return 1
  return Math.min(cap, 1 / Math.min(1, reach))
}

/** Click rate per view: people who clicked ÷ people who saw it (never above 100%). */
export function ctrPerView(clickers: number, seen: number): Interval & { ok: boolean } {
  const n = Math.max(seen, clickers)
  return { ...wilson(clickers, n), ok: n >= MIN_EXPOSURES }
}

/* ---------- placement ---------- */

export interface Placeable { sel?: string | null; x: number; y: number; ex?: number | null; ey?: number | null; vw?: number | null; tag?: string | null }
export type Resolve = (sel: string) => { left: number; top: number; width: number; height: number; tag?: string } | null
/**
 * Places points on the current layout by their element. A point with an element that can't be found
 * again (or is a different kind of element now) is not drawn: it is counted in `unplaced`. A point
 * that never had an element (a click on bare page) is scaled by width from where it was made.
 */
export function place<T extends Placeable>(pts: T[], resolve: Resolve, vw: number): { placed: (T & { px: number; py: number })[]; unplaced: number } {
  const placed: (T & { px: number; py: number })[] = []
  let unplaced = 0
  for (const p of pts) {
    if (p.sel) {
      const r = resolve(p.sel)
      if (!r || !(r.width > 0) || !(r.height > 0) || (p.tag && r.tag && p.tag !== r.tag)) { unplaced++; continue }
      placed.push({ ...p, px: r.left + (p.ex ?? 0.5) * r.width, py: r.top + (p.ey ?? 0.5) * r.height })
    } else placed.push({ ...p, px: p.x * (vw / (p.vw || vw)), py: p.y })
  }
  return { placed, unplaced }
}
/** The tag a recorded label starts with ("button “Buy”" → "button"). */
export const tagOfLabel = (label?: string | null) => (label ? (/^([a-z][a-z0-9-]*)/.exec(label)?.[1] ?? null) : null)

/* ---------- server bins ---------- */

export interface Bin { bx: number; by: number; n: number; people: number }
/** Bins (in 1/80-width units) back to weighted points in page px at layout width vw. */
export function binsToPoints(bins: Bin[], vw: number, equal: boolean): { x: number; y: number; w: number; row: number }[] {
  const c = vw / BINS_ACROSS
  return bins.map((b) => ({ x: (b.bx + 0.5) * c, y: (b.by + 0.5) * c, w: equal ? b.people : b.n, row: b.by }))
}
/** The same binning the server does, for tests and the small-study path. */
export function binPoints(pts: { x: number; y: number; vw: number; p?: number }[]): Bin[] {
  const m = new Map<string, Bin & { ps: Set<number> }>()
  for (const p of pts) {
    const bx = Math.min(BINS_ACROSS - 1, Math.max(0, Math.floor((p.x / p.vw) * BINS_ACROSS))), by = rowOf(p.y, p.vw)
    const k = `${bx},${by}`
    const b = m.get(k) ?? { bx, by, n: 0, people: 0, ps: new Set<number>() }
    b.n++; b.ps.add(p.p ?? 0); b.people = b.ps.size
    m.set(k, b)
  }
  return [...m.values()].map(({ bx, by, n, people }) => ({ bx, by, n, people }))
}

/* ---------- gaze ---------- */

export interface GazeSample { t: number; x: number; y: number; /** 0–1 when the tracker gives one */ c?: number | null }
/**
 * Drops samples that can't be right: off the page (beyond `width` × `height`, with a margin), not
 * numbers, low confidence (< minC) and blinks (the tracker's (0,0) or a sample alone between gaps).
 */
export function cleanGaze<T extends GazeSample>(s: T[], width: number, height: number, minC = 0.3): T[] {
  const m = 40
  return s.filter((g) => Number.isFinite(g.x) && Number.isFinite(g.y) && !(g.x === 0 && g.y === 0)
    && g.x >= -m && g.y >= -m && g.x <= width + m && g.y <= height + m && (g.c == null || g.c >= minC))
}
/** One-Euro smoothing on both axes (resets after a gap of more than `gap` ms). */
export function smoothGaze<T extends GazeSample>(s: T[], gap = 600): T[] {
  const fx = new OneEuro(), fy = new OneEuro()
  let last = -Infinity
  return [...s].sort((a, b) => a.t - b.t).map((g) => {
    if (g.t - last > gap) { fx.reset(); fy.reset() }
    last = g.t
    return { ...g, x: fx.filter(g.x, g.t), y: fy.filter(g.y, g.t) }
  })
}

export interface Pair { gx: number; gy: number; cx: number; cy: number }
/** Click–gaze pairs: for each click, the median of the gaze samples in [t − 800, t − 50] ms. */
export function pairsOf(gaze: GazeSample[], clicks: { t: number; x: number; y: number }[], from = 800, to = 50): Pair[] {
  const out: Pair[] = []
  for (const c of clicks) {
    const w = gaze.filter((g) => g.t >= c.t - from && g.t <= c.t - to)
    if (w.length < 2) continue
    out.push({ gx: med(w.map((g) => g.x)), gy: med(w.map((g) => g.y)), cx: c.x, cy: c.y })
  }
  return out
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }

export interface Drift { applied: boolean; dx: number; dy: number; n: number; inliers: number; /** median distance gaze → click after correction (px), or before when not applied */ residual: number; before: number }
/** Pairs needed before a drift correction is trusted. */
export const MIN_PAIRS = 5
/**
 * Per-run drift: a constant offset estimated robustly (median offset, then outliers beyond 2.5× the
 * median absolute deviation, at least 60 px, are dropped and the median taken again: one RANSAC-style
 * refit). People don't always look at what they click, which is why it's robust and not a mean.
 */
export function driftOf(pairs: Pair[]): Drift {
  const dist = (dx: number, dy: number) => med(pairs.map((p) => Math.hypot(p.gx + dx - p.cx, p.gy + dy - p.cy)))
  const before = pairs.length ? dist(0, 0) : 0
  if (pairs.length < MIN_PAIRS) return { applied: false, dx: 0, dy: 0, n: pairs.length, inliers: 0, residual: before, before }
  const offs = pairs.map((p) => ({ dx: p.cx - p.gx, dy: p.cy - p.gy }))
  let dx = med(offs.map((o) => o.dx)), dy = med(offs.map((o) => o.dy))
  const r = offs.map((o) => Math.hypot(o.dx - dx, o.dy - dy))
  const cut = Math.max(60, 2.5 * med(r))
  const keep = offs.filter((_, i) => r[i] <= cut)
  if (keep.length >= MIN_PAIRS) { dx = med(keep.map((o) => o.dx)); dy = med(keep.map((o) => o.dy)) }
  const residual = dist(dx, dy)
  // Only when it helps: a correction that doesn't reduce the error is not applied.
  if (residual >= before) return { applied: false, dx: 0, dy: 0, n: pairs.length, inliers: keep.length, residual: before, before }
  return { applied: true, dx, dy, n: pairs.length, inliers: keep.length, residual, before }
}
