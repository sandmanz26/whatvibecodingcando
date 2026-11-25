// Heatmap maths: KDE, bandwidth, percentile, colour, rage/dead, ranking, caps (no browser needed).
// Run: node apps/saas/tests/heatmap.test.ts   (Node 22.18+ runs TypeScript directly)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bandwidth, capPerPerson, colourise, dedupe, isDeadClick, kde, level, percentile, rageClicks, rankElements, robustMax, sampleNote, silverman, type DPt, type Ev } from '../src/core/density.ts'

const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0)
let seed = 7
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())

test('percentile: empty, one, interpolation, unsorted input untouched', () => {
  assert.equal(percentile([], 50), 0)
  assert.equal(percentile([5], 99), 5)
  const xs = [4, 1, 3, 2]
  assert.equal(percentile(xs, 50), 2.5)
  assert.equal(percentile(xs, 0), 1)
  assert.equal(percentile(xs, 100), 4)
  assert.deepEqual(xs, [4, 1, 3, 2])
})

test('bandwidth: null/floor for 0, 1 or identical points; shrinks as n grows; clamped', () => {
  assert.equal(silverman([]), null)
  assert.equal(silverman([{ x: 1, y: 1 }]), null)
  assert.equal(silverman(Array.from({ length: 50 }, () => ({ x: 10, y: 10 }))), null)
  assert.equal(bandwidth([], 20, 80), 20)
  const make = (n: number) => Array.from({ length: n }, () => ({ x: 500 + gauss() * 100, y: 500 + gauss() * 100 }))
  const a = silverman(make(100))!, b = silverman(make(10000))!
  assert.ok(a > b, `${a} > ${b}`)
  assert.ok(a > 40 && a < 80, String(a))
  assert.equal(bandwidth(make(100), 90, 120), 90)
  assert.equal(bandwidth(make(100), 1, 5), 5)
})

test('kde: empty and off-area points give an empty grid', () => {
  const d = kde([], { width: 100, height: 100, h: 10 })
  assert.equal(sum(d.grid), 0); assert.equal(d.vmax, 0)
  assert.equal(sum(kde([{ x: -999, y: 5 }], { width: 100, height: 100, h: 10 }).grid), 0)
})

test('kde: one point keeps its weight, peaks at the point, symmetric', () => {
  const d = kde([{ x: 50, y: 50, w: 3 }], { width: 100, height: 100, h: 9 })
  assert.ok(Math.abs(sum(d.grid) - 3) < 0.01, String(sum(d.grid)))
  let best = 0
  for (let i = 0; i < d.grid.length; i++) if (d.grid[i] > d.grid[best]) best = i
  const bx = (best % d.gw + 0.5) * d.cell, by = (Math.floor(best / d.gw) + 0.5) * d.cell
  assert.ok(Math.abs(bx - 50) <= d.cell && Math.abs(by - 50) <= d.cell)
})

test('kde: all points at one spot equals one heavy point (adaptive too)', () => {
  const same = Array.from({ length: 40 }, () => ({ x: 30, y: 70 }))
  const a = kde(same, { width: 200, height: 200, h: 12, adaptive: true }), b = kde([{ x: 30, y: 70, w: 40 }], { width: 200, height: 200, h: 12 })
  for (let i = 0; i < a.grid.length; i++) assert.ok(Math.abs(a.grid[i] - b.grid[i]) < 1e-3)
})

test('kde adaptive: mass is kept, sparse points spread wider than dense ones', () => {
  const pts: DPt[] = [...Array.from({ length: 300 }, () => ({ x: 200 + gauss() * 10, y: 200 + gauss() * 10 })), { x: 600, y: 600 }]
  const d = kde(pts, { width: 800, height: 800, h: 20, adaptive: true })
  assert.ok(Math.abs(sum(d.grid) - 301) < 1)
  const at = (x: number, y: number) => d.grid[Math.floor(y / d.cell) * d.gw + Math.floor(x / d.cell)]
  const fixed = kde([{ x: 600, y: 600 }], { width: 800, height: 800, h: 20 })
  const atF = (x: number, y: number) => fixed.grid[Math.floor(y / fixed.cell) * fixed.gw + Math.floor(x / fixed.cell)]
  assert.ok(at(600, 600) < atF(600, 600), 'the lone point is widened (lower peak)')
})

test('kde: 100k points stay fast and bounded', () => {
  const pts = Array.from({ length: 100_000 }, () => ({ x: rand() * 1400, y: rand() * 6000 }))
  const t = performance.now()
  const d = kde(pts, { width: 1400, height: 6000, h: 8, adaptive: true })
  const ms = performance.now() - t
  assert.ok(d.gw * d.gh <= 160_000 + d.gw + d.gh, `${d.gw}x${d.gh}`)
  assert.ok(ms < 3000, `${ms} ms`)
  assert.ok(Math.abs(sum(d.grid) - 100_000) / 100_000 < 0.05)
})

test('colour: robust max ignores one extreme cell, threshold leaves noise transparent, scalings', () => {
  const g = new Float32Array(1000).fill(1); g[0] = 1000
  assert.ok(robustMax(g) < 100)
  assert.equal(level(0, 10), 0); assert.equal(level(20, 10), 1); assert.equal(level(5, 0), 0)
  assert.ok(level(1, 100, 'sqrt') > level(1, 100, 'linear'))
  assert.ok(level(1, 100, 'log') > level(1, 100, 'sqrt'))
  const px = colourise({ grid: Float32Array.from([0, 0.001, 5, 10]), gw: 4, gh: 1, cell: 1, h: 1, vmax: 10 }, 0.8)
  assert.equal(px[3], 0); assert.equal(px[7], 0)
  assert.ok(px[11] > 0 && px[15] > px[11])
  assert.ok(px[15] <= 255 * 0.8 + 1)
})

const ev = (p: number, t: number, x = 0, y = 0, sel: string | null = 'a', extra: Partial<Ev> = {}): Ev => ({ p, t, x, y, sel, label: sel, ...extra })

test('dedupe: double-fired events and untrusted ones are dropped, other people kept', () => {
  const out = dedupe([ev(1, 0), ev(1, 30), ev(1, 500), ev(2, 30), ev(1, 600, 0, 0, 'a', { trusted: false })])
  assert.equal(out.length, 3)
  assert.deepEqual(dedupe([]), [])
})

test('cap per person: first N kept, others untouched', () => {
  const evs = [...Array.from({ length: 100 }, (_, i) => ev(1, i * 1000)), ev(2, 5)]
  const { kept, dropped } = capPerPerson(evs, 60)
  assert.equal(kept.filter((e) => e.p === 1).length, 60); assert.equal(dropped, 40)
  assert.ok(kept.some((e) => e.p === 2))
  assert.ok(kept.filter((e) => e.p === 1).every((e) => e.t < 60_000))
})

test('rage: 3 clicks in 1 s and 30 px; slow, far or other people are not', () => {
  const evs = [ev(1, 0, 10, 10), ev(1, 300, 15, 12), ev(1, 600, 12, 18), ev(1, 5000, 10, 10), ev(1, 5300, 200, 10), ev(1, 5600, 400, 10), ev(2, 0, 10, 10), ev(3, 0, 10, 10), ev(3, 1500, 10, 10), ev(3, 3000, 10, 10)]
  assert.deepEqual([...rageClicks(evs)].sort((a, b) => a - b), [0, 1, 2])
  assert.equal(rageClicks([]).size, 0)
})

test('dead click: only non-interactive with no change', () => {
  assert.equal(isDeadClick(false, false), true)
  assert.equal(isDeadClick(false, true), false)
  assert.equal(isDeadClick(true, false), false)
})

test('ranking: % of people, first-click share, dead counts; empty', () => {
  assert.deepEqual(rankElements([]), [])
  const r = rankElements([ev(1, 0, 0, 0, 'buy'), ev(1, 5, 0, 0, 'buy'), ev(1, 9, 0, 0, 'img', { dead: true }), ev(2, 1, 0, 0, 'img', { dead: true }), ev(2, 3, 0, 0, 'buy'), ev(3, 0, 0, 0, null)])
  assert.equal(r[0].sel, 'buy'); assert.equal(r[0].people, 2); assert.equal(r[0].clicks, 3)
  assert.ok(Math.abs(r[0].share - 2 / 3) < 1e-9); assert.ok(Math.abs(r[0].firstShare - 1 / 3) < 1e-9)
  assert.equal(r[1].sel, 'img'); assert.equal(r[1].dead, 2); assert.ok(Math.abs(r[1].firstShare - 1 / 3) < 1e-9)
})

test('sample note: early signal under 10 people', () => {
  assert.match(sampleNote(1)!, /1 person/)
  assert.match(sampleNote(9)!, /9 people/)
  assert.equal(sampleNote(10), null)
})

test('mixed devices are never mixed by the maths: callers filter, density keeps only what it gets', () => {
  const desk = Array.from({ length: 20 }, () => ({ x: 1000, y: 100 })), mob = Array.from({ length: 20 }, () => ({ x: 100, y: 100 }))
  const d = kde(desk, { width: 1200, height: 300, h: 10 })
  assert.equal(d.grid[Math.floor(100 / d.cell) * d.gw + Math.floor(100 / d.cell)], 0)
  assert.ok(kde([...desk, ...mob], { width: 1200, height: 300, h: 10 }).grid[Math.floor(100 / d.cell) * d.gw + Math.floor(100 / d.cell)] > 0)
})

/* ---------- v4: meaning, not just maths ---------- */
// The app's modules import each other without extensions (Vite style): resolve those for Node here.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { if (/^\\.\\.?\\//.test(s) && !/\\.[cm]?[jt]sx?$/.test(s)) return next(s + '.ts', c); throw e } }`))
const { binPoints, binsToPoints, compareShares, ctrPerView, cleanGaze, driftOf, exposureWeight, fmtShare, normCdf, pairsOf, place, reachCurve, reachFrom, rowOf, smoothGaze, wilson, BINS_ACROSS } = await import('../src/core/heatstats.ts')
const { prepare } = await import('../src/core/embed/heatmath.ts')
const { viewOf, cleanSummary } = await import('../src/core/embed/heatsummary.ts')

test('wilson: textbook values, edges, never outside 0–1', () => {
  const a = wilson(38, 100)
  assert.ok(Math.abs(a.lo - 0.2910) < 0.001 && Math.abs(a.hi - 0.4779) < 0.001, `${a.lo} ${a.hi}`)
  const z = wilson(0, 10); assert.equal(z.lo, 0); assert.ok(Math.abs(z.hi - 0.2775) < 0.001)
  const f = wilson(10, 10); assert.equal(f.hi, 1); assert.ok(f.lo > 0.69 && f.lo < 0.73)
  assert.deepEqual(wilson(0, 0), { p: 0, lo: 0, hi: 0, half: 0 })
  assert.equal(fmtShare(38, 100), '38% ± 9')
  assert.equal(fmtShare(1, 0), '–')
  assert.ok(wilson(5, 10).half > wilson(500, 1000).half, 'more people → narrower')
})

test('normal CDF and two-proportion z-test: known values, plain words', () => {
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4)
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-6)
  // 45/100 vs 30/100: z ≈ 2.19, p ≈ 0.029
  const c = compareShares(30, 100, 45, 100, ['v1', 'v2'])
  assert.ok(Math.abs(c.z - 2.19) < 0.02, String(c.z)); assert.ok(Math.abs(c.p - 0.0285) < 0.002, String(c.p))
  assert.equal(c.real, true); assert.match(c.words, /v2 is 15 points higher than v1: likely a real difference/)
  const same = compareShares(30, 100, 33, 100)
  assert.equal(same.real, false); assert.match(same.words, /could be chance/)
  assert.match(compareShares(1, 3, 2, 3).words, /Too few people/)
})

test('exposure: CTR per view divides by people who saw it; reach curve; weights capped', () => {
  const c = ctrPerView(6, 12)
  assert.equal(c.p, 0.5); assert.equal(c.ok, true)
  assert.equal(ctrPerView(2, 3).ok, false, 'too few exposures greyed')
  assert.equal(ctrPerView(5, 2).p, 1, 'never above 100% (clickers always saw it)')
  // 20 people: 12 reached row 200, 8 stopped at row 50
  const reach = reachFrom([{ row: 200, people: 12 }, { row: 50, people: 8 }])
  assert.equal(reach(0), 1); assert.equal(reach(100), 0.6); assert.equal(reach(201), 0)
  assert.ok(Math.abs(exposureWeight(0.6, 12) - 1 / 0.6) < 1e-9)
  assert.equal(exposureWeight(0.1, 2), 1, 'too few people there: no adjustment')
  assert.equal(exposureWeight(0.05, 50), 5, 'capped at 5×')
  const curve = reachCurve([1, 1, 0.5, 0.25], 4)
  assert.deepEqual(curve.map((x) => x.share), [1, 1, 0.75, 0.5, 0.5])
  assert.equal(rowOf(1600, 1280), 100)
})

test('exposure: below-the-fold element is no longer unfairly cold', () => {
  // Top button: 40 of 100 people click it. Bottom button: only 20 people saw it, 10 clicked.
  const top = ctrPerView(40, 100), bottom = ctrPerView(10, 20)
  assert.ok(bottom.p > top.p, 'per view, the bottom button converts better')
  assert.ok(wilson(10, 100).p < wilson(40, 100).p, 'raw share of everyone says the opposite')
})

test('placement: unresolved or changed elements are counted, not drawn at stale coordinates', () => {
  const pts = [
    { sel: '#buy', x: 900, y: 100, ex: 0.5, ey: 0.5, vw: 1280, tag: 'button' },
    { sel: '#gone', x: 300, y: 300, ex: 0.5, ey: 0.5, vw: 1280, tag: 'a' },
    { sel: '#swap', x: 10, y: 10, ex: 0.5, ey: 0.5, vw: 1280, tag: 'button' },
    { sel: null, x: 640, y: 50, vw: 1280 },
  ]
  const els: Record<string, { left: number; top: number; width: number; height: number; tag: string }> = { '#buy': { left: 100, top: 200, width: 100, height: 40, tag: 'button' }, '#swap': { left: 0, top: 0, width: 50, height: 50, tag: 'img' } }
  const r = place(pts, (s) => els[s] ?? null, 640)
  assert.equal(r.unplaced, 2)
  assert.equal(r.placed.length, 2)
  assert.deepEqual([r.placed[0].px, r.placed[0].py], [150, 220], 'follows its element on this layout')
  assert.deepEqual([r.placed[1].px, r.placed[1].py], [320, 50], 'a click on bare page is scaled by width')
})

test('versions are never mixed by prepare', () => {
  const pts = [...Array.from({ length: 5 }, (_, i) => ({ x: 10, y: 10, vw: 1280, sel: null, ex: null, ey: null, rage: null, dead: null, p: i, t: i, ver: 'v1' })),
    ...Array.from({ length: 3 }, (_, i) => ({ x: 900, y: 10, vw: 1280, sel: null, ex: null, ey: null, rage: null, dead: null, p: 10 + i, t: i, ver: 'v2' }))]
  const a = prepare(pts, { kind: 'click', device: 'all', equal: true, maxAcc: null, version: 'v1' })
  assert.equal(a.people, 5); assert.ok(a.pts.every((p) => p.ver === 'v1'))
  assert.equal(prepare(pts, { kind: 'click', device: 'all', equal: true, maxAcc: null, version: 'v2' }).people, 3)
})

test('binned KDE equals point KDE within tolerance', () => {
  const vw = 1280
  const pts = Array.from({ length: 4000 }, (_, i) => ({ x: Math.min(1279, Math.max(0, 640 + gauss() * 200)), y: Math.max(0, 900 + gauss() * 300), vw, p: i % 50 }))
  const bins = binPoints(pts)
  assert.equal(bins.reduce((s, b) => s + b.n, 0), 4000, 'every point in a bin')
  const fromBins = binsToPoints(bins, vw, false)
  const o = { width: vw, height: 2200, h: 40 }
  const a = kde(pts, o), b = kde(fromBins, o)
  let diff = 0, tot = 0
  for (let i = 0; i < a.grid.length; i++) { diff += Math.abs(a.grid[i] - b.grid[i]); tot += a.grid[i] }
  const rel = diff / tot
  assert.ok(rel < 0.03, `L1 difference ${(rel * 100).toFixed(2)}% (bin ${vw / BINS_ACROSS} px, bandwidth 40 px)`)
  console.log(`  binned vs point KDE: L1 difference ${(rel * 100).toFixed(2)}%`)
  // equal weighting uses distinct people per bin
  assert.ok(binsToPoints(bins, vw, true).every((p, i) => p.w === bins[i].people))
})

test('gaze cleaning drops off-page, blink and low-confidence samples; smoothing reduces jitter', () => {
  const s = [{ t: 0, x: 100, y: 100 }, { t: 200, x: 0, y: 0 }, { t: 400, x: -500, y: 10 }, { t: 600, x: NaN, y: 1 }, { t: 800, x: 50, y: 50, c: 0.1 }, { t: 1000, x: 60, y: 60, c: 0.9 }]
  assert.deepEqual(cleanGaze(s, 1280, 5000).map((g) => g.t), [0, 1000])
  const noisy = Array.from({ length: 60 }, (_, i) => ({ t: i * 200, x: 500 + gauss() * 40, y: 300 + gauss() * 40 }))
  const sm = smoothGaze(noisy)
  const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
  assert.ok(sd(sm.slice(5).map((g) => g.x)) < sd(noisy.slice(5).map((g) => g.x)), 'smoothed is steadier')
})

test('drift correction recovers a known offset from clicks (with outliers)', () => {
  const offset = { dx: -63, dy: 41 } // the correction (click − gaze) the method should find
  const gaze: { t: number; x: number; y: number }[] = []
  const clicks: { t: number; x: number; y: number }[] = []
  for (let k = 0; k < 12; k++) {
    const cx = 100 + k * 90, cy = 200 + (k % 4) * 150, t = 5000 + k * 3000
    clicks.push({ t, x: cx, y: cy })
    // 3 of 12 clicks were made without looking (gaze elsewhere): outliers
    const away = k % 4 === 3
    for (let j = 1; j <= 4; j++) gaze.push({ t: t - j * 150, x: (away ? 900 : cx) - offset.dx + gauss() * 25, y: (away ? 900 : cy) - offset.dy + gauss() * 25 })
  }
  const pairs = pairsOf(gaze, clicks)
  assert.equal(pairs.length, 12)
  const d = driftOf(pairs)
  assert.equal(d.applied, true)
  const err = Math.hypot(d.dx - offset.dx, d.dy - offset.dy)
  console.log(`  drift recovery: true (${offset.dx}, ${offset.dy}) → estimated (${d.dx.toFixed(1)}, ${d.dy.toFixed(1)}), error ${err.toFixed(1)} px; residual ${d.residual.toFixed(1)} px (before ${d.before.toFixed(1)} px)`)
  assert.ok(err < 15, `recovered within 15 px (got ${err.toFixed(1)})`)
  assert.ok(d.residual < d.before / 2)
  assert.equal(driftOf(pairs.slice(0, 4)).applied, false, 'fewer than 5 pairs: not applied')
})

test('prepare (gaze): drift applied per run and each run gets its own bandwidth', () => {
  const pts: Parameters<typeof prepare>[0] = []
  const anchors: { p: number; t: number; x: number; y: number }[] = []
  for (let k = 0; k < 8; k++) {
    const t = 2000 + k * 2000, cx = 200 + k * 100, cy = 400
    anchors.push({ p: 1, t, x: cx, y: cy })
    for (let j = 1; j <= 5; j++) pts.push({ x: cx + 80, y: cy - 50, vw: 1280, sel: null, ex: null, ey: null, rage: null, dead: null, p: 1, t: t - j * 120, acc: 150 })
  }
  for (let j = 0; j < 20; j++) pts.push({ x: 600, y: 600, vw: 1280, sel: null, ex: null, ey: null, rage: null, dead: null, p: 2, t: j * 200, acc: 200 })
  const r = prepare(pts, { kind: 'gaze', device: 'all', equal: false, maxAcc: null, anchors })
  const d1 = r.drift.find((d) => d.p === 1)!, d2 = r.drift.find((d) => d.p === 2)!
  assert.equal(d1.applied, true); assert.ok(d1.residual < 20, String(d1.residual))
  assert.equal(d2.applied, false)
  assert.ok(r.groups.find((g) => g.p === 1)!.h < r.groups.find((g) => g.p === 2)!.h, 'the corrected run is drawn sharper')
})

test('summary view: per device and version, intervals, reach', () => {
  const s = cleanSummary({ bin: 80, groups: [{ dev: 'desktop', ver: 'v1', people: 20, clicks: 15 }, { dev: 'desktop', ver: 'v2', people: 10, clicks: 0 }],
    bins: [{ dev: 'desktop', ver: 'v1', bx: 40, by: 150, n: 12, people: 6 }],
    elements: [{ dev: 'desktop', ver: 'v1', sel: '#buy', label: 'button “Buy”', clicks: 12, people: 6, first: 6, rage: 0, dead: 0, seen: 12 }],
    depth: [{ dev: 'desktop', ver: 'v1', row: 200, frac: 1, people: 12 }, { dev: 'desktop', ver: 'v1', row: 50, frac: 0.25, people: 8 }] })
  const v = viewOf(s, 'all', 'v1')
  assert.equal(v.people, 20); assert.equal(v.elements[0].perView.p, 0.5); assert.equal(v.elements[0].ofPeople.p, 0.3)
  assert.equal(v.reach(100), 0.6); assert.equal(v.reachedAt(100), 12)
  assert.equal(viewOf(s, 'all', 'v2').elements.length, 0)
  assert.deepEqual(cleanSummary(null).bins, [])
})
