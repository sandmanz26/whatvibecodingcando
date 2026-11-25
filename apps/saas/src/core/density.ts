/**
 * The maths behind every heatmap, kept pure (no DOM) so it is tested in Node (tests/heatmap.test.ts).
 *
 * Density: a Gaussian kernel density estimate. Points are binned onto a coarse grid (cell = half of
 * the bandwidth) and blurred with a separable Gaussian, so the cost is O(points + grid × kernel), not
 * O(points × pixels): 100,000 points take milliseconds. The bandwidth starts from Silverman's rule
 * (clamped to a floor that matches how precise the data really is, e.g. webcam eye tracking) and is
 * adaptive: points in sparse areas get a wider kernel, points in dense areas a narrower one
 * (sample-point estimator, Abramson's square-root law, clamped to 0.6–1.6× and quantised into five widths).
 */

export interface DPt { x: number; y: number; w?: number }

/** p-th percentile (0–100) with linear interpolation. Empty → 0. */
export function percentile(values: ArrayLike<number>, p: number): number {
  const n = values.length
  if (!n) return 0
  const s = Float64Array.from(values as ArrayLike<number>).sort()
  const k = Math.min(n - 1, Math.max(0, (p / 100) * (n - 1)))
  const lo = Math.floor(k), hi = Math.ceil(k)
  return s[lo] + (s[hi] - s[lo]) * (k - lo)
}

/** Silverman's rule of thumb for 2-D points (average of both axes), weighted. Null when it can't be estimated (< 2 points or no spread). */
export function silverman(points: DPt[]): number | null {
  let W = 0
  for (const p of points) W += p.w ?? 1
  if (points.length < 2 || W <= 0) return null
  const axis = (get: (p: DPt) => number) => {
    let m = 0
    for (const p of points) m += get(p) * (p.w ?? 1)
    m /= W
    let v = 0
    for (const p of points) v += (p.w ?? 1) * (get(p) - m) ** 2
    const sd = Math.sqrt(v / W)
    const vals = points.map(get)
    const iqr = percentile(vals, 75) - percentile(vals, 25)
    const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd
    return spread
  }
  const s = (axis((p) => p.x) + axis((p) => p.y)) / 2
  if (!(s > 0)) return null
  // Effective sample size, so weighted points (fixation durations, per-person shares) don't overstate n.
  let w2 = 0
  for (const p of points) w2 += (p.w ?? 1) ** 2
  const nEff = Math.max(2, (W * W) / (w2 || 1))
  return 1.06 * s * Math.pow(nEff, -1 / 6) // d = 2: n^(-1/(d+4))
}

/** The bandwidth to use: Silverman's estimate, never finer than `min` (the data's real precision) nor coarser than `max`. */
export function bandwidth(points: DPt[], min: number, max: number): number {
  const s = silverman(points)
  return Math.min(max, Math.max(min, s ?? min))
}

/** 1-D Gaussian kernel (normalised to 1) for sigma in cells. */
function kernel(sigma: number) {
  const r = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float32Array(r * 2 + 1)
  let s = 0
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; s += v }
  for (let i = 0; i < k.length; i++) k[i] /= s
  return { k, r }
}

/** Separable Gaussian blur of a gw×gh grid, in place (tmp: a scratch buffer of the same size). */
export function blur(grid: Float32Array, gw: number, gh: number, sigma: number, tmp = new Float32Array(grid.length)) {
  if (sigma <= 0) return grid
  const { k, r } = kernel(sigma)
  for (let y = 0; y < gh; y++) {
    const row = y * gw
    for (let x = 0; x < gw; x++) {
      let s = 0
      const a = Math.max(-r, -x), b = Math.min(r, gw - 1 - x)
      for (let i = a; i <= b; i++) s += grid[row + x + i] * k[i + r]
      tmp[row + x] = s
    }
  }
  for (let x = 0; x < gw; x++) {
    for (let y = 0; y < gh; y++) {
      let s = 0
      const a = Math.max(-r, -y), b = Math.min(r, gh - 1 - y)
      for (let i = a; i <= b; i++) s += tmp[(y + i) * gw + x] * k[i + r]
      grid[y * gw + x] = s
    }
  }
  return grid
}

/** Bilinear splat of one weighted point onto the grid (keeps sub-cell position, so no blockiness). */
function splat(g: Float32Array, gw: number, gh: number, gx: number, gy: number, w: number) {
  const x0 = Math.floor(gx - 0.5), y0 = Math.floor(gy - 0.5)
  const fx = gx - 0.5 - x0, fy = gy - 0.5 - y0
  const put = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < gw && y < gh) g[y * gw + x] += v }
  put(x0, y0, w * (1 - fx) * (1 - fy)); put(x0 + 1, y0, w * fx * (1 - fy))
  put(x0, y0 + 1, w * (1 - fx) * fy); put(x0 + 1, y0 + 1, w * fx * fy)
}

export interface Density { grid: Float32Array; gw: number; gh: number; cell: number; h: number; /** weight per cell at the busiest 99th-percentile cell */ vmax: number }
export interface KdeOpts { width: number; height: number; h: number; adaptive?: boolean; maxCells?: number }

const FACTORS = [0.6, 0.77, 1, 1.26, 1.6]

/**
 * Kernel density over a width×height area (same units as the points). Each cell holds the weight per
 * cell (sum over the grid ≈ total weight of the points inside). Grid size is bounded by maxCells
 * (default 160,000), so memory stays bounded whatever the page height.
 */
export function kde(points: DPt[], o: KdeOpts): Density {
  const maxCells = o.maxCells ?? 160_000
  let cell = Math.max(1, o.h / 2)
  if ((o.width / cell) * (o.height / cell) > maxCells) cell = Math.sqrt((o.width * o.height) / maxCells)
  const gw = Math.max(1, Math.ceil(o.width / cell)), gh = Math.max(1, Math.ceil(o.height / cell))
  const grid = new Float32Array(gw * gh)
  const tmp = new Float32Array(gw * gh)
  const sigma = o.h / cell
  const inside = points.filter((p) => p.x >= -o.h * 3 && p.y >= -o.h * 3 && p.x <= o.width + o.h * 3 && p.y <= o.height + o.h * 3 && (p.w ?? 1) > 0)
  if (!inside.length) return { grid, gw, gh, cell, h: o.h, vmax: 0 }
  if (!o.adaptive || inside.length < 8) {
    for (const p of inside) splat(grid, gw, gh, p.x / cell, p.y / cell, p.w ?? 1)
    blur(grid, gw, gh, sigma, tmp)
  } else {
    // Pilot: fixed bandwidth. Then each point's own width ∝ (pilot density / geometric mean)^(-1/2).
    const pilot = new Float32Array(gw * gh)
    for (const p of inside) splat(pilot, gw, gh, p.x / cell, p.y / cell, p.w ?? 1)
    blur(pilot, gw, gh, sigma, tmp)
    const f = inside.map((p) => {
      const x = Math.min(gw - 1, Math.max(0, Math.floor(p.x / cell))), y = Math.min(gh - 1, Math.max(0, Math.floor(p.y / cell)))
      return Math.max(1e-9, pilot[y * gw + x])
    })
    const g = Math.exp(f.reduce((s, v) => s + Math.log(v), 0) / f.length)
    const layers = FACTORS.map(() => null as Float32Array | null)
    inside.forEach((p, i) => {
      const lam = Math.min(1.6, Math.max(0.6, Math.sqrt(g / f[i])))
      let best = 0
      for (let j = 1; j < FACTORS.length; j++) if (Math.abs(Math.log(FACTORS[j] / lam)) < Math.abs(Math.log(FACTORS[best] / lam))) best = j
      const L = (layers[best] ??= new Float32Array(gw * gh))
      splat(L, gw, gh, p.x / cell, p.y / cell, p.w ?? 1)
    })
    layers.forEach((L, j) => {
      if (!L) return
      blur(L, gw, gh, sigma * FACTORS[j], tmp)
      for (let i = 0; i < grid.length; i++) grid[i] += L[i]
    })
  }
  return { grid, gw, gh, cell, h: o.h, vmax: robustMax(grid) }
}

/** The value that reads as the top of the scale: the 99th percentile of the cells that have any heat (so one extreme spot doesn't wash out the rest). */
export function robustMax(grid: Float32Array): number {
  let peak = 0
  for (let i = 0; i < grid.length; i++) if (grid[i] > peak) peak = grid[i]
  if (!peak) return 0
  const busy: number[] = []
  const floor = peak * 1e-3
  for (let i = 0; i < grid.length; i++) if (grid[i] >= floor) busy.push(grid[i])
  return Math.max(peak * 0.05, percentile(busy, 99))
}

/* ---------- colour ---------- */

/** Inferno (perceptually uniform, readable in greyscale and for colour-blind people), sampled at 9 stops. */
const INFERNO: [number, number, number][] = [[0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]]
export const LUT = (() => {
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (INFERNO.length - 1), k = Math.min(INFERNO.length - 2, Math.floor(t)), f = t - k
    for (let j = 0; j < 3; j++) out[i * 3 + j] = INFERNO[k][j] + (INFERNO[k + 1][j] - INFERNO[k][j]) * f
  }
  return out
})()
/** The legend's CSS gradient, starting where heat becomes visible. */
export const LEGEND = `linear-gradient(90deg, ${INFERNO.slice(2).map((c, i, a) => `rgb(${c.join(',')}) ${Math.round((i / (a.length - 1)) * 100)}%`).join(', ')})`

export type Scaling = 'linear' | 'sqrt' | 'log'
/** Value → 0..1 on the colour scale (clipped at vmax). */
export function level(v: number, vmax: number, scaling: Scaling = 'sqrt') {
  if (!(vmax > 0) || !(v > 0)) return 0
  const t = Math.min(1, v / vmax)
  return scaling === 'linear' ? t : scaling === 'sqrt' ? Math.sqrt(t) : Math.log1p(t * 99) / Math.log(100)
}

/**
 * Colours a density into RGBA pixels (one per grid cell). Below `threshold` (share of the scale) is
 * fully transparent so noise isn't painted; above it alpha ramps up to `opacity`. `out` is reused when it fits.
 */
export function colourise(d: Density, opacity: number, scaling: Scaling = 'sqrt', threshold = 0.12, out?: Uint8ClampedArray) {
  const px = out && out.length === d.gw * d.gh * 4 ? out : new Uint8ClampedArray(d.gw * d.gh * 4)
  // Leaves start of the map (dark inferno) out: begins at ~20% so the lowest visible heat is purple, not black.
  for (let i = 0; i < d.grid.length; i++) {
    const t = level(d.grid[i], d.vmax, scaling)
    const o = i * 4
    if (t < threshold * 0.5) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; continue }
    const c = Math.round((0.22 + 0.78 * t) * 255) * 3
    px[o] = LUT[c]; px[o + 1] = LUT[c + 1]; px[o + 2] = LUT[c + 2]
    // Smooth fade-in from half the threshold to twice it (no hard, blocky edge), then a gentle ramp.
    const e = Math.min(1, Math.max(0, (t - threshold * 0.5) / (threshold * 1.5)))
    px[o + 3] = Math.round(255 * opacity * e * e * (3 - 2 * e) * Math.min(1, 0.55 + 0.45 * t))
  }
  return px
}

/* ---------- events: quality and insight ---------- */

export interface Ev { p: number; t: number; x: number; y: number; sel?: string | null; label?: string | null; dead?: boolean | null; trusted?: boolean }

/** Drops repeats: the same person, within `ms` and `px` of their previous event (double-fired handlers, double counting), and events marked untrusted. */
export function dedupe<T extends Ev>(evs: T[], ms = 80, px = 4): T[] {
  const last = new Map<number, Ev>()
  return [...evs].sort((a, b) => a.p - b.p || a.t - b.t).filter((e) => {
    if (e.trusted === false) return false
    const l = last.get(e.p)
    last.set(e.p, e)
    return !(l && e.t - l.t < ms && Math.abs(e.x - l.x) <= px && Math.abs(e.y - l.y) <= px)
  })
}

/** Keeps each person's first `max` events, so one person can't dominate a page. */
export function capPerPerson<T extends Ev>(evs: T[], max: number): { kept: T[]; dropped: number } {
  const n = new Map<number, number>()
  const kept = [...evs].sort((a, b) => a.p - b.p || a.t - b.t).filter((e) => { const c = (n.get(e.p) ?? 0) + 1; n.set(e.p, c); return c <= max })
  return { kept, dropped: evs.length - kept.length }
}

/** Rage clicks: ≥ min clicks by one person within `ms` and `px` of each other. Returns the indices (into evs) that are part of a burst. */
export function rageClicks(evs: Ev[], ms = 1000, px = 30, min = 3): Set<number> {
  const out = new Set<number>()
  const idx = evs.map((_, i) => i).sort((a, b) => evs[a].p - evs[b].p || evs[a].t - evs[b].t)
  for (let s = 0; s < idx.length; s++) {
    const a = evs[idx[s]]
    const burst = [idx[s]]
    for (let j = s + 1; j < idx.length; j++) {
      const b = evs[idx[j]]
      if (b.p !== a.p || b.t - a.t > ms) break
      if (Math.hypot(b.x - a.x, b.y - a.y) <= px) burst.push(idx[j])
    }
    if (burst.length >= min) burst.forEach((i) => out.add(i))
  }
  return out
}

/** Dead click: on nothing interactive, and nothing changed on the page (DOM or address) within the wait. */
export const isDeadClick = (interactive: boolean, changed: boolean) => !interactive && !changed

export interface Ranked { sel: string; label: string; clicks: number; people: number; share: number; firstShare: number; dead: number }
/** Most clicked elements: clicks, % of participants who clicked it, and % of participants whose first click it was. */
export function rankElements(evs: Ev[], top = 10): Ranked[] {
  const people = new Set(evs.map((e) => e.p)).size
  if (!people) return []
  const first = new Map<number, Ev>()
  for (const e of evs) { const f = first.get(e.p); if (!f || e.t < f.t) first.set(e.p, e) }
  const m = new Map<string, { label: string; clicks: number; who: Set<number>; first: number; dead: number }>()
  for (const e of evs) {
    if (!e.sel) continue
    const g = m.get(e.sel) ?? { label: e.label ?? e.sel, clicks: 0, who: new Set<number>(), first: 0, dead: 0 }
    g.clicks++; g.who.add(e.p); if (e.dead) g.dead++
    m.set(e.sel, g)
  }
  for (const f of first.values()) if (f.sel) { const g = m.get(f.sel); if (g) g.first++ }
  return [...m.entries()].map(([sel, g]) => ({ sel, label: g.label, clicks: g.clicks, people: g.who.size, share: g.who.size / people, firstShare: g.first / people, dead: g.dead }))
    .sort((a, b) => b.people - a.people || b.clicks - a.clicks || a.sel.localeCompare(b.sel)).slice(0, top)
}

/** Under this many participants a heatmap is an early signal, not a finding. */
export const MIN_PEOPLE = 10
export const sampleNote = (people: number) => (people < MIN_PEOPLE ? `Early signal: ${people} ${people === 1 ? 'person' : 'people'} so far (${MIN_PEOPLE}+ for a pattern you can trust)` : null)
