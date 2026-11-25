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
