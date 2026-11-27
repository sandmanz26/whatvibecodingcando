// The panel's eye-tracking report: people per page, page keys and the page table.
// Run (its imports have no extensions, so it is bundled first):
//   cd apps/saas && npx rolldown tests/gaze-report.test.ts --format esm --platform node -o node_modules/.cache/gaze-report.mjs && node node_modules/.cache/gaze-report.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gazeReport, pageRows, type GazeEvent, type GazeRun } from '../src/saas/gaze-report.ts'
import { pageOf } from '../src/core/embed/pages.ts'

/** 5 participants, 3 with eye tracking; all three on "/", two on product pages with different ids. */
function data(splitLayouts = false) {
  const runs: GazeRun[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, gaze_accuracy: i < 3 ? 120 + i * 30 : null, vw: 1280 }))
  const events: GazeEvent[] = []
  const look = (run: string, page: string, n: number, x0: number) => {
    events.push({ run_id: run, t: 0, kind: 'page', page, label: null })
    for (let k = 0; k < n; k++) events.push({ run_id: run, t: 200 * (k + 1), kind: 'gaze', page, label: k < n / 2 ? 'h1 Title' : 'button Buy', x: x0 + (k < n / 2 ? 0 : 400), y: 200, vw: 1280 })
  }
  for (const [i, r] of ['a', 'b', 'c'].entries()) look(r, splitLayouts ? `/ · layout ${i + 1}` : '/', 12, 300)
  look('a', '/product/:id', 10, 200)
  look('b', '/product/123', 10, 210) // saved before the key rule: still the same page
  // the two people without eye tracking: clicks only
  for (const r of ['d', 'e']) events.push({ run_id: r, t: 100, kind: 'click', page: '/', label: 'button Buy', x: 700, y: 200, vw: 1280 })
  return { runs, events }
}

test('people per page count distinct runs across all runs (5 participants, 3 with eye tracking)', () => {
  const { runs, events } = data()
  const r = gazeReport(runs, events)
  assert.equal(r.participants, 3)
  const rows = pageRows(r.pages)
  const home = rows.find((x) => x.page === '/')!, product = rows.find((x) => x.page === '/product/:id')!
  console.log(`\nper-page people: / ${home.people}, /product/:id ${product.people} (before: every tile said 1 when layouts or id variants split them)`)
  assert.equal(home.people, 3)
  assert.equal(product.people, 2)
  assert.equal(rows.length, 2)
  assert.ok(home.fixations > 0 && home.top)
})

test('a page split by layout is one row; people counted once across layouts', () => {
  const { runs, events } = data(true)
  const r = gazeReport(runs, events)
  assert.equal(r.pages.filter((p) => p.page.startsWith('/ ·')).length, 3)
  assert.ok(r.pages.filter((p) => p.page.startsWith('/ ·')).every((p) => p.people === 1), 'each layout alone: 1 person (what the tiles showed)')
  const home = pageRows(r.pages).find((x) => x.page === '/')!
  assert.equal(home.people, 3)
  assert.equal(home.layouts.length, 3)
})

test('page keys: ids fold below the top level; top-level pages never become /:id by a slug rule', () => {
  assert.equal(pageOf('/product/123'), '/product/:id')
  assert.equal(pageOf('/order/3f2c1a9e-1d2b-4c5d-8e9f-0a1b2c3d4e5f'), '/order/:id')
  assert.equal(pageOf('/pricing'), '/pricing')
  assert.equal(pageOf('/2026'), '/2026')
  assert.equal(pageOf('/launch-week-2026-edition'), '/launch-week-2026-edition')
  assert.equal(pageOf('/1234567'), '/:id')
  assert.equal(pageOf('/'), '/')
})

test('participants: numbered in start order, reviewer names, grades, pages and duration', async () => {
  const { participantsOf, participantPath, sampleGaze } = await import('../src/saas/gaze-report.ts')
  const s = sampleGaze()
  const ps = participantsOf([...s.runs].reverse(), s.events)
  assert.equal(ps.length, 14)
  assert.deepEqual(ps.map((p) => p.n), ps.map((_, i) => i + 1))
  assert.equal(ps[0].id, 'sample-0')
  assert.ok(ps[2].label.includes('reviewer') && ps[1].label === 'Participant 2')
  assert.ok(ps.every((p) => p.pages >= 1 && p.ms > 0 && p.grade))
  const path = participantPath(s.events, 'sample-0')
  assert.equal(path.steps[0].page, '/')
  assert.ok(path.steps.every((x) => x.ms >= 0))
  const clicks = s.events.filter((e) => e.run_id === 'sample-0' && e.kind === 'click').length
  assert.equal(path.looks.length, clicks)
  assert.ok(path.looks.every((l) => l.lookMs == null || l.lookMs >= 0))
})

test('page table: 600 pages stay one bounded page of rows, searchable and sortable', async () => {
  const { pageTable } = await import('../src/saas/gaze-report.ts')
  const rows = Array.from({ length: 600 }, (_, i) => ({ page: `/p/${i}`, people: i % 37, fixations: i, top: i === 5 ? 'button Buy' : null, layouts: [] }))
  const v = pageTable(rows, { per: 25 })
  assert.equal(v.rows.length, 25); assert.equal(v.pages, 24); assert.equal(v.rows[0].people, 36)
  assert.equal(pageTable(rows, { q: 'buy' }).total, 1)
  assert.equal(pageTable(rows, { sort: 'page', desc: false }).rows[0].page, '/p/0')
  assert.equal(pageTable(rows, { page: 999 }).page, 23)
})
