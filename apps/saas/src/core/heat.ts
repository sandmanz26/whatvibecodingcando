/**
 * Drawing a real heatmap: a kernel density estimate of the taps (core/density.ts), coloured on a
 * perceptually uniform scale (inferno) whose top is the 99th-percentile density, so the colours read
 * the same for 20 taps or 20,000 and one extreme spot doesn't wash out the rest.
 */

/** w: how much the point counts (1 by default), e.g. a fixation's duration or one person's share. */
import { bandwidth, colourise, kde, kdeGroups, type Density, type Scaling } from './density'

export interface HeatPoint { x: number; y: number; w?: number }

export { LEGEND } from './density'

export interface HeatStats { /** points drawn */ n: number; /** bandwidth in page px */ h: number; /** weight per 50×50 page px at the top of the scale */ top: number; ms: number }

/** One offscreen canvas and pixel buffer per heatmap canvas, reused between draws (bounded memory). */
const buffers = new WeakMap<HTMLCanvasElement, { off: HTMLCanvasElement; px?: Uint8ClampedArray }>()

/**
 * Draws points (in page px) onto a canvas covering the page at `scale`. The density is an adaptive
 * Gaussian KDE (core/density.ts) on a coarse grid, coloured once into a small offscreen image and
 * stretched with smoothing onto the canvas, so the cost hardly depends on the canvas size.
 * radius: the finest detail the data supports, in page px (e.g. webcam eye-tracking accuracy):
 * the bandwidth (Gaussian sigma) stays between 0.4× and 0.6× of it. opacity: 0–1 for the coloured layer.
 */
export function drawHeat(canvas: HTMLCanvasElement, points: HeatPoint[], scale: number, radius: number, opacity: number, scaling: Scaling = 'sqrt'): HeatStats {
  const t0 = performance.now()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, w, h)
  if (!ctx || !points.length) return { n: 0, h: 0, top: 0, ms: 0 }
  const k = scale * dpr
  const pts = points.map((p) => ({ x: p.x * k, y: p.y * k, w: p.w ?? 1 }))
  const hPage = bandwidth(points, Math.max(5, radius * 0.4), Math.max(8, radius * 0.6))
  const d = kde(pts, { width: w, height: h, h: hPage * k, adaptive: true })
  paint(canvas, ctx, d, opacity, scaling)
  const cellPage = d.cell / k
  return { n: points.length, h: Math.round(hPage), top: d.vmax * (2500 / (cellPage * cellPage)), ms: performance.now() - t0 }
}

function paint(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, d: Density, opacity: number, scaling: Scaling) {
  let buf = buffers.get(canvas)
  if (!buf) { buf = { off: document.createElement('canvas') }; buffers.set(canvas, buf) }
  if (buf.off.width !== d.gw) buf.off.width = d.gw
  if (buf.off.height !== d.gh) buf.off.height = d.gh
  buf.px = colourise(d, opacity, scaling, 0.12, buf.px)
  buf.off.getContext('2d')!.putImageData(new ImageData(buf.px as Uint8ClampedArray<ArrayBuffer>, d.gw, d.gh), 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(buf.off, 0, 0, d.gw * d.cell, d.gh * d.cell)
}

/**
 * Like drawHeat, but each group has its own bandwidth in page px (e.g. each eye-tracking run blurred
 * by that run's own measured error, never by one global value).
 */
export function drawHeatGroups(canvas: HTMLCanvasElement, groups: { points: HeatPoint[]; h: number }[], scale: number, opacity: number, scaling: Scaling = 'sqrt'): HeatStats {
  const t0 = performance.now()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, w, h)
  const n = groups.reduce((s, g) => s + g.points.length, 0)
  if (!ctx || !n) return { n: 0, h: 0, top: 0, ms: 0 }
  const k = scale * dpr
  const d = kdeGroups(groups.map((g) => ({ h: g.h * k, points: g.points.map((p) => ({ x: p.x * k, y: p.y * k, w: p.w ?? 1 })) })), { width: w, height: h })
  paint(canvas, ctx, d, opacity, scaling)
  const cellPage = d.cell / k
  return { n, h: Math.round(d.h / k), top: d.vmax * (2500 / (cellPage * cellPage)), ms: performance.now() - t0 }
}

/* ---------- sample data ---------- */

/** A small seeded random generator, so the same screen gives the same sample every time. */
function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const gauss = (rand: () => number) => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

export interface SampleTap extends HeatPoint { sel: Element; dead: boolean }
export { rng }

/**
 * Made-up taps for showing how the heatmap reads, built from the real screen: people tap
 * controls far more than anything else, the search and main buttons most, and less the
 * further down the page something is. A few taps land on things that aren't controls (images).
 */
export function sampleTaps(doc: Document, seed: string, foldH: number, count = 420, boost?: (el: Element) => number): SampleTap[] {
  const rand = rng(seed)
  const cands: { el: Element; r: DOMRect; w: number; dead: boolean }[] = []
  const seen = new Set<Element>()
  const add = (el: Element, weight: number, dead = false) => {
    if (seen.has(el)) return
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return
    seen.add(el)
    cands.push({ el, r, w: weight * Math.exp(-r.top / (foldH * 1.8)) * (boost?.(el) ?? 1), dead })
  }
  doc.querySelectorAll('input[type=search], input:not([type]), input[type=text]').forEach((e) => add(e, 7))
  doc.querySelectorAll('.btn.primary').forEach((e) => add(e, 5))
  doc.querySelectorAll('.pcard, .pcard-add').forEach((e) => add(e, 3))
  doc.querySelectorAll('.chip, .cat-tile, .hero2-ideas button').forEach((e) => add(e, 2.4))
  doc.querySelectorAll('header a, header button, nav a').forEach((e) => add(e, 1.8))
  doc.querySelectorAll('a, button, [role=button], select').forEach((e) => add(e, 1))
  doc.querySelectorAll('.ph, h1, h2').forEach((e) => add(e, 0.5, true))
  const total = cands.reduce((s, c) => s + c.w, 0)
  if (!total) return []
  const out: SampleTap[] = []
  for (let i = 0; i < count; i++) {
    let pick = rand() * total
    const c = cands.find((x) => (pick -= x.w) <= 0) ?? cands[cands.length - 1]
    const cx = c.r.left + c.r.width / 2, cy = c.r.top + c.r.height / 2
    const x = Math.min(c.r.right - 2, Math.max(c.r.left + 2, cx + gauss(rand) * c.r.width * 0.18))
    const y = Math.min(c.r.bottom - 2, Math.max(c.r.top + 2, cy + gauss(rand) * c.r.height * 0.22))
    out.push({ x, y, sel: c.el, dead: c.dead })
  }
  return out
}
