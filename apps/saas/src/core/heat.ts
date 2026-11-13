/**
 * Drawing a real heatmap: every tap is a soft blob of heat, blobs add up where taps cluster,
 * and the summed heat is coloured from blue (a few taps) to red (the most). The densest spot
 * always reaches red, so the colours read the same for 20 taps or 20,000.
 */

/** w: how much the point counts (1 by default), e.g. a fixation's duration or one person's share. */
export interface HeatPoint { x: number; y: number; w?: number }

const STOPS: [number, [number, number, number]][] = [
  [0, [0, 0, 255]], [0.3, [0, 160, 255]], [0.5, [0, 220, 120]], [0.7, [190, 235, 0]], [0.85, [255, 170, 0]], [1, [240, 30, 20]],
]
/** 256 colours along the scale, as [r, g, b] per heat level. */
const PALETTE = (() => {
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++
    const [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1]
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
    for (let j = 0; j < 3; j++) out[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f
  }
  return out
})()
export const LEGEND = `linear-gradient(90deg, ${STOPS.map(([t, c]) => `rgb(${c.join(',')}) ${t * 100}%`).join(', ')})`

/**
 * The density that should read as red: the weight within one blob's reach, at the 95th percentile of
 * the busy cells rather than the very busiest, so one extreme spot doesn't wash out the rest.
 */
function peak(points: HeatPoint[], r: number) {
  const cells = new Map<string, number>()
  for (const p of points) {
    const k = `${Math.floor(p.x / r)},${Math.floor(p.y / r)}`
    cells.set(k, (cells.get(k) ?? 0) + (p.w ?? 1))
  }
  const v = [...cells.values()].sort((a, b) => a - b)
  if (!v.length) return 1
  return Math.max(1e-6, v.length >= 20 ? v[Math.floor(v.length * 0.95)] : v[v.length - 1])
}

/**
 * Draws points (in page px) onto a canvas covering the page at `scale`.
 * radius: blob size in page px. opacity: 0–1 for the coloured layer.
 */
export function drawHeat(canvas: HTMLCanvasElement, points: HeatPoint[], scale: number, radius: number, opacity: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx || !points.length) { ctx?.clearRect(0, 0, w, h); return }
  const r = Math.max(4, radius * scale * dpr)
  // One soft blob, drawn once and stamped for every tap.
  const blob = document.createElement('canvas')
  blob.width = blob.height = Math.ceil(r * 2)
  const b = blob.getContext('2d')!
  const g = b.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  b.fillStyle = g; b.fillRect(0, 0, r * 2, r * 2)
  // Each stamp's strength is set so that the densest cluster just saturates.
  const n = peak(points, radius)
  const base = Math.min(1, Math.max(0.02, 1 - Math.pow(0.04, 1 / Math.max(1, n))))
  const unit = n < 1 ? 1 / n : 1
  for (const p of points) {
    ctx.globalAlpha = Math.min(1, base * (p.w ?? 1) * unit)
    ctx.drawImage(blob, p.x * scale * dpr - r, p.y * scale * dpr - r)
  }
  ctx.globalAlpha = 1
  // Colour the summed heat.
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a < 6) { d[i + 3] = 0; continue }
    d[i] = PALETTE[a * 3]; d[i + 1] = PALETTE[a * 3 + 1]; d[i + 2] = PALETTE[a * 3 + 2]
    d[i + 3] = Math.min(255, (60 + a * 0.85) * opacity)
  }
  ctx.putImageData(img, 0, 0)
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
